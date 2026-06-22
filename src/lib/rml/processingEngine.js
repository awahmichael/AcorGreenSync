/**
 * ACORCLOUD GREEN-SYNC: RML — MODULE 4
 * High-Velocity Checkout & Environmental Mapping
 * 
 * Now stamps applied_version and applied_carbon_coefficient on each line
 * item, permanently binding the transaction to the exact product version
 * active at the moment of sale (SCD Type 2 audit lock).
 * 
 * Mathematical Logic: E_total = Sum (Quantity_i × Coefficient_i)
 * Audit Lock: line.applied_version = product.version (at sale time)
 */

import { localDB } from './localDatabase';
import {
  generateUUID,
  SyncStatus,
  createTransaction,
  createTransactionLineItem,
} from './structures';

export class ProcessingEngine {
  constructor(dbContext = localDB) {
    this.db = dbContext;
  }

  /**
   * Main transaction lifecycle pipeline.
   * 
   * Executes complete retail calculations, stock balances, and carbon
   * audits in a single pass. Each line item is permanently stamped with
   * the product version active at checkout time.
   * 
   * @param {string} locationId - Store/location identifier
   * @param {Array} cart - Array of CartItem objects (with _productData attached)
   * @param {Object} options - { cashier_id, cashier_name, store_name, payment_method, online }
   * @returns {Promise<Transaction>} - The committed transaction record
   */
  async executeCheckout(locationId, cart, options = {}) {
    let totalAmount = 0;
    let totalCogs = 0;
    let totalCarbonFootprint = 0;
    let upstreamCO2e = 0;
    let downstreamCO2e = 0;
    const lineItemsToCommit = [];

    const txId = generateUUID();
    const currentTimestamp = Date.now();
    const isOnline = options.online !== false;

    // Process line items iteratively, balancing inventory metrics inline
    for (const item of cart) {
      // Retrieve underlying SKU profile from local cache first, then fallback
      let skuProfile = await this.db.fetchSku(item.product_id || item.sku_id);

      // If not in local cache, try by UPC/SKU code
      if (!skuProfile && (item.upc || item.sku)) {
        skuProfile = await this.db.fetchSkuByCode(item.upc || item.sku);
      }

      // Use inline product data if local DB miss (passed from caller)
      if (!skuProfile && item._productData) {
        skuProfile = item._productData;
      }

      if (!skuProfile) {
        throw new Error(`SKU identification breakdown: product ${item.product_id || item.sku_id} not found in local cache.`);
      }

      // Enforce hard real-time stock validations (only for stocked items)
      const stockLevel = skuProfile.stock_level ?? skuProfile.stock_quantity ?? 0;
      if (stockLevel > 0 && stockLevel < item.quantity) {
        throw new Error(`Insufficient physical stock for ${skuProfile.name}. Available: ${stockLevel}, Requested: ${item.quantity}`);
      }

      // Calculation mapping: Emission totals match quantity × compliance metrics
      // The carbon coefficient is locked from the EXACT version active at this moment
      const carbonCoefficient =
        skuProfile.carbon_coefficient ?? skuProfile.emission_factor_defra ?? skuProfile.emission_factor_climatiq ?? 0;
      const unitCost = Number(skuProfile.cost_price ?? item.unit_cost ?? 0) || 0;
      const calcPrice = (skuProfile.price || 0) * item.quantity;
      const calcCarbon = item.quantity * carbonCoefficient;
      const lineCost = unitCost * item.quantity;

      // CRITICAL: Determine the product version for audit lock
      // This permanently binds the line item to the exact carbon data active at sale time
      const appliedVersion = skuProfile.version || 1;
      const baseProductId = skuProfile.base_product_id || skuProfile.sku_id || item.product_id;

      totalAmount += calcPrice;
      totalCogs += lineCost;
      totalCarbonFootprint += calcCarbon;

      // Scope 3 split: upstream (Cat 1) vs downstream (Cat 11)
      const scope3Cat = skuProfile.scope3_category || item.scope3_category || 'Both';
      if (scope3Cat !== 'Category_11_Use_of_Sold_Products') {
        upstreamCO2e += calcCarbon;
      }
      if (scope3Cat !== 'Category_1_Purchased_Goods') {
        downstreamCO2e += calcCarbon;
      }

      // Generate relational line mapping for the ledger
      // The applied_version and applied_carbon_coefficient fields are the
      // deterministic audit safeguard — they freeze the carbon data at sale time
      const lineItem = createTransactionLineItem({
        line_item_id: generateUUID(),
        transaction_id: txId,
        sku_id: skuProfile.sku_id || item.product_id,
        product_id: item.product_id || skuProfile.sku_id,
        base_product_id: baseProductId,
        product_name: skuProfile.name || item.product_name,
        category: skuProfile.category_id || skuProfile.category || item.category,
        quantity: item.quantity,
        unit_price: skuProfile.price || item.unit_price,
        unit_cost: unitCost,
        line_cost: lineCost,
        line_price: calcPrice,
        unit: skuProfile.unit || item.unit || 'unit',
        emission_factor: carbonCoefficient,
        kg_co2e: calcCarbon,
        line_carbon_footprint: calcCarbon,
        emission_factor_source: skuProfile.emission_factor_source || 'Pending',
        scope3_category: scope3Cat,
        // Audit lock fields
        applied_version: appliedVersion,
        applied_carbon_coefficient: carbonCoefficient,
      });
      lineItemsToCommit.push(lineItem);

      // Adjust storage baselines locally to ensure continuity across offline spans
      const updatedStock = Math.max(0, stockLevel - item.quantity);
      await this.db.updateSkuStock(skuProfile.sku_id || item.product_id, updatedStock);
    }

    // Construct the parent transaction ledger block
    const transactionRef = options.transaction_ref || `TXN-${Date.now()}`;
    const discountAmount = options.discount_amount || 0;
    const finalTotal = Math.max(0, totalAmount - discountAmount);
    const executedTransaction = createTransaction({
      transaction_id: txId,
      transaction_ref: transactionRef,
      location_id: locationId,
      store_name: options.store_name || '',
      cashier_id: options.cashier_id || '',
      cashier_name: options.cashier_name || '',
      customer_id: options.customer_id || '',
      customer_name: options.customer_name || '',
      subtotal: totalAmount,
      discount_amount: discountAmount,
      applied_promotions: Array.isArray(options.applied_promotions) ? options.applied_promotions.join(', ') : (options.applied_promotions || ''),
      total_amount: finalTotal,
      total_cogs: totalCogs,
      total_kg_co2e: totalCarbonFootprint,
      total_carbon_footprint: totalCarbonFootprint,
      upstream_kg_co2e: upstreamCO2e,
      downstream_kg_co2e: downstreamCO2e,
      items: lineItemsToCommit,
      timestamp: currentTimestamp,
      transaction_date: new Date(currentTimestamp).toISOString(),
      sync_status: isOnline ? SyncStatus.SYNCED : SyncStatus.PENDING,
      recorded_offline: !isOnline,
      payment_method: options.payment_method || 'card',
      notes: options.notes || '',
    });

    // Write atomic ledger modifications to local database storage
    await this.db.writeTransactionRecords(executedTransaction, lineItemsToCommit);

    return executedTransaction;
  }
}

// Singleton instance
export const processingEngine = new ProcessingEngine();