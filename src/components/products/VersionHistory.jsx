import { Leaf, CheckCircle2, Clock } from 'lucide-react';

/**
 * VersionHistory — Displays the SCD Type 2 version timeline for a product.
 * Shows each version with its carbon coefficient, validity period, and status.
 */
export default function VersionHistory({ versions, currentVersion }) {
  if (!versions || versions.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">No version history available.</div>;
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {versions.map((v, i) => {
        const isCurrent = v.version === currentVersion || (v.is_current_version !== false && i === versions.length - 1);
        const isSuperseded = v.valid_to != null;
        const prevCoef = i > 0 ? versions[i - 1].emission_factor_defra : null;
        const coef = v.emission_factor_defra ?? 0;
        const change = prevCoef != null ? coef - prevCoef : null;

        return (
          <div key={v.id || i} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''} ${isCurrent ? 'bg-green-50/50' : ''}`}>
            {/* Version badge */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
              isCurrent ? 'bg-primary text-white' : isSuperseded ? 'bg-muted text-muted-foreground' : 'bg-blue-50 text-blue-700'
            }`}>
              v{v.version || i + 1}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                  <Leaf className="w-3 h-3 text-primary" />
                  {coef.toFixed(4)} kg CO₂e
                </div>
                {isCurrent ? (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />Current
                  </span>
                ) : (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />Superseded
                  </span>
                )}
                {change != null && change !== 0 && (
                  <span className={`text-xs font-medium ${change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({change < 0 ? '↓' : '↑'} {Math.abs(change).toFixed(4)})
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {v.valid_from ? new Date(v.valid_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                {isSuperseded && v.valid_to ? ` → ${new Date(v.valid_to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' → present'}
                {v.emission_factor_source && <span className="ml-2">· {v.emission_factor_source}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}