/**
 * useCatalogIngestion — React hook for the bulk catalog ingestion pipeline.
 *
 * Manages the full onboarding flow for large retailer catalogs (10,000+ items):
 *   1. Upload file to Base44 storage
 *   2. Extract structured data from CSV/Excel
 *   3. Process in background chunks via web worker (non-blocking)
 *   4. Sync standardized SKUs to the cloud Product entity
 *
 * The web worker keeps the main thread free so POS checkout remains
 * fully responsive during bulk processing.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { buildCategoryCarbonRegistry, CatalogIngestionPipeline } from '@/lib/rml/catalogIngestion';
import { localDB } from '@/lib/rml/localDatabase';

const CHUNK_SIZE = 500;

// JSON schema describing expected columns in the uploaded catalog file
const CATALOG_SCHEMA = {
  type: 'object',
  properties: {
    upc: { type: 'string' },
    name: { type: 'string' },
    price: { type: 'number' },
    cost_price: { type: 'number' },
    category: { type: 'string' },
    sku: { type: 'string' },
    unit: { type: 'string' },
    stock: { type: 'number' },
  },
  required: ['name', 'price'],
};

export function useCatalogIngestion() {
  const [processing, setProcessing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, pseudoCount: 0, mappedCount: 0, synced: 0 });
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const workerRef = useRef(null);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    setProcessing(false);
    setSyncing(false);
    setProgress({ current: 0, total: 0, pseudoCount: 0, mappedCount: 0, synced: 0 });
    setResults(null);
    setError(null);
  }, []);

  /**
   * Processes raw catalog items through the ingestion pipeline.
   * Uses a web worker for non-blocking chunked processing.
   *
   * @param {Array} rawItems - Extracted items from the uploaded file
   * @param {string} storePrefix - Retailer store code for pseudo-UPC generation
   * @returns {Promise<Array>} - Standardized SKUs ready for cloud sync
   */
  const processCatalog = useCallback(async (rawItems, storePrefix) => {
    setProcessing(true);
    setError(null);
    setProgress({ current: 0, total: rawItems.length, pseudoCount: 0, mappedCount: 0, synced: 0 });
    setResults(null);

    // Build category carbon registry from DEFRA EmissionFactor records
    let categoryRegistry = null;
    try {
      const factors = await base44.entities.EmissionFactor.filter({ is_active: true });
      categoryRegistry = buildCategoryCarbonRegistry(factors);
    } catch {
      // Fall back to default baselines
    }

    // Fetch existing cached SKUs for tier 1 (direct UPC/SKU match)
    let existingSkus = [];
    try {
      existingSkus = await localDB.fetchAllSkus();
    } catch {
      // No local cache — skip tier 1
    }

    // Chunk items into batches
    const chunks = [];
    for (let i = 0; i < rawItems.length; i += CHUNK_SIZE) {
      chunks.push(rawItems.slice(i, i + CHUNK_SIZE));
    }

    const allSkus = [];
    let totalPseudo = 0;
    let totalMapped = 0;

    const useWorker = typeof Worker !== 'undefined';

    if (useWorker) {
      try {
        const worker = new Worker(
          new URL('../lib/rml/catalogIngestion.worker.js', import.meta.url),
          { type: 'module' }
        );
        workerRef.current = worker;

        await new Promise((resolve, reject) => {
          let chunkIdx = 0;

          worker.onmessage = (e) => {
            const { type, chunkIndex, totalChunks, result, message } = e.data;

            if (type === 'ready') {
              // Start first chunk
              worker.postMessage({
                type: 'process_chunk',
                payload: {
                  chunk: chunks[0],
                  chunkIndex: 0,
                  totalChunks: chunks.length,
                  existingSkus,
                },
              });
              return;
            }

            if (type === 'chunk_complete') {
              allSkus.push(...result.skus);
              totalPseudo += result.pseudoCount;
              totalMapped += result.mappedCount;
              chunkIdx = chunkIndex + 1;

              setProgress({
                current: allSkus.length,
                total: rawItems.length,
                pseudoCount: totalPseudo,
                mappedCount: totalMapped,
                synced: 0,
              });

              if (chunkIdx < chunks.length) {
                worker.postMessage({
                  type: 'process_chunk',
                  payload: {
                    chunk: chunks[chunkIdx],
                    chunkIndex: chunkIdx,
                    totalChunks: chunks.length,
                    existingSkus,
                  },
                });
              } else {
                resolve();
              }
              return;
            }

            if (type === 'error') {
              reject(new Error(message));
            }
          };

          worker.onerror = (err) => reject(err);

          // Init the worker
          worker.postMessage({
            type: 'init',
            payload: { storePrefix, categoryRegistry },
          });
        });

        worker.terminate();
        workerRef.current = null;
      } catch (workerErr) {
        // Fall back to main thread with yielding
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        console.warn('[Ingestion] Worker failed, falling back to main thread:', workerErr);
        await processOnMainThread();
      }
    } else {
      await processOnMainThread();
    }

    async function processOnMainThread() {
      const pipeline = new CatalogIngestionPipeline(storePrefix, categoryRegistry);
      for (let i = 0; i < chunks.length; i++) {
        const result = pipeline.processBulkUploadBatch(chunks[i], existingSkus);
        allSkus.push(...result.skus);
        totalPseudo += result.pseudoCount;
        totalMapped += result.mappedCount;
        setProgress({
          current: allSkus.length,
          total: rawItems.length,
          pseudoCount: totalPseudo,
          mappedCount: totalMapped,
          synced: 0,
        });
        // Yield to keep UI responsive
        await new Promise(r => setTimeout(r, 0));
      }
    }

    setProcessing(false);
    setResults({
      total: allSkus.length,
      pseudoCount: totalPseudo,
      mappedCount: totalMapped,
      unmappedCount: allSkus.length - totalMapped,
      skus: allSkus,
    });

    return allSkus;
  }, []);

  /**
   * Syncs processed SKUs to the Base44 cloud Product entity in bulk batches.
   * Also caches to local IndexedDB for offline POS access.
   */
  const syncToCloud = useCallback(async (skus, organizationId) => {
    setSyncing(true);
    setError(null);
    let synced = 0;

    try {
      for (let i = 0; i < skus.length; i += CHUNK_SIZE) {
        const batch = skus.slice(i, i + CHUNK_SIZE).map(sku => ({
          name: sku.name,
          upc: sku.upc,
          sku: sku.sku,
          category: sku.category || sku.category_id || 'Other',
          price: sku.price,
          cost_price: sku.cost_price || 0,
          unit: sku.unit,
          stock_quantity: sku.stock_level,
          emission_factor_defra: sku.carbon_coefficient,
          emission_factor_source: sku.emission_factor_source,
          emission_mapping_status: sku.emission_mapping_status,
          scope3_category: sku.scope3_category,
          is_active: true,
          version: sku.version || 1,
          is_current_version: true,
          valid_from: sku.valid_from || new Date().toISOString(),
          base_product_id: sku.base_product_id,
          organization_id: organizationId,
        }));

        await base44.entities.Product.bulkCreate(batch);
        synced += batch.length;
        setProgress(p => ({ ...p, synced }));
      }

      // Cache to local IndexedDB for offline POS
      await localDB.cacheSkus(skus);

      setSyncing(false);
      return synced;
    } catch (err) {
      setSyncing(false);
      setError(err.message || 'Cloud sync failed');
      throw err;
    }
  }, []);

  return {
    processing,
    syncing,
    progress,
    results,
    error,
    processCatalog,
    syncToCloud,
    reset,
  };
}