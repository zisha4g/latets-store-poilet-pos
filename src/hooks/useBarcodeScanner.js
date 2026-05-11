import { useRef, useCallback } from 'react';

/**
 * Detects barcode-scanner input by measuring keystroke timing.
 * Scanners type at <80ms between keystrokes; humans are >100ms.
 *
 * Usage:
 *   const scanner = useBarcodeScanner();
 *   <input
 *     onChange={(e) => { scanner.recordKeystroke(); setValue(e.target.value); }}
 *     onKeyDown={(e) => { if (e.key === 'Enter') ...; }}
 *   />
 *   const isScanned = scanner.isScanned();
 */
export const useBarcodeScanner = ({ thresholdMs = 80, sampleSize = 5 } = {}) => {
  const timestamps = useRef([]);

  const recordKeystroke = useCallback(() => {
    const now = Date.now();
    timestamps.current.push(now);
    if (timestamps.current.length > sampleSize) {
      timestamps.current.shift();
    }
  }, [sampleSize]);

  const isScanned = useCallback(() => {
    const ts = timestamps.current;
    if (ts.length < 3) return false;
    const avg = (ts[ts.length - 1] - ts[0]) / (ts.length - 1);
    return avg < thresholdMs;
  }, [thresholdMs]);

  const reset = useCallback(() => {
    timestamps.current = [];
  }, []);

  return { recordKeystroke, isScanned, reset };
};

export default useBarcodeScanner;
