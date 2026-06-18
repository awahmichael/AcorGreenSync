import { useState, useEffect, useCallback } from 'react';

const QUEUE_KEY = 'acorcloud_offline_queue';

export function useOfflineQueue() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      setQueue(JSON.parse(stored));
    }
  }, []);

  const addToQueue = useCallback((transaction) => {
    const updated = [...queue, { ...transaction, queued_at: new Date().toISOString() }];
    setQueue(updated);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
    return updated;
  }, [queue]);

  const removeFromQueue = useCallback((transactionRef) => {
    const updated = queue.filter(t => t.transaction_ref !== transactionRef);
    setQueue(updated);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  }, [queue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(QUEUE_KEY);
  }, []);

  const getQueueCount = () => queue.length;

  return { queue, addToQueue, removeFromQueue, clearQueue, getQueueCount };
}