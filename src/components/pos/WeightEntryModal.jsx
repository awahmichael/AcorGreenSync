import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Scale, Loader2, CheckCircle2, WifiOff } from 'lucide-react';

/**
 * WeightEntryModal — shown when cashier taps a weighted product in POS.
 * If a hardware scale is connected via useScaleStream, it auto-fills the weight.
 * Otherwise, the cashier types the weight manually.
 *
 * Props:
 *  - product: the product being weighed
 *  - scale: the useScaleStream hook return value
 *  - onConfirm(weight, price) — called with the captured weight in sell_unit and computed line price
 *  - onClose()
 */
export default function WeightEntryModal({ product, scale, onConfirm, onClose }) {
  const [manualWeight, setManualWeight] = useState('');

  const sellUnit = product?.sell_unit || 'kg';
  const unitPrice = product?.price || 0; // price is per 1 sell_unit

  // Auto-sync from scale to manual field when connected and stable
  useEffect(() => {
    if (scale.isConnected && scale.currentWeight > 0) {
      setManualWeight(scale.currentWeight.toFixed(3));
    }
  }, [scale.currentWeight, scale.isConnected]);

  const effectiveWeight = parseFloat(manualWeight) || 0;
  const lineTotal = effectiveWeight * unitPrice;
  const canConfirm = effectiveWeight > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(effectiveWeight, lineTotal);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            Weigh Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-3">
            <div className="text-sm font-semibold text-foreground">{product?.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              £{unitPrice.toFixed(2)} per {sellUnit}
            </div>
          </div>

          {/* Scale status */}
          <div className={`rounded-lg p-3 border ${
            scale.isConnected
              ? scale.isStable
                ? 'bg-green-50 border-green-200'
                : 'bg-amber-50 border-amber-200'
              : 'bg-muted border-border'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {scale.isConnected ? (
                  scale.isStable
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">
                  {scale.isConnected
                    ? scale.isStable ? 'Scale stable' : 'Weighing…'
                    : 'Scale not connected'}
                </span>
              </div>
              {!scale.isConnected && scale.supportsWebSerial && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={scale.connect}
                  disabled={scale.isConnecting}
                  className="h-7 text-xs"
                >
                  {scale.isConnecting ? 'Connecting…' : 'Connect Scale'}
                </Button>
              )}
            </div>
            {scale.isConnected && (
              <div className="mt-2 text-2xl font-bold text-foreground tabular-nums">
                {scale.currentWeight.toFixed(3)}
                <span className="text-sm font-normal text-muted-foreground ml-1">{sellUnit}</span>
              </div>
            )}
            {scale.error && (
              <div className="mt-1 text-xs text-red-600">{scale.error}</div>
            )}
          </div>

          {/* Weight input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Weight ({sellUnit})
            </label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={manualWeight}
              onChange={e => setManualWeight(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canConfirm) handleConfirm(); }}
              placeholder="0.000"
              className="text-lg font-semibold text-center tabular-nums"
              autoFocus
            />
          </div>

          {/* Line total */}
          <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2.5">
            <span className="text-sm text-muted-foreground">Line Total</span>
            <span className="text-xl font-bold text-primary">£{lineTotal.toFixed(2)}</span>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Add to Cart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}