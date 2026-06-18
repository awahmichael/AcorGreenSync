import { Leaf } from 'lucide-react';

export default function NetZeroProgress({ current, target, progressPct }) {
  const remaining = Math.max(target - current, 0);
  const overTarget = current > target;

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">UK Net Zero Progress</h3>
        </div>
        <span className="text-xs text-muted-foreground">Target: {target.toFixed(0)} kg CO₂e</span>
      </div>
      <div className="space-y-3">
        <div className="w-full bg-green-50 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(progressPct, 100)}%`,
              background: overTarget
                ? 'linear-gradient(90deg, #16A34A, #ef4444)'
                : 'linear-gradient(90deg, #16A34A, #22C55E)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="font-bold text-foreground">{current.toFixed(2)} kg CO₂e</span>
            <span className="text-muted-foreground ml-1">emitted</span>
          </div>
          <div className="text-right">
            {overTarget ? (
              <span className="text-red-500 font-semibold">{(current - target).toFixed(2)} kg over target</span>
            ) : (
              <span className="text-primary font-semibold">{remaining.toFixed(2)} kg remaining</span>
            )}
          </div>
        </div>
        <div className="flex gap-6 pt-1">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{progressPct.toFixed(1)}%</span> of annual target used
          </div>
          <div className="text-xs text-muted-foreground">
            GHG Protocol Scope 3 — Categories 1 & 11
          </div>
        </div>
      </div>
    </div>
  );
}