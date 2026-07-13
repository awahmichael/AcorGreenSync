/**
 * ACORCLOUD GREEN-SYNC: UPC-FIRST EMISSION MAPPING PIPELINE
 *
 * Called when a tenant creates or bulk-uploads products. Maps each product
 * to a DEFRA EmissionFactor using a 3-tier priority chain:
 *
 * Tier 1 — UPC Lookup: If the product has a UPC, check if ANY product in the
 *          platform already has that UPC mapped to an emission factor.
 *          If yes, clone the mapping (zero AI cost, community-verified).
 *
 * Tier 2 — Commodity Code: If the product has a commodity_code, look it up
 *          directly in the EmissionFactor table.
 *
 * Tier 3 — AI Auto-Mapping: Fall back to InvokeLLM, passing the product name +
 *          category + a compact list of DEFRA categories. The LLM returns the
 *          best-matching factor name. We then resolve that to an EmissionFactor
 *          record and store it.
 *
 * Tier 4 — Climatiq API Fallback: If all DEFRA-based tiers fail, query the
 *          Climatiq search endpoint for a global emission factor match.
 *          Stores the factor with source='Climatiq' so it's distinguishable
 *          from the legally authoritative DEFRA mappings.
 *
 * Unmatched products are left as emission_mapping_status='Pending' for the
 * tenant's manual review queue.
 *
 * Payload: { products: [{ id, name, category, upc, commodity_code, unit }] }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { products } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return Response.json({ error: 'products array is required' }, { status: 400 });
    }

    // Fetch all active DEFRA factors once (for Tier 2 + Tier 3 context)
    const allFactors = await base44.asServiceRole.entities.EmissionFactor.filter({
      source: 'DEFRA',
      is_active: true,
    });

    // Build lookup maps
    const factorByCommodity = {};
    const factorByName = {};
    const uniqueCategories = new Set();

    for (const f of allFactors) {
      if (f.commodity_code) factorByCommodity[f.commodity_code] = f;
      if (f.name) factorByName[f.name.toLowerCase().trim()] = f;
      if (f.category) uniqueCategories.add(f.category);
    }

    const defraCategoryList = Array.from(uniqueCategories);

    const results = {
      tier1_upc: 0,
      tier2_commodity: 0,
      tier3_ai: 0,
      tier4_climatiq: 0,
      pending: 0,
      details: []
    };

    for (const product of products) {
      let matchedFactor = null;
      let matchedTier = null;

      // ── Tier 1: UPC Lookup ──
      if (product.upc) {
        // Check if any other product in the platform already has this UPC mapped
        const existing = await base44.asServiceRole.entities.Product.filter({
          upc: product.upc,
          is_current_version: true,
          emission_mapping_status: 'Mapped',
          emission_factor_source: 'DEFRA'
        });

        if (existing.length > 0) {
          matchedFactor = allFactors.find(f => f.id === existing[0].defra_factor_id);
          if (matchedFactor) matchedTier = 'tier1_upc';
        }
      }

      // ── Tier 2: Commodity Code ──
      if (!matchedFactor && product.commodity_code) {
        matchedFactor = factorByCommodity[product.commodity_code] || null;
        if (matchedFactor) matchedTier = 'tier2_commodity';
      }

      // ── Tier 3: AI Auto-Mapping ──
      if (!matchedFactor) {
        try {
          const llmResponse = await base44.integrations.Core.InvokeLLM({
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
                scope3_category: { type: "string" }
              }
            },
            model: "gemini_3_flash"
          });

          if (llmResponse && llmResponse.factor_name) {
            // Resolve the LLM-suggested name to an actual EmissionFactor record
            const lookupKey = llmResponse.factor_name.toLowerCase().trim();
            matchedFactor = factorByName[lookupKey] || null;

            // If exact name match fails, try partial match within the category
            if (!matchedFactor) {
              matchedFactor = allFactors.find(f =>
                f.name && f.name.toLowerCase().includes(lookupKey)
              ) || null;
            }

            if (matchedFactor) matchedTier = 'tier3_ai';
          }
        } catch (aiError) {
          console.error(`AI mapping failed for product ${product.id}:`, aiError.message);
        }
      }

      // ── Tier 4: Climatiq API Fallback ──
      if (!matchedFactor) {
        const climatiqKey = Deno.env.get("CLIMATIQ_API_KEY");
        if (climatiqKey) {
          try {
            const query = encodeURIComponent(product.name + (product.category ? ' ' + product.category : ''));
            const climatiqUrl = `https://api.climatiq.io/data/v1/search?query=${query}&data_version=^21&results_per_page=1&region=GB`;
            const climatiqRes = await fetch(climatiqUrl, {
              headers: { Authorization: `Bearer ${climatiqKey}` }
            });

            if (climatiqRes.ok) {
              const climatiqData = await climatiqRes.json();
              if (climatiqData.results && climatiqData.results.length > 0) {
                const topMatch = climatiqData.results[0];
                // Store Climatiq factor directly on the product
                await base44.asServiceRole.entities.Product.update(product.id, {
                  emission_factor_climatiq: topMatch.factor,
                  emission_factor_source: 'Climatiq',
                  emission_mapping_status: 'Mapped',
                  scope3_category: product.scope3_category || 'Both'
                });

                results.tier4_climatiq++;
                results.details.push({
                  product_id: product.id,
                  name: product.name,
                  tier: 'tier4_climatiq',
                  factor: topMatch.name,
                  kg_co2e_per_unit: topMatch.factor,
                  climatiq_factor_id: topMatch.id,
                  climatiq_unit: topMatch.unit
                });
                continue; // Skip the DEFRA apply/pending block below
              }
            } else {
              console.error(`Climatiq API returned ${climatiqRes.status} for product ${product.id}`);
            }
          } catch (climatiqError) {
            console.error(`Climatiq mapping failed for product ${product.id}:`, climatiqError.message);
          }
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
          scope3_category: matchedFactor.scope3_category || product.scope3_category || 'Both'
        });

        results[matchedTier]++;
        results.details.push({
          product_id: product.id,
          name: product.name,
          tier: matchedTier,
          factor: matchedFactor.name,
          kg_co2e_per_unit: matchedFactor.kg_co2e_per_unit
        });
      } else {
        // Leave as Pending for manual review queue
        await base44.asServiceRole.entities.Product.update(product.id, {
          emission_mapping_status: 'Pending'
        });

        results.pending++;
        results.details.push({
          product_id: product.id,
          name: product.name,
          tier: 'pending_manual_review'
        });
      }
    }

    return Response.json({
      status: 'success',
      total_processed: products.length,
      mapped_upc: results.tier1_upc,
      mapped_commodity: results.tier2_commodity,
      mapped_ai: results.tier3_ai,
      mapped_climatiq: results.tier4_climatiq,
      pending_manual_review: results.pending,
      details: results.details
    });
  } catch (error) {
    console.error('mapProductEmissions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});