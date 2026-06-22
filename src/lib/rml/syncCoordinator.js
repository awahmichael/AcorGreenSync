/**
 * ACORCLOUD GREEN-SYNC: RML — MODULE 5
 * Idempotent Event Queue & Conflict Reconciliation
 * 
 * JavaScript adaptation of the Rust SyncCoordinator.
 * Background network coordinator that identifies outstanding transaction
 * records and dispatches them securely to the Base44 cloud endpoint.
 * 
 * Idempotency: checks transaction_ref existence before creating,
 * preventing duplicate processing across intermittent connections.
 */

import { base44 } from '@/api/base44Client';
import { localDB } from './localDatabase';
import { SyncStatus } from './structures';

export class SyncCoordinator {
  constructor(dbContext = localDB, cloudEndpoint = 'base44') {
    this.db = dbContext;
    this.cloudEndpoint = cloudEndpoint;
    this._syncInProgress = false;
  }

  /**
   * Evaluates pending record packets, marshalling and dispatching
   * payloads over network paths. Idempotent — safe to call repeatedly.
   * 
   * @param {Array} pendingSet - Array of Transaction objects (optional; auto-fetched if omitted)
   * @returns {Promise<{synced: number, failed: number, skipped: number}>}
   */
  async pushPendingPayloads(pendingSet = null) {
    // Guard against concurrent sync cycles
    if (this._syncInProgress) {
      return { synced: 0, failed: 0, skipped: 0, message: 'Sync already in progress' };
    }

    this._syncInProgress = true;

    try {
      // Fetch pending transactions from local IndexedDB if not provided
      const pending = pendingSet || (await this.db.fetchPendingTransactions());

      if (!pending.length) {
        return { synced: 0, failed: 0, skipped: 0 };
      }

      let synced = 0;
      let failed = 0;
      let skipped = 0;

      for (const tx of pending) {
        try {
          // Marshal local model into cloud-ready payload
          const cloudPayload = this._marshalForCloud(tx);

          // Idempotency check: verify transaction_ref doesn't already exist
          const existing = await base44.entities.Transaction.filter({
            transaction_ref: tx.transaction_ref,
          });

          if (existing && existing.length > 0) {
            // Already in cloud — mark as synced locally, skip creation
            await this.db.updateSyncStatus(tx.transaction_id, SyncStatus.SYNCED);
            skipped++;
            continue;
          }

          // Dispatch to Base44 cloud node
          await base44.entities.Transaction.create(cloudPayload);

          // Update local state to prevent duplication loops
          await this.db.updateSyncStatus(tx.transaction_id, SyncStatus.SYNCED);
          synced++;
        } catch (err) {
          // Retain PENDING identifier for subsequent tracking cycles
          console.warn(`[RML Sync] Failed to dispatch ${tx.transaction_ref}:`, err);
          failed++;
        }
      }

      return { synced, failed, skipped, total: pending.length };
    } finally {
      this._syncInProgress = false;
    }
  }

  /**
   * Marshals a local transaction record into a cloud-ready payload.
   * Strips internal RML fields and maps to the Base44 Transaction entity schema.
   */
  _marshalForCloud(tx) {
    return {
      transaction_ref: tx.transaction_ref,
      store_id: tx.location_id || tx.store_id,
      store_name: tx.store_name,
      cashier_id: tx.cashier_id,
      cashier_name: tx.cashier_name,
      items: (tx.items || []).map((line) => ({
        product_id: line.product_id || line.sku_id,
        product_name: line.product_name,
        category: line.category,
        quantity: line.quantity,
        unit_price: line.unit_price,
        unit: line.unit,
        emission_factor: line.carbon_coefficient || line.emission_factor,
        emission_factor_source: line.emission_factor_source,
        kg_co2e: line.line_carbon_footprint || line.kg_co2e,
        scope3_category: line.scope3_category,
      })),
      total_amount: tx.total_amount,
      total_kg_co2e: tx.total_carbon_footprint || tx.total_kg_co2e,
      upstream_kg_co2e: tx.upstream_kg_co2e,
      downstream_kg_co2e: tx.downstream_kg_co2e,
      sync_status: SyncStatus.SYNCED,
      recorded_offline: tx.recorded_offline || true,
      transaction_date: tx.transaction_date,
      payment_method: tx.payment_method,
      notes: tx.notes,
    };
  }

  /**
   * Pushes a single transaction to the cloud immediately (online checkout).
   * Used by the ProcessingEngine when online — bypasses the queue.
   */
  async dispatchSingle(transaction) {
    const cloudPayload = this._marshalForCloud(transaction);
    const existing = await base44.entities.Transaction.filter({
      transaction_ref: transaction.transaction_ref,
    });

    if (existing && existing.length > 0) {
      await this.db.updateSyncStatus(transaction.transaction_id, SyncStatus.SYNCED);
      return { synced: false, skipped: true };
    }

    await base44.entities.Transaction.create(cloudPayload);
    await this.db.updateSyncStatus(transaction.transaction_id, SyncStatus.SYNCED);
    return { synced: true, skipped: false };
  }

  /** Returns whether a sync cycle is currently active. */
  get isSyncing() {
    return this._syncInProgress;
  }
}

// Singleton instance
export const syncCoordinator = new SyncCoordinator();