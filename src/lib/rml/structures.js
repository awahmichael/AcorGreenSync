/**
 * ACORCLOUD GREEN-SYNC: RML — MODULE 2
 * Relational Data Models & Serialization
 * 
 * JavaScript adaptation of the Rust/WASM structures module.
 * Now includes SCD Type 2 versioning fields for immutable carbon tracking.
 */

// ── SyncStatus Enumeration ──────────────────────────────────────────
export const SyncStatus = Object.freeze({
  PENDING: 'pending_sync',
  SYNCED: 'synced',
  CONFLICT: 'conflict',
  PENDING_EMISSION: 'pending_emission_calc',
});

// ── UUID Generation ─────────────────────────────────────────────────
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Data Model Factories ───────────────────────────────────────────

/**
 * InventorySku — master inventory entity cached on the edge node.
 * Now includes SCD Type 2 versioning fields (version, valid_from, valid_to, 
 * is_current_version, base_product_id).
 */
export function createInventorySku(data) {
  return {
    sku_id: data.sku_id || data.id || generateUUID(),
    name: data.name || '',
    price: Number(data.price) || 0,
    cost_price: Number(data.cost_price) || 0,
    stock_level: Number(data.stock_quantity ?? data.stock_level) || 0,
    carbon_coefficient: Number(data.emission_factor_defra ?? data.carbon_coefficient) || 0,
    carbon_coefficient_climatiq: Number(data.emission_factor_climatiq) || 0,
    emission_factor_source: data.emission_factor_source || 'Pending',
    emission_mapping_status: data.emission_mapping_status || 'Pending',
    category_id: data.category_id || data.category || '',
    upc: data.upc || '',
    sku: data.sku || '',
    unit: data.unit || 'unit',
    scope3_category: data.scope3_category || 'Both',
    supplier_id: data.supplier_id || null,
    is_active: data.is_active !== false,
    last_updated_at: Date.now(),
    // SCD Type 2 versioning fields
    base_product_id: data.base_product_id || data.id || null,
    version: Number(data.version) || 1,
    valid_from: data.valid_from || new Date().toISOString(),
    valid_to: data.valid_to || null,
    is_current_version: data.is_current_version !== false,
  };
}

/** Transaction — parent atomic ledger record generated at checkout. */
export function createTransaction(data) {
  return {
    transaction_id: data.transaction_id || generateUUID(),
    transaction_ref: data.transaction_ref || `TXN-${Date.now()}`,
    location_id: data.location_id || data.store_id || '',
    store_name: data.store_name || '',
    cashier_id: data.cashier_id || '',
    cashier_name: data.cashier_name || '',
    customer_id: data.customer_id || '',
    customer_name: data.customer_name || '',
    subtotal: Number(data.subtotal) || 0,
    discount_amount: Number(data.discount_amount) || 0,
    applied_promotions: data.applied_promotions || '',
    total_amount: Number(data.total_amount) || 0,
    total_kg_co2e: Number(data.total_kg_co2e ?? data.total_carbon_footprint) || 0,
    total_carbon_footprint: Number(data.total_kg_co2e ?? data.total_carbon_footprint) || 0,
    upstream_kg_co2e: Number(data.upstream_kg_co2e) || 0,
    downstream_kg_co2e: Number(data.downstream_kg_co2e) || 0,
    items: data.items || [],
    timestamp: data.timestamp || Date.now(),
    transaction_date: data.transaction_date || new Date().toISOString(),
    sync_status: data.sync_status || SyncStatus.PENDING,
    recorded_offline: data.recorded_offline || false,
    payment_method: data.payment_method || 'card',
    notes: data.notes || '',
  };
}

/**
 * TransactionLineItem — relational sub-line linking SKU to parent transaction.
 * Now stamps applied_version and applied_carbon_coefficient for audit lock.
 */
export function createTransactionLineItem(data) {
  return {
    line_item_id: data.line_item_id || generateUUID(),
    transaction_id: data.transaction_id || '',
    sku_id: data.sku_id || data.product_id || '',
    product_id: data.product_id || data.sku_id || '',
    base_product_id: data.base_product_id || data.product_id || '',
    product_name: data.product_name || '',
    category: data.category || '',
    quantity: Number(data.quantity) || 0,
    unit_price: Number(data.unit_price) || 0,
    unit_cost: Number(data.unit_cost ?? data.cost_price) || 0,
    line_cost: Number(data.line_cost) || (Number(data.unit_cost ?? data.cost_price) || 0) * (Number(data.quantity) || 0),
    line_price: Number(data.line_price) || (Number(data.unit_price) || 0) * (Number(data.quantity) || 0),
    unit: data.unit || 'unit',
    carbon_coefficient: Number(data.emission_factor ?? data.carbon_coefficient) || 0,
    line_carbon_footprint: Number(data.kg_co2e ?? data.line_carbon_footprint) || 0,
    emission_factor_source: data.emission_factor_source || 'Pending',
    scope3_category: data.scope3_category || 'Both',
    // CRITICAL: Audit lock fields — permanently bind this line item to the
    // exact product version and carbon coefficient active at the moment of sale.
    applied_version: Number(data.applied_version) || 1,
    applied_carbon_coefficient: Number(data.applied_carbon_coefficient ?? data.emission_factor ?? data.carbon_coefficient) || 0,
  };
}

/** CartItem — temporary memory construct for active checkout selections. */
export function createCartItem(data) {
  return {
    sku_id: data.sku_id || data.product_id || '',
    product_id: data.product_id || data.sku_id || '',
    quantity: Number(data.quantity) || 1,
  };
}