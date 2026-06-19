import { useEffect, useRef, useCallback } from 'react';

/**
 * Detects rapid keystroke sequences from USB/Bluetooth barcode scanners.
 * Scanners typically send all characters within ~50ms followed by Enter.
 * Also supports manual input via the returned inputRef.
 */
export function useBarcodeScanner({ onScan, enabled = true }) {
  const bufferRef = useRef('');
  const timerRef = useRef(null);
  const SCANNER_TIMEOUT = 80; // ms — scanners fire faster than humans type

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = '';
    if (code.length >= 6 && onScan) {
      onScan(code);
    }
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Enter') {
        clearTimeout(timerRef.current);
        flush();
        return;
      }

      // Only capture printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, SCANNER_TIMEOUT);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [enabled, flush]);
}