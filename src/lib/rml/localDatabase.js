/**
 * ACORCLOUD GREEN-SYNC: RML — MODULE 3
 * Storage Interface Layer & ACID State Machine
 * 
 * JavaScript adaptation replacing WASM/IndexedDB Rust bindings with
 * a native browser IndexedDB abstraction. Provides persistent offline
 * storage for product cache, transaction ledger, and line items.
 * 
 * No external packages — uses the native IndexedDB API.
 */

const DB_NAME = 'acorcloud_rml';
const DB_VERSION = 1;

// Object store names (tables)
const STORES = Object.freeze({
  SKUS: 'skus',                // Cached product inventory
  TRANSACTIONS: 'transactions', // Parent ledger blocks
  LINE_ITEMS: 'line_items',     // Relational sub-lines
});

let dbInstance = null;

/**
 * Opens (or creates) the IndexedDB database with all required object stores.
 * Handles version upgrades safely.
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.SKUS)) {
        const skuStore = db.createObjectStore(STORES.SKUS, { keyPath: 'sku_id' });
        skuStore.createIndex('upc', 'upc', { unique: false });
        skuStore.createIndex('sku', 'sku', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'transaction_id' });
        txStore.createIndex('sync_status', 'sync_status', { unique: false });
        txStore.createIndex('transaction_ref', 'transaction_ref', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.LINE_ITEMS)) {
        db.createObjectStore(STORES.LINE_ITEMS, { keyPath: 'line_item_id' });
      }
    };
  });
}

/**
 * Generic store operation helper.
 * Wraps IndexedDB transaction in a Promise.
 */
function storeOp(storeName, mode, callback) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

// ════════════════════════════════════════════════════════════════════
// LocalDatabaseContext — mirrors the Rust struct of the same name.
// ════════════════════════════════════════════════════════════════════

export class LocalDatabaseContext {
  constructor(name = DB_NAME) {
    this.dbName = name;
  }

  // ── SKU Operations ───────────────────────────────────────────────

  /** Fetches a single SKU by its ID from local cache. */
  async fetchSku(skuId) {
    try {
      const result = await storeOp(STORES.SKUS, 'readonly', (store) => store.get(skuId));
      return result || null;
    } catch {
      return null;
    }
  }

  /** Fetches a SKU by UPC or SKU code from local cache. */
  async fetchSkuByCode(code) {
    try {
      const result = await storeOp(STORES.SKUS, 'readonly', (store) => store.getAll());
      return result.find((s) => s.upc === code || s.sku === code) || null;
    } catch {
      return null;
    }
  }

  /** Returns all cached SKUs. */
  async fetchAllSkus() {
    try {
      return await storeOp(STORES.SKUS, 'readonly', (store) => store.getAll());
    } catch {
      return [];
    }
  }

  /** Caches a batch of SKUs from the cloud (offline preparation). */
  async cacheSkus(skus) {
    if (!skus || skus.length === 0) return;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SKUS, 'readwrite');
      const store = tx.objectStore(STORES.SKUS);
      skus.forEach((s) => store.put(s));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Mutates stock quantity for a specific SKU locally. */
  async updateSkuStock(skuId, newLevel) {
    const sku = await this.fetchSku(skuId);
    if (!sku) return;
    sku.stock_level = Math.max(0, newLevel);
    sku.last_updated_at = Date.now();
    await storeOp(STORES.SKUS, 'readwrite', (store) => store.put(sku));
  }

  // ── Transaction Operations ───────────────────────────────────────

  /**
   * Atomic commit pipeline: writes a parent transaction block alongside
   * its sub-line items. If any step fails, the entire ledger block
   * rolls back completely (IndexedDB transaction atomicity).
   */
  async writeTransactionRecords(tx, lineItems) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.TRANSACTIONS, STORES.LINE_ITEMS], 'readwrite');
      const txStore = transaction.objectStore(STORES.TRANSACTIONS);
      const lineStore = transaction.objectStore(STORES.LINE_ITEMS);

      txStore.put(tx);
      lineItems.forEach((line) => lineStore.put(line));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  /** Retrieves all transactions with PENDING sync status. */
  async fetchPendingTransactions() {
    try {
      const all = await storeOp(STORES.TRANSACTIONS, 'readonly', (store) => store.getAll());
      return all.filter((t) => t.sync_status === 'pending_sync' || t.sync_status === 'PENDING');
    } catch {
      return [];
    }
  }

  /** Updates the sync status of a transaction (idempotent dispatch guard). */
  async updateSyncStatus(transactionId, status) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite');
      const store = tx.objectStore(STORES.TRANSACTIONS);
      const getReq = store.get(transactionId);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.sync_status = status;
          store.put(record);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Removes a transaction and its line items after successful cloud sync. */
  async purgeTransaction(transactionId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.TRANSACTIONS, STORES.LINE_ITEMS], 'readwrite');
      tx.objectStore(STORES.TRANSACTIONS).delete(transactionId);
      // Line items are embedded in the transaction record for cloud transport;
      // purge any standalone line_item records referencing this transaction
      const lineStore = tx.objectStore(STORES.LINE_ITEMS);
      const cursorReq = lineStore.openCursor();
      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.transaction_id === transactionId) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Clears all local data (used for hard reset / re-cache). */
  async clearAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.SKUS, STORES.TRANSACTIONS, STORES.LINE_ITEMS], 'readwrite');
      tx.objectStore(STORES.SKUS).clear();
      tx.objectStore(STORES.TRANSACTIONS).clear();
      tx.objectStore(STORES.LINE_ITEMS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Singleton instance for app-wide use
export const localDB = new LocalDatabaseContext();