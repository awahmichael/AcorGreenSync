/**
 * ACORCLOUD GREEN-SYNC: UPC-FIRST EMISSION MAPPING PIPELINE
 *
 * Maps products to emission factors using a 4-tier priority chain:
 * Tier 1 — UPC Lookup, Tier 2 — Commodity Code, Tier 3 — Climatiq API, Tier 4 — AI Auto-Mapping.
 *
 * Payload: { products: [{ id, name, category, upc, commodity_code, unit }] }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { products } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return Response.json({ error: 'products array is required' }, { status: 400 });
    }

    // ── Fetch ALL active DEFRA factors (paginated — default limit is 50, which misses thousands) ──
    const allFactors = [];
    let factorSkip = 0;
    const factorBatchSize = 500;
    let hasMoreFactors = true;
    while (hasMoreFactors) {
      const batch = await base44.asServiceRole.entities.EmissionFactor.filter(
        { source: 'DEFRA', is_active: true },
        null,
        factorBatchSize,
        factorSkip
      );
      allFactors.push(...batch);
      factorSkip += factorBatchSize;
      if (batch.length < factorBatchSize) hasMoreFactors = false;
      if (allFactors.length > 50000) break; // safety cap
    }

    console.log(`mapProductEmissions: loaded ${allFactors.length} DEFRA factors for ${products.length} products`);

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
      tier3_climatiq: 0,
      tier4_ai: 0,
      pending: 0,
      errors: 0,
      details: []
    };

    for (const product of products) {
      try {
        let matchedFactor = null;
        let matchedTier = null;

        // ── Tier 1: UPC Lookup ──
        if (product.upc) {
          const existing = await base44.asServiceRole.entities.Product.filter({
            upc: product.upc,
            is_current_version: true,
            emission_mapping_status: 'Mapped',
            emission_factor_source: 'DEFRA'
          }, null, 5);

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

        // ── Tier 3: Climatiq API ──
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
                  await base44.asServiceRole.entities.Product.update(product.id, {
                    emission_factor_climatiq: topMatch.factor,
                    emission_factor_source: 'Climatiq',
                    emission_mapping_status: 'Mapped',
                    scope3_category: product.scope3_category || 'Both'
                  });

                  results.tier3_climatiq++;
                  results.details.push({
                    product_id: product.id,
                    name: product.name,
                    tier: 'tier3_climatiq',
                    factor: topMatch.name,
                    kg_co2e_per_unit: topMatch.factor
                  });
                  continue;
                }
              } else {
                console.error(`Climatiq API returned ${climatiqRes.status} for product ${product.id}`);
              }
            } catch (climatiqError) {
              console.error(`Climatiq mapping failed for product ${product.id}:`, climatiqError.message);
            }
          }
        }

        // ── Tier 4: AI Auto-Mapping ──
        if (!matchedFactor) {
          try {
            // Build a compact list of all factor names grouped by category
            // so the AI can pick the EXACT name for reliable lookup
            const factorsByCategory = {};
            for (const f of allFactors) {
              const cat = f.category || 'Other';
              if (!factorsByCategory[cat]) factorsByCategory[cat] = [];
              factorsByCategory[cat].push(`${f.name} (${f.kg_co2e_per_unit} kg CO2e/${f.unit})`);
            }
            const factorList = Object.entries(factorsByCategory)
              .map(([cat, names]) => `${cat}:\n  - ${names.join('\n  - ')}`)
              .join('\n');

            const llmResponse = await base44.integrations.Core.InvokeLLM({
              prompt: `You are a professional retail sustainability auditor.
Map the following retail product to the most accurate DEFRA emission factor from the list below.

Product Name: "${product.name}"
Product Category: "${product.category || 'Not specified'}"
Unit: "${product.unit || 'unit'}"

Available DEFRA Emission Factors:
${factorList}

Instructions:
- Pick the factor whose name best represents this product's material/food type.
- Return the EXACT factor name (the text before the parenthesis) from the list above.
- For food/drink products, match to the closest food category (e.g. "Fresh fruit" for fruit juice).
- For household/HBA products, match to "Plastics: average plastics" or the most relevant material.

Return ONLY a JSON object:
- "factor_name": the EXACT factor name from the list above
- "confidence": a number from 0 to 100

If nothing fits, return {"factor_name": "", "confidence": 0}.`,
              response_json_schema: {
                type: "object",
                properties: {
                  factor_name: { type: "string" },
                  confidence: { type: "number" }
                }
              },
              model: "gemini_3_flash"
            });

            if (llmResponse && llmResponse.factor_name) {
              const lookupKey = llmResponse.factor_name.toLowerCase().trim();
              matchedFactor = factorByName[lookupKey] || null;

              if (!matchedFactor) {
                // Fuzzy: find factor whose name contains the AI response or vice versa
                matchedFactor = allFactors.find(f =>
                  f.name && (f.name.toLowerCase().includes(lookupKey) || lookupKey.includes(f.name.toLowerCase()))
                ) || null;
              }

              if (matchedFactor) matchedTier = 'tier4_ai';
            }
          } catch (aiError) {
            console.error(`AI mapping failed for product ${product.id}:`, aiError.message);
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
      } catch (productError) {
        console.error(`Failed to process product ${product.id} (${product.name}):`, productError.message);
        results.errors++;
        results.details.push({
          product_id: product.id,
          name: product.name,
          tier: 'error',
          error: productError.message
        });
      }
    }

    return Response.json({
      status: 'success',
      total_processed: products.length,
      mapped_upc: results.tier1_upc,
      mapped_commodity: results.tier2_commodity,
      mapped_climatiq: results.tier3_climatiq,
      mapped_ai: results.tier4_ai,
      pending_manual_review: results.pending,
      errors: results.errors,
      details: results.details
    });
  } catch (error) {
    console.error('mapProductEmissions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});