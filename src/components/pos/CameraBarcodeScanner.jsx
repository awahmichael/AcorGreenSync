import { useState, useRef, useCallback, useEffect } from 'react';
import { ScanLine, X, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

/**
 * CameraBarcodeScanner — real-time barcode scanner using the native
 * BarcodeDetector API. Works on mobile Chrome/Edge and desktop Chromium.
 * Calls onScan(barcode) the moment a code is detected.
 */
export default function CameraBarcodeScanner({ onScan }) {
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [supported, setSupported] = useState(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const lastCodeRef = useRef({ code: '', time: 0 });

  // Check API support on mount
  useEffect(() => {
    setSupported('BarcodeDetector' in window || 'BarcodeDetector' in globalThis);
  }, []);

  const startCamera = useCallback(async () => {
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
      startScanning();
    } catch (err) {
      toast.error('Cannot access camera — check browser permissions');
      console.error('[BarcodeScanner]', err);
    } finally {
      setStarting(false);
    }
  }, []);

  const startScanning = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || !streamRef.current) return;

      try {
        if (!detectorRef.current) {
          detectorRef.current = new (window.BarcodeDetector || globalThis.BarcodeDetector)({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf']
          });
        }

        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          const now = Date.now();
          // Dedup: same code within 2s = same scan
          if (code !== lastCodeRef.current.code || now - lastCodeRef.current.time > 2000) {
            lastCodeRef.current = { code, time: now };
            onScan(code);
          }
        }
      } catch {
        // detect() can throw transient errors on empty frames — ignore
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
  }, [onScan]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    detectorRef.current = null;
    setStreaming(false);
  }, []);

  const handleClose = () => {
    stopCamera();
    setOpen(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ScanLine className="w-3.5 h-3.5 mr-1.5" /> Barcode Scan
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-primary" /> Camera Barcode Scanner
            </DialogTitle>
          </DialogHeader>

          {!supported ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                Your browser doesn't support the Barcode Detection API.
              </p>
              <p className="text-xs text-muted-foreground">
                Try Chrome or Edge on mobile/tablet. On desktop, use a USB/Bluetooth barcode scanner instead.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Camera feed with scanning reticle */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Scanning reticle overlay */}
                {streaming && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-white/70 rounded-xl relative">
                      <div className="absolute left-0 top-0 w-5 h-5 border-t-4 border-l-4 border-primary rounded-tl-xl" />
                      <div className="absolute right-0 top-0 w-5 h-5 border-t-4 border-r-4 border-primary rounded-tr-xl" />
                      <div className="absolute left-0 bottom-0 w-5 h-5 border-b-4 border-l-4 border-primary rounded-bl-xl" />
                      <div className="absolute right-0 bottom-0 w-5 h-5 border-b-4 border-r-4 border-primary rounded-br-xl" />
                      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
                    </div>
                  </div>
                )}

                {starting && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                    <span className="text-white text-sm">Starting camera…</span>
                  </div>
                )}

                {!streaming && !starting && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button onClick={startCamera} variant="outline" className="text-black">
                      <Camera className="w-4 h-4 mr-2" /> Start Camera
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {streaming
                  ? 'Point your camera at a barcode — it scans automatically.'
                  : 'Tap "Start Camera" to begin scanning barcodes with your device camera.'}
              </p>

              {streaming && (
                <Button variant="ghost" onClick={handleClose} className="w-full text-muted-foreground">
                  <X className="w-4 h-4 mr-2" /> Close Scanner
                </Button>
              )}

              {!streaming && (
                <Button variant="ghost" onClick={handleClose} className="w-full text-muted-foreground">
                  <X className="w-4 h-4 mr-2" /> Close
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}