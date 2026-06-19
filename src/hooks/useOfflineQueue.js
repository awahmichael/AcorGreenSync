import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const QUEUE_KEY = 'acorcloud_offline_queue';

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    localStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

function saveToStorage(items) {
  if (items.length === 0) {
    localStorage.removeItem(QUEUE_KEY);
  } else {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  }
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState(() => loadFromStorage());
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Re-read from storage on mount to stay in sync
  useEffect(() => {
    const current = loadFromStorage();
    setQueue(current);
  }, []);

  const addToQueue = useCallback((transaction) => {
    setQueue(prev => {
      // Avoid duplicate refs in queue
      if (prev.find(t => t.transaction_ref === transaction.transaction_ref)) return prev;
      const updated = [...prev, { ...transaction, queued_at: new Date().toISOString() }];
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearQueue = useCallback(() => {
    saveToStorage([]);
    setQueue([]);
  }, []);

  // Sync: check if each transaction already exists, skip if so, else create
  const syncQueue = useCallback(async () => {
    if (syncInProgress.current) return;
    const current = loadFromStorage();
    if (!current.length) {
      setQueue([]);
      return;
    }

    syncInProgress.current = true;
    setSyncing(true);

    const remaining = [];
    for (const txn of current) {
      try {
        // Check if this transaction_ref already exists in the DB
        const existing = await base44.entities.Transaction.filter({ transaction_ref: txn.transaction_ref });
        if (existing && existing.length > 0) {
          // Already in DB — just remove from queue, no need to create
          continue;
        }
        const { queued_at, ...payload } = txn;
        await base44.entities.Transaction.create({ ...payload, sync_status: 'synced' });
      } catch {
        remaining.push(txn);
      }
    }

    saveToStorage(remaining);
    setQueue(remaining);
    setSyncing(false);
    syncInProgress.current = false;
  }, []);

  return { queue, syncing, addToQueue, clearQueue, syncQueue };
}