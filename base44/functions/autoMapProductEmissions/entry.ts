/**
 * ACORCLOUD GREEN-SYNC: AUTO EMISSION MAPPING (ENTITY AUTOMATION)
 *
 * Triggered automatically when a new Product is created. Runs the same
 * 4-tier mapping pipeline as mapProductEmissions but for a single product,
 * using the service role (no user auth context needed for automations).
 *
 * Tier 1 — UPC Lookup      Tier 2 — Commodity Code
 * Tier 3 — Climatiq API    Tier 4 — AI Auto-Mapping
 *
 * Payload (from entity automation): { event, data, payload_too_large }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, payload_too_large } = await req.json();

    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event' });
    }

    // Fetch full product if payload was too large or data is missing
    let product = data;
    if (payload_too_large || !product) {
      product = await base44.asServiceRole.entities.Product.get(event.entity_id);
    }
    if (!product) {
      return Response.json({ skipped: true, reason: 'Product not found' });
    }

    // Skip if already mapped (safety check)
    if (product.emission_mapping_status === 'Mapped') {
      return Response.json({ skipped: true, reason: 'Already mapped' });
    }

    // Fetch all active DEFRA factors
    const allFactors = await base44.asServiceRole.entities.EmissionFactor.filter({
      source: 'DEFRA',
      is_active: true,
    });

    const factorByCommodity = {};
    const factorByName = {};
    const uniqueCategories = new Set();

    for (const f of allFactors) {
      if (f.commodity_code) factorByCommodity[f.commodity_code] = f;
      if (f.name) factorByName[f.name.toLowerCase().trim()] = f;
      if (f.category) uniqueCategories.add(f.category);
    }
    const defraCategoryList = Array.from(uniqueCategories);

    let matchedFactor = null;
    let matchedTier = null;

    // ── Tier 1: UPC Lookup ──
    if (product.upc) {
      const existing = await base44.asServiceRole.entities.Product.filter({
        upc: product.upc,
        is_current_version: true,
        emission_mapping_status: 'Mapped',
        emission_factor_source: 'DEFRA',
      });
      if (existing.length > 0) {
        matchedFactor = allFactors.find(f => f.id === existing[0].defra_factor_id) || null;
        if (matchedFactor) matchedTier = 'tier1_upc';
      }
    }

    // ── Tier 2: Commodity Code ──
    if (!matchedFactor && product.commodity_code) {
      matchedFactor = factorByCommodity[product.commodity_code] || null;
      if (matchedFactor) matchedTier = 'tier2_commodity';
    }

    // ── Tier 3: Climatiq API ──
    if (!matchedFactor) {
      const climatiqKey = Deno.env.get("CLIMATIQ_API_KEY");
      if (climatiqKey) {
        try {
          const query = encodeURIComponent(product.name + (product.category ? ' ' + product.category : ''));
          const climatiqUrl = `https://api.climatiq.io/data/v1/search?query=${query}&data_version=^21&results_per_page=1&region=GB`;
          const climatiqRes = await fetch(climatiqUrl, {
            headers: { Authorization: `Bearer ${climatiqKey}` },
          });
          if (climatiqRes.ok) {
            const climatiqData = await climatiqRes.json();
            if (climatiqData.results && climatiqData.results.length > 0) {
              const topMatch = climatiqData.results[0];
              await base44.asServiceRole.entities.Product.update(product.id, {
                emission_factor_climatiq: topMatch.factor,
                emission_factor_source: 'Climatiq',
                emission_mapping_status: 'Mapped',
                scope3_category: product.scope3_category || 'Both',
              });
              return Response.json({
                status: 'success',
                product_id: product.id,
                name: product.name,
                tier: 'tier3_climatiq',
                factor: topMatch.name,
                kg_co2e_per_unit: topMatch.factor,
              });
            }
          }
        } catch (climatiqError) {
          console.error(`[autoMap] Climatiq failed for ${product.id}:`, climatiqError.message);
        }
      }
    }

    // ── Tier 4: AI Auto-Mapping ──
    if (!matchedFactor) {
      try {
        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a professional retail sustainability auditor.
Map the following product to the most accurate DEFRA emission factor category.

Product Name: "${product.name}"
Product Category: "${product.category || 'Not specified'}"
Unit: "${product.unit || 'unit'}"

Available DEFRA Categories: ${defraCategoryList.join(', ')}

Return ONLY a JSON object with:
- "factor_name": the exact DEFRA factor name that best matches this product
- "confidence": a number from 0 to 100 indicating your confidence
- "scope3_category": the GHG Protocol Scope 3 category if applicable

If no category is a good fit, return {"factor_name": "", "confidence": 0}.`,
          response_json_schema: {
            type: "object",
            properties: {
              factor_name: { type: "string" },
              confidence: { type: "number" },
              scope3_category: { type: "string" },
            },
          },
          model: "gemini_3_flash",
        });

        if (llmResponse && llmResponse.factor_name) {
          const lookupKey = llmResponse.factor_name.toLowerCase().trim();
          matchedFactor = factorByName[lookupKey] || null;
          if (!matchedFactor) {
            matchedFactor = allFactors.find(f =>
              f.name && f.name.toLowerCase().includes(lookupKey)
            ) || null;
          }
          if (matchedFactor) matchedTier = 'tier4_ai';
        }
      } catch (aiError) {
        console.error(`[autoMap] AI mapping failed for ${product.id}:`, aiError.message);
      }
    }

    // ── Apply result ──
    if (matchedFactor && matchedTier) {
      await base44.asServiceRole.entities.Product.update(product.id, {
        emission_factor_defra: matchedFactor.kg_co2e_per_unit,
        emission_factor_source: 'DEFRA',
        emission_mapping_status: 'Mapped',
        defra_factor_id: matchedFactor.id,
        defra_factor_version: matchedFactor.dataset_version || String(matchedFactor.year || ''),
        commodity_code: product.commodity_code || matchedFactor.commodity_code || null,
        scope3_category: matchedFactor.scope3_category || product.scope3_category || 'Both',
      });
      return Response.json({
        status: 'success',
        product_id: product.id,
        name: product.name,
        tier: matchedTier,
        factor: matchedFactor.name,
        kg_co2e_per_unit: matchedFactor.kg_co2e_per_unit,
      });
    }

    // ── Leave as Pending ──
    await base44.asServiceRole.entities.Product.update(product.id, {
      emission_mapping_status: 'Pending',
    });
    return Response.json({
      status: 'pending',
      product_id: product.id,
      name: product.name,
      tier: 'pending_manual_review',
    });
  } catch (error) {
    console.error('[autoMapProductEmissions] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});