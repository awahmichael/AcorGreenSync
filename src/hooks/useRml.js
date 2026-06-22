/**
 * useRml — React hook for the RML (Relational Mapping Layer) engine.
 * 
 * Initializes the RML engine on mount and exposes the processing engine,
 * sync coordinator, and local database context to React components.
 * 
 * This is the JavaScript replacement for the WASM engine initialization
 * (Module 1: init_engine). Runs natively in the browser — no WASM needed.
 */

import { useState, useEffect, useCallback } from 'react';
import { initEngine, syncProductCache, isEngineReady, processingEngine, syncCoordinator, localDB } from '@/lib/rml';

export function useRml() {
  const [ready, setReady] = useState(isEngineReady());
  const [cacheCount, setCacheCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    initEngine()
      .then(() => {
        setReady(true);
        // Load cached product count for UI display
        localDB.fetchAllSkus().then((skus) => setCacheCount(skus.length));
      })
      .catch(() => setReady(false));
  }, []);

  /** Refreshes the local product cache from the Base44 cloud. */
  const refreshCache = useCallback(async () => {
    setSyncing(true);
    const count = await syncProductCache();
    setCacheCount(count);
    setSyncing(false);
    return count;
  }, []);

  /** Runs pending transactions through the sync coordinator. */
  const syncPending = useCallback(async () => {
    setSyncing(true);
    const result = await syncCoordinator.pushPendingPayloads();
    setSyncing(false);
    return result;
  }, []);

  return {
    ready,
    cacheCount,
    syncing,
    processingEngine,
    syncCoordinator,
    localDB,
    refreshCache,
    syncPending,
  };
}