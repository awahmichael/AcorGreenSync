import { useState, useRef, useCallback } from 'react';
import { Camera, X, Loader2, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CameraProductSearch({ products, onMatch }) {
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [matches, setMatches] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = useCallback(async () => {
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
    } catch (err) {
      toast.error('Cannot access camera — check browser permissions');
      console.error('[CameraSearch]', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;
    setAnalyzing(true);
    setMatches([]);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Upload image
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      const uploadResp = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResp.file_url;

      // Build product catalog summary for AI to match against
      const catalog = products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        sku: p.sku,
        upc: p.upc,
        price: p.price,
        description: `${p.name} (${p.category})`,
      }));

      // Ask AI to identify the product
      const llmResp = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a retail product recognition AI. Analyze the image and identify the product(s) visible.
          
Here is the store's product catalog:
${JSON.stringify(catalog.slice(0, 200))}

Match the product(s) you see in the image to the catalog entries above. Return the best matches ranked by confidence.
If you cannot identify any product, return an empty matches array.`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_id: { type: "string" },
                  product_name: { type: "string" },
                  confidence: { type: "number", description: "0 to 1" },
                  reason: { type: "string" }
                }
              }
            }
          }
        },
        model: "gemini_3_flash",
      });

      // Match AI results back to full product objects
      const enriched = (llmResp.matches || [])
        .filter(m => m.product_id)
        .map(m => {
          const product = products.find(p => p.id === m.product_id);
          return product ? { ...product, confidence: m.confidence, reason: m.reason } : null;
        })
        .filter(Boolean);

      setMatches(enriched);

      if (enriched.length === 0) {
        toast.info('No matching products found — try a different angle');
      } else {
        toast.success(`Found ${enriched.length} possible match${enriched.length > 1 ? 'es' : ''}`);
      }
    } catch (err) {
      toast.error('Image analysis failed — please try again');
      console.error('[CameraSearch]', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setOpen(false);
    setMatches([]);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setTimeout(startCamera, 300); }}>
        <Camera className="w-3.5 h-3.5 mr-1.5" /> Scan
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> AI Product Scanner
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Camera feed */}
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {analyzing && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="text-white text-sm">Analyzing image…</span>
                </div>
              )}
              {!streaming && !analyzing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button onClick={startCamera} variant="outline" className="text-black">
                    <Camera className="w-4 h-4 mr-2" /> Start Camera
                  </Button>
                </div>
              )}
            </div>

            {/* Capture button */}
            {streaming && (
              <Button onClick={captureAndAnalyze} disabled={analyzing} className="w-full bg-primary hover:bg-primary/90">
                {analyzing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" /> Identify Product</>
                )}
              </Button>
            )}

            {/* Results */}
            {matches.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Possible matches:</div>
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onMatch(p); handleClose(); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category} · £{p.price?.toFixed(2)}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-bold ${p.confidence >= 0.8 ? 'text-green-600' : p.confidence >= 0.5 ? 'text-amber-600' : 'text-red-500'}`}>
                        {Math.round(p.confidence * 100)}%
                      </span>
                      <span className="text-[9px] text-muted-foreground">match</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <Button variant="ghost" onClick={handleClose} className="w-full text-muted-foreground">
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}