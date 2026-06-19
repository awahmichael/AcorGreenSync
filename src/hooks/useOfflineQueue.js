import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const QUEUE_KEY = 'acorcloud_offline_queue';

export function useOfflineQueue() {
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      try { setQueue(JSON.parse(stored)); } catch { localStorage.removeItem(QUEUE_KEY); }
    }
  }, []);

  const saveQueue = (updated) => {
    setQueue(updated);
    if (updated.length === 0) {
      localStorage.removeItem(QUEUE_KEY);
    } else {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
    }
  };

  const addToQueue = useCallback((transaction) => {
    setQueue(prev => {
      const updated = [...prev, { ...transaction, queued_at: new Date().toISOString() }];
      localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromQueue = useCallback((transactionRef) => {
    setQueue(prev => {
      const updated = prev.filter(t => t.transaction_ref !== transactionRef);
      if (updated.length === 0) localStorage.removeItem(QUEUE_KEY);
      else localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Actual sync: push each queued transaction to the API
  const syncQueue = useCallback(async () => {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (!stored) return;
    const current = JSON.parse(stored);
    if (!current.length || syncInProgress.current) return;

    syncInProgress.current = true;
    setSyncing(true);

    const remaining = [];
    for (const txn of current) {
      try {
        const { queued_at, ...payload } = txn;
        await base44.entities.Transaction.create({ ...payload, sync_status: 'synced' });
      } catch {
        remaining.push(txn); // keep failed ones for retry
      }
    }

    saveQueue(remaining);
    setSyncing(false);
    syncInProgress.current = false;
  }, []);

  const clearQueue = useCallback(() => {
    saveQueue([]);
  }, []);

  return { queue, syncing, addToQueue, removeFromQueue, clearQueue, syncQueue };
}