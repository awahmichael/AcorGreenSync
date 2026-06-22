import { useState, useEffect, useCallback, useRef } from 'react';
import { syncCoordinator, localDB, SyncStatus } from '@/lib/rml';

/**
 * useOfflineQueue — React hook bridging the RML SyncCoordinator (Module 5)
 * to the UI layer. Provides queue state and sync triggers.
 * 
 * Queue is now backed by IndexedDB via the RML local database context,
 * replacing the previous localStorage implementation.
 * 
 * API is preserved for backward compatibility with existing components
 * (Dashboard, Layout, SyncStatusBanner, POS).
 */
export function useOfflineQueue() {
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Load pending transactions from IndexedDB on mount
  const refreshQueue = useCallback(async () => {
    const pending = await localDB.fetchPendingTransactions();
    setQueue(pending);
  }, []);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  /**
   * Adds a transaction to the local IndexedDB queue with PENDING status.
   * Used for offline checkout — the ProcessingEngine also writes directly
   * to IndexedDB, so this is primarily for legacy/manual queue additions.
   */
  const addToQueue = useCallback(async (transaction) => {
    // Ensure the transaction has a transaction_id for IndexedDB keying
    const record = {
      ...transaction,
      transaction_id: transaction.transaction_id || crypto.randomUUID(),
      sync_status: transaction.sync_status || SyncStatus.PENDING,
      recorded_offline: true,
    };
    await localDB.writeTransactionRecords(record, record.items || []);
    await refreshQueue();
  }, [refreshQueue]);

  const clearQueue = useCallback(async () => {
    // Purge all pending transactions from local IndexedDB
    const pending = await localDB.fetchPendingTransactions();
    await Promise.allSettled(
      pending.map((tx) => localDB.purgeTransaction(tx.transaction_id))
    );
    setQueue([]);
  }, []);

  /**
   * Syncs pending transactions to the Base44 cloud via the SyncCoordinator.
   * Idempotent — checks transaction_ref existence before creating.
   */
  const syncQueue = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncing(true);

    try {
      await syncCoordinator.pushPendingPayloads();
      await refreshQueue();
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
    }
  }, [refreshQueue]);

  return { queue, syncing, addToQueue, clearQueue, syncQueue, refreshQueue };
}