/**
 * ACORCLOUD GREEN-SYNC: DEFRA FACTOR AUTO-SYNC
 * 
 * Backend function that automatically detects when DEFRA emission factors
 * have changed and applies SCD Type 2 versioning to affected products.
 * 
 * This is the system-automated counterpart to the compliance engine —
 * CO2e updates are NEVER done manually by users. The system detects
 * factor drift and creates new product versions automatically.
 * 
 * Flow:
 * 1. Fetch all current product versions (is_current_version=true, source=DEFRA)
 * 2. Fetch all active DEFRA EmissionFactor records
 * 3. Match products to factors by commodity_code
 * 4. For each match where the coefficient has changed:
 *    a. Close out the current version (set valid_to, is_current_version=false)
 *    b. Insert a new version row with incremented version number
 *    c. Write an immutable AuditLog entry
 * 5. Return a summary of what was updated
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const updateTimestamp = Date.now();
    const updateISO = new Date(updateTimestamp).toISOString();

    // 1. Fetch all current product versions that use DEFRA as their source
    const products = await base44.asServiceRole.entities.Product.filter({
      is_current_version: true,
      is_active: true,
      emission_factor_source: 'DEFRA',
    });

    if (products.length === 0) {
      return Response.json({ status: 'no_products', message: 'No DEFRA-mapped products found.', updated: 0 });
    }

    // 2. Fetch all active DEFRA EmissionFactor records
    const factors = await base44.asServiceRole.entities.EmissionFactor.filter({
      source: 'DEFRA',
      is_active: true,
    });

    // Build a lookup map: commodity_code → latest factor
    const factorMap = {};
    for (const f of factors) {
      if (!f.commodity_code) continue;
      // Keep the factor with the most recent year/version
      if (!factorMap[f.commodity_code] || (f.year || 0) > (factorMap[f.commodity_code].year || 0)) {
        factorMap[f.commodity_code] = f;
      }
    }

    const updates = [];
    const skipped = [];

    // 3. Compare each product's current coefficient against the DEFRA factor
    for (const product of products) {
      const factor = product.commodity_code ? factorMap[product.commodity_code] : null;

      if (!factor) {
        skipped.push({ product_id: product.id, name: product.name, reason: 'no_matching_factor' });
        continue;
      }

      const currentCoef = product.emission_factor_defra ?? 0;
      const newCoef = factor.kg_co2e_per_unit ?? 0;

      // Check if the coefficient has actually changed (beyond floating-point noise)
      if (Math.abs(currentCoef - newCoef) < 0.00001) {
        skipped.push({ product_id: product.id, name: product.name, reason: 'unchanged' });
        continue;
      }

      const baseProductId = product.base_product_id || product.id;
      const currentVersion = product.version || 1;

      // 4a. Immutability step: Close out the current version
      await base44.asServiceRole.entities.Product.update(product.id, {
        valid_to: updateISO,
        is_current_version: false,
      });

      // 4b. Versioning step: Insert a new version row with the updated coefficient
      const newVersion = await base44.asServiceRole.entities.Product.create({
        name: product.name,
        sku: product.sku,
        upc: product.upc,
        category: product.category,
        price: product.price,
        unit: product.unit,
        stock_quantity: product.stock_quantity,
        store_id: product.store_id,
        is_active: product.is_active,
        scope3_category: product.scope3_category,
        commodity_code: product.commodity_code,
        supplier_id: product.supplier_id,
        defra_factor_id: factor.id,
        defra_factor_version: factor.version || String(factor.year || ''),
        // Inject the updated carbon data from DEFRA
        emission_factor_defra: newCoef,
        emission_factor_climatiq: product.emission_factor_climatiq,
        emission_factor_source: 'DEFRA',
        emission_mapping_status: 'Mapped',
        // SCD Type 2 versioning
        base_product_id: baseProductId,
        version: currentVersion + 1,
        valid_from: updateISO,
        valid_to: null,
        is_current_version: true,
      });

      // 4c. Write immutable audit log entry
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'update',
        entity_type: 'Product',
        entity_id: newVersion.id,
        entity_ref: `${product.name} v${currentVersion + 1}`,
        user_id: user.id,
        user_name: 'DEFRA Auto-Sync',
        changes: JSON.stringify({
          field: 'carbon_coefficient',
          old_value: currentCoef,
          new_value: newCoef,
          old_version: currentVersion,
          new_version: currentVersion + 1,
          superseded_product_id: product.id,
          base_product_id: baseProductId,
          source: 'DEFRA',
          defra_factor_id: factor.id,
          defra_factor_name: factor.name,
          defra_year: factor.year,
        }),
        notes: `Auto-sync: DEFRA coefficient updated ${currentCoef.toFixed(4)} → ${newCoef.toFixed(4)} kg CO₂e (v${currentVersion} → v${currentVersion + 1})`,
        performed_at: updateISO,
      });

      updates.push({
        product_id: newVersion.id,
        name: product.name,
        commodity_code: product.commodity_code,
        old_coefficient: currentCoef,
        new_coefficient: newCoef,
        old_version: currentVersion,
        new_version: currentVersion + 1,
        defra_factor: factor.name,
        defra_year: factor.year,
      });
    }

    // 5. Write a SyncLog entry
    await base44.asServiceRole.entities.SyncLog.create({
      sync_type: 'emission_factor_refresh',
      status: updates.length > 0 ? 'success' : 'success',
      records_synced: updates.length,
      records_failed: 0,
      details: `DEFRA auto-sync: ${updates.length} product(s) versioned, ${skipped.length} unchanged/no-match`,
      synced_at: updateISO,
    });

    return Response.json({
      status: 'success',
      checked: products.length,
      updated: updates.length,
      skipped: skipped.length,
      updates,
      skipped_summary: skipped.reduce((acc, s) => {
        acc[s.reason] = (acc[s.reason] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});