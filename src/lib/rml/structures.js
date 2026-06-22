/**
 * ACORCLOUD GREEN-SYNC: RML — MODULE 2
 * Relational Data Models & Serialization
 * 
 * JavaScript adaptation of the Rust/WASM structures module.
 * Replaces WASM structs with plain JS objects + UUID generation.
 * No external dependencies — uses native browser crypto API.
 */

// ── SyncStatus Enumeration ──────────────────────────────────────────
// Tracks synchronization state of ledger blocks between offline edge
// nodes and the centralized Base44 cloud database.
export const SyncStatus = Object.freeze({
  PENDING: 'pending_sync',        // Recorded locally; waiting for uplink
  SYNCED: 'synced',               // Pushed and reconciled with Base44
  CONFLICT: 'conflict',           // Version/ref mismatch requiring intervention
  PENDING_EMISSION: 'pending_emission_calc', // Factors missing at calc time
});

// ── UUID Generation ─────────────────────────────────────────────────
// Cryptographically unique identifiers generated at the edge node
// to prevent duplication across intermittent sync cycles.
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Data Model Factories ───────────────────────────────────────────
// Each factory enforces structural integrity matching the Rust structs.

/** InventorySku — master inventory entity cached on the edge node. */
export function createInventorySku(data) {
  return {
    sku_id: data.sku_id || data.id || generateUUID(),
    name: data.name || '',
    price: Number(data.price) || 0,
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
    total_amount: Number(data.total_amount) || 0,
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

/** TransactionLineItem — relational sub-line linking SKU to parent transaction. */
export function createTransactionLineItem(data) {
  return {
    line_item_id: data.line_item_id || generateUUID(),
    transaction_id: data.transaction_id || '',
    sku_id: data.sku_id || data.product_id || '',
    product_id: data.product_id || data.sku_id || '',
    product_name: data.product_name || '',
    category: data.category || '',
    quantity: Number(data.quantity) || 0,
    unit_price: Number(data.unit_price) || 0,
    line_price: Number(data.line_price) || (Number(data.unit_price) || 0) * (Number(data.quantity) || 0),
    unit: data.unit || 'unit',
    carbon_coefficient: Number(data.emission_factor ?? data.carbon_coefficient) || 0,
    line_carbon_footprint: Number(data.kg_co2e ?? data.line_carbon_footprint) || 0,
    emission_factor_source: data.emission_factor_source || 'Pending',
    scope3_category: data.scope3_category || 'Both',
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