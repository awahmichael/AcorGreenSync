import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useScaleStream — connects to a physical retail weighing scale via Web Serial API.
 *
 * Flow:
 * 1. Cashier clicks "Connect Scale" → browser prompts for serial port.
 * 2. Once connected, the hook continuously reads weight data from the scale.
 * 3. `currentWeight` updates live; `isStable` true when reading settles.
 * 4. If no Web Serial support or user declines, falls back to manual entry mode.
 *
 * Supported scale protocols: generic ASCII weight strings (e.g. "ST,GS,+0.123kg").
 */
export function useScaleStream() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentWeight, setCurrentWeight] = useState(0);
  const [isStable, setIsStable] = useState(false);
  const [error, setError] = useState(null);
  const [supportsWebSerial, setSupportsWebSerial] = useState(true);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const bufferRef = useRef('');
  const lastWeightsRef = useRef([]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serial) {
      setSupportsWebSerial(false);
    }
  }, []);

  const parseWeightLine = useCallback((line) => {
    // Common scale output formats:
    // "ST,GS,+0.123kg"  (Mettler Toledo style)
    // "ST,+,     0.123kg"
    // "0.123kg"
    // "S D 0.123"  (stable, dynamic)
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check for stability marker (ST = stable, US = unstable)
    const hasStableMarker = /^ST/i.test(trimmed);
    setIsStable(hasStableMarker);

    // Extract numeric weight value
    const match = trimmed.match(/(-?\d+\.?\d*)/);
    if (match) {
      const weight = parseFloat(match[1]);
      if (!isNaN(weight) && weight >= 0) {
        setCurrentWeight(weight);
      }
    }
  }, []);

  const readLoop = useCallback(async () => {
    if (!readerRef.current) return;
    keepReadingRef.current = true;

    try {
      while (keepReadingRef.current) {
        const { value, done } = await readerRef.current.read();
        if (done) break;
        if (value) {
          // Decode TextDecoder output
          const text = typeof value === 'string' ? value : new TextDecoder().decode(value);
          bufferRef.current += text;

          // Process complete lines (scales typically send \r\n terminated strings)
          let nlIdx;
          while ((nlIdx = bufferRef.current.indexOf('\n')) >= 0) {
            const line = bufferRef.current.slice(0, nlIdx).replace(/\r$/, '');
            bufferRef.current = bufferRef.current.slice(nlIdx + 1);
            parseWeightLine(line);
          }
        }
      }
    } catch (err) {
      if (keepReadingRef.current) {
        setError(`Scale read error: ${err.message}`);
      }
    } finally {
      keepReadingRef.current = false;
    }
  }, [parseWeightLine]);

  const connect = useCallback(async () => {
    if (!navigator.serial) {
      setError('Web Serial API not supported in this browser. Use Chrome or Edge for hardware scale connection.');
      setSupportsWebSerial(false);
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      portRef.current = port;

      const reader = port.readable.getReader();
      readerRef.current = reader;

      // Capture writable stream for sending commands (Zero/Tare)
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      setIsConnected(true);
      readLoop();
      return true;
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setError('No serial device selected.');
      } else if (err.name === 'InvalidStateError') {
        setError('Port already in use. Disconnect and try again.');
      } else {
        setError(`Connection failed: ${err.message}`);
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [readLoop]);

  const zero = useCallback(async () => {
    if (!writerRef.current) {
      setError('Scale does not support remote zero command.');
      return false;
    }
    try {
      // Common zero/tare commands: "Z\r\n" (Mettler Toledo), "Z\r" (generic)
      const encoder = new TextEncoder();
      await writerRef.current.write(encoder.encode('Z\r\n'));
      return true;
    } catch (err) {
      setError(`Zero command failed: ${err.message}`);
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    if (readerRef.current) {
      try { await readerRef.current.cancel(); } catch (_) {}
      try { await readerRef.current.releaseLock(); } catch (_) {}
      readerRef.current = null;
    }
    if (writerRef.current) {
      try { await writerRef.current.releaseLock(); } catch (_) {}
      writerRef.current = null;
    }
    if (portRef.current) {
      try { await portRef.current.close(); } catch (_) {}
      portRef.current = null;
    }
    setIsConnected(false);
    setCurrentWeight(0);
    setIsStable(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keepReadingRef.current = false;
      if (readerRef.current) {
        try { readerRef.current.releaseLock(); } catch (_) {}
      }
      if (writerRef.current) {
        try { writerRef.current.releaseLock(); } catch (_) {}
      }
      if (portRef.current) {
        try { portRef.current.close(); } catch (_) {}
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    currentWeight,
    isStable,
    error,
    supportsWebSerial,
    connect,
    disconnect,
    zero,
  };
}