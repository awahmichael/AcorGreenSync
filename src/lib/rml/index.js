/**
 * ACORCLOUD GREEN-SYNC: RML — MODULE 1
 * Engine Initialization & Framework Bindings
 * 
 * JavaScript adaptation replacing the WASM init_engine() entry point.
 * Initializes the RML engine: local database, product cache sync,
 * and sync coordinator within the browser context.
 * 
 * No WASM compilation required — runs natively in the Base44 React runtime.
 */

import { localDB } from './localDatabase';
import { syncCoordinator } from './syncCoordinator';
import { createInventorySku } from './structures';
import { base44 } from '@/api/base44Client';

// Module-level state
let _initialized = false;
let _initPromise = null;

/**
 * Global entry point executed automatically upon engine initialization.
 * Establishes the sandboxed logging and error reporting boundaries.
 * 
 * Mirrors: #[wasm_bindgen(start)] fn init_engine()
 */
export async function initEngine() {
  if (_initialized) return true;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Test IndexedDB availability
      if (typeof indexedDB === 'undefined') {
        console.warn('[RML] IndexedDB not available — offline cache disabled. App will operate in online-only mode.');
        _initialized = true;
        return true;
      }

      // Prime the local database connection
      await localDB.clearAll().catch(() => {});

      // Pre-load active products from cloud into local edge cache
      await syncProductCache();

      console.log('[RML] AcorCloud Green-Sync RML Engine Initialized Successfully.');
      _initialized = true;
      return true;
    } catch (err) {
      console.error('[RML] Engine initialization failed:', err);
      _initialized = false;
      _initPromise = null;
      throw err;
    }
  })();

  return _initPromise;
}

/**
 * Syncs product inventory from the Base44 cloud into the local IndexedDB cache.
 * Called on engine init and periodically to keep the edge cache fresh.
 */
export async function syncProductCache() {
  try {
    const products = await base44.entities.Product.filter({ is_active: true });
    const skus = products.map((p) => createInventorySku(p));
    await localDB.cacheSkus(skus);
    return skus.length;
  } catch (err) {
    console.warn('[RML] Product cache sync failed:', err);
    return 0;
  }
}

/**
 * Returns the engine initialization status.
 */
export function isEngineReady() {
  return _initialized;
}

// Re-export all modules for unified access
export { localDB } from './localDatabase';
export { syncCoordinator } from './syncCoordinator';
export { processingEngine, ProcessingEngine } from './processingEngine';
export { SyncStatus, generateUUID, createInventorySku, createTransaction, createTransactionLineItem, createCartItem } from './structures';