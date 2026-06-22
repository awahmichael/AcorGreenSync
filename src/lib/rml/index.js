/**
 * ACORCLOUD GREEN-SYNC: RML — MODULE 1
 * Engine Initialization & Framework Bindings
 */

import { localDB } from './localDatabase';
import { syncCoordinator } from './syncCoordinator';
import { createInventorySku } from './structures';
import { base44 } from '@/api/base44Client';

let _initialized = false;
let _initPromise = null;

export async function initEngine() {
  if (_initialized) return true;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      if (typeof indexedDB === 'undefined') {
        console.warn('[RML] IndexedDB not available — offline cache disabled.');
        _initialized = true;
        return true;
      }

      await localDB.clearAll().catch(() => {});
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

export async function syncProductCache() {
  try {
    // Only cache current versions — historic versions are queried on-demand
    const products = await base44.entities.Product.filter({ is_active: true, is_current_version: true });
    const skus = products.map((p) => createInventorySku(p));
    await localDB.cacheSkus(skus);
    return skus.length;
  } catch (err) {
    console.warn('[RML] Product cache sync failed:', err);
    return 0;
  }
}

export function isEngineReady() {
  return _initialized;
}

// Re-export all modules for unified access
export { localDB } from './localDatabase';
export { syncCoordinator } from './syncCoordinator';
export { processingEngine, ProcessingEngine } from './processingEngine';
export { complianceEngine, AcorCloudComplianceEngine } from './complianceEngine';
export { SyncStatus, generateUUID, createInventorySku, createTransaction, createTransactionLineItem, createCartItem } from './structures';