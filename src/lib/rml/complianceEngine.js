/**
 * ACORCLOUD GREEN-SYNC: RML — COMPLIANCE ENGINE
 * Immutable Versioning & Compliance Core
 * 
 * JavaScript adaptation of the Rust AcorCloudComplianceEngine.
 * Implements Slowly Changing Dimensions (Type 2) for carbon coefficient
 * versioning, ensuring historic transaction data is never corrupted by
 * upstream factor changes.
 * 
 * Tri-factor architectural pattern:
 * A. Immutability — transactions are write-once, read-many
 * B. Architectural Versioning (SCD Type 2) — old versions preserved
 * C. Deterministic Timestamping — temporal queries reconstruct exact state
 */

import { base44 } from '@/api/base44Client';

export class AcorCloudComplianceEngine {

  /**
   * Non-destructive carbon coefficient update (SCD Type 2).
   * 
   * Instead of a destructive UPDATE, uses an INSERT-ONLY strategy:
   * 1. Close out the current version (set valid_to, is_current_version=false)
   * 2. Insert a brand new version row with incremented version number
   * 3. Write an immutable audit log entry
   * 
   * This preserves historic transaction integrity — old sales continue
   * pointing to the version that was active when they occurred.
   * 
   * @param {string} productId — ID of the current product version to supersede
   * @param {number} newCoefficient — New kg CO2e per unit
   * @param {string} source — 'DEFRA' | 'Climatiq' | 'Manual'
   * @param {Object|null} user — Current user object for audit trail
   * @returns {Object} — The newly created version record
   */
  async updateSkuCarbonCoefficient(productId, newCoefficient, source = 'Manual', user = null) {
    const updateTimestamp = Date.now();
    const updateISO = new Date(updateTimestamp).toISOString();

    // 1. Fetch the current active product record
    const currentProduct = await base44.entities.Product.get(productId);
    if (!currentProduct) {
      throw new Error('Target product does not exist in inventory cache.');
    }

    // Determine the stable base_product_id (constant across all versions)
    const baseProductId = currentProduct.base_product_id || currentProduct.id;
    const currentVersion = currentProduct.version || 1;
    const oldCoefficient = currentProduct.emission_factor_defra ?? currentProduct.carbon_coefficient ?? 0;

    // 2. Immutability step: "Close out" the previous version row by updating its expiry timestamp
    //    The old record is NOT deleted — it remains for historic transaction lookups
    await base44.entities.Product.update(productId, {
      valid_to: updateISO,
      is_current_version: false,
    });

    // 3. Versioning step: Create a brand new record row reflecting the updated coefficient
    //    Clone all product properties, inject the new carbon data, increment version
    const newVersionData = {
      name: currentProduct.name,
      sku: currentProduct.sku,
      upc: currentProduct.upc,
      category: currentProduct.category,
      price: currentProduct.price,
      unit: currentProduct.unit,
      stock_quantity: currentProduct.stock_quantity,
      store_id: currentProduct.store_id,
      is_active: currentProduct.is_active,
      scope3_category: currentProduct.scope3_category,
      commodity_code: currentProduct.commodity_code,
      supplier_id: currentProduct.supplier_id,
      defra_factor_id: currentProduct.defra_factor_id,
      defra_factor_version: currentProduct.defra_factor_version,
      // Inject new environment data factor
      emission_factor_defra: source === 'DEFRA' ? newCoefficient : currentProduct.emission_factor_defra,
      emission_factor_climatiq: source === 'Climatiq' ? newCoefficient : currentProduct.emission_factor_climatiq,
      emission_factor_source: source,
      emission_mapping_status: 'Mapped',
      // SCD Type 2 versioning
      base_product_id: baseProductId,
      version: currentVersion + 1,
      valid_from: updateISO,
      valid_to: null,
      is_current_version: true,
    };

    const createdRecord = await base44.entities.Product.create(newVersionData);

    // 4. Write immutable audit log entry
    await base44.entities.AuditLog.create({
      action: 'update',
      entity_type: 'Product',
      entity_id: createdRecord.id,
      entity_ref: `${currentProduct.name} v${currentVersion + 1}`,
      user_id: user?.id || '',
      user_name: user?.full_name || user?.email || 'System',
      changes: JSON.stringify({
        field: 'carbon_coefficient',
        old_value: oldCoefficient,
        new_value: newCoefficient,
        old_version: currentVersion,
        new_version: currentVersion + 1,
        superseded_product_id: productId,
        base_product_id: baseProductId,
        source: source,
      }),
      notes: `Carbon coefficient updated ${oldCoefficient.toFixed(4)} → ${newCoefficient.toFixed(4)} kg CO₂e (v${currentVersion} → v${currentVersion + 1})`,
      performed_at: updateISO,
    });

    return createdRecord;
  }

  /**
   * Temporal query: find the product version that was active at a specific timestamp.
   * 
   * This is the "time-machine" query. It reconstructs the store's exact
   * environmental profile matching any precise date in history.
   * 
   * Logic: valid_from <= timestamp AND (valid_to is null OR valid_to > timestamp)
   * 
   * @param {string} baseProductId — The stable base product ID (constant across versions)
   * @param {number} timestamp — Unix epoch milliseconds
   * @returns {Object|null} — The product version active at that time
   */
  async fetchVersionAtTime(baseProductId, timestamp) {
    const versions = await base44.entities.Product.filter({ base_product_id: baseProductId });

    // Search history to find the row that was active when this transaction happened
    const historicalMatch = versions.find(v => {
      const validFrom = v.valid_from ? new Date(v.valid_from).getTime() : 0;
      const validTo = v.valid_to ? new Date(v.valid_to).getTime() : Infinity;
      return validFrom <= timestamp && validTo > timestamp;
    });

    if (historicalMatch) return historicalMatch;

    // Fallback: return the current version if no temporal match
    return versions.find(v => v.is_current_version !== false) || versions[0] || null;
  }

  /**
   * Fetch all versions of a product for the version history timeline.
   * 
   * @param {string} baseProductId — The stable base product ID
   * @returns {Array} — All versions sorted by version number ascending
   */
  async fetchVersionHistory(baseProductId) {
    const versions = await base44.entities.Product.filter({ base_product_id: baseProductId });
    return versions.sort((a, b) => (a.version || 1) - (b.version || 1));
  }

  /**
   * Restatement calculator: recalculates a date range of transactions using
   * current product factors, showing the delta vs original reported values.
   * 
   * This answers the auditor's question: "What would last quarter's emissions
   * be using today's factors?" — without modifying historic records.
   * 
   * @param {Array} transactions — Transactions to restate
   * @param {Array} currentProducts — Current product versions (is_current_version=true)
   * @returns {Object} — { originalCO2e, restatedCO2e, delta, deltaPct, details }
   */
  async calculateRestatement(transactions, currentProducts) {
    // Build a lookup map: base_product_id → current product version
    const productMap = {};
    currentProducts.forEach(p => {
      const baseId = p.base_product_id || p.id;
      if (!productMap[baseId] || p.is_current_version !== false) {
        productMap[baseId] = p;
      }
    });

    let originalCO2e = 0;
    let restatedCO2e = 0;
    const details = [];

    transactions.forEach(t => {
      const originalTxnCO2e = t.total_kg_co2e || 0;
      originalCO2e += originalTxnCO2e;

      // Recalculate using current factors for each line item
      let restatedTxnCO2e = 0;
      (t.items || []).forEach(item => {
        const product = productMap[item.base_product_id || item.product_id];
        if (product) {
          const currentFactor = product.emission_factor_defra || product.carbon_coefficient || 0;
          restatedTxnCO2e += currentFactor * item.quantity;
        } else {
          // Can't find product — retain original
          restatedTxnCO2e += item.kg_co2e || 0;
        }
      });

      restatedCO2e += restatedTxnCO2e;

      if (Math.abs(restatedTxnCO2e - originalTxnCO2e) > 0.001) {
        details.push({
          transaction_ref: t.transaction_ref,
          transaction_date: t.transaction_date,
          original: originalTxnCO2e,
          restated: restatedTxnCO2e,
          delta: restatedTxnCO2e - originalTxnCO2e,
        });
      }
    });

    return {
      originalCO2e,
      restatedCO2e,
      delta: restatedCO2e - originalCO2e,
      deltaPct: originalCO2e > 0 ? ((restatedCO2e - originalCO2e) / originalCO2e) * 100 : 0,
      transactionCount: transactions.length,
      restatedCount: details.length,
      details: details.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    };
  }
}

// Singleton instance
export const complianceEngine = new AcorCloudComplianceEngine();