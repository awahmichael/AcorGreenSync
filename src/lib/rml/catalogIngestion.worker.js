/**
 * ACORCLOUD GREEN-SYNC: RML — CATALOG INGESTION WEB WORKER
 *
 * Processes bulk catalog uploads in background chunks to keep the main
 * thread completely free, ensuring cashiers can continue scanning items
 * at checkout lanes without any latency.
 *
 * Message protocol:
 *   Main → Worker: { type: 'init', payload: { storePrefix, categoryRegistry } }
 *   Worker → Main: { type: 'ready' }
 *   Main → Worker: { type: 'process_chunk', payload: { chunk, chunkIndex, totalChunks, existingSkus } }
 *   Worker → Main: { type: 'chunk_complete', chunkIndex, totalChunks, result }
 *   Worker → Main: { type: 'error', message }
 */

import { CatalogIngestionPipeline } from './catalogIngestion';

let pipeline = null;

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    pipeline = new CatalogIngestionPipeline(
      payload.storePrefix || 'store',
      payload.categoryRegistry || null
    );
    self.postMessage({ type: 'ready' });
    return;
  }

  if (type === 'process_chunk') {
    try {
      const { chunk, chunkIndex, totalChunks, existingSkus } = payload;
      const result = pipeline.processBulkUploadBatch(chunk, existingSkus || []);
      self.postMessage({
        type: 'chunk_complete',
        chunkIndex,
        totalChunks,
        result,
      });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || 'Worker processing failed' });
    }
    return;
  }
};