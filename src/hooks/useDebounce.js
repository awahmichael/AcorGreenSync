import { useState, useEffect } from 'react';

/**
 * Debounces a value by the given delay (ms).
 * Prevents rapid-fire API calls on each keystroke.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}