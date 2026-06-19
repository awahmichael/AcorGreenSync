import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle2, Flag, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function EmissionAuditPanel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.Product.list().then(setProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const unmapped = products.filter(p => p.emission_mapping_status !== 'Mapped');
  const mapped = products.filter(p => p.emission_mapping_status === 'Mapped');

  const bulkFlag = async () => {
    setFlagging(true);
    const pending = products.filter(p => p.emission_mapping_status === 'Pending');
    await Promise.allSettled(pending.map(p => base44.entities.Product.update(p.id, { emission_mapping_status: 'Flagged' })));
    toast.success(`${pending.length} products flagged for review`);
    load();
    setFlagging(false);
  };

  const resolve = async (product) => {
    await base44.entities.Product.update(product.id, { emission_mapping_status: 'Flagged' });
    toast.success(`${product.name} flagged for manual review`);
    load();
  };

  const completeness = products.length > 0 ? Math.round((mapped.length / products.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: products.length, color: 'text-foreground' },
          { label: 'Mapped', value: mapped.length, color: 'text-green-600' },
          { label: 'Unmapped / Flagged', value: unmapped.length, color: unmapped.length > 0 ? 'text-red-600' : 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completeness bar */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Emission Factor Completeness</span>
          <span className={`font-bold ${completeness === 100 ? 'text-green-600' : completeness >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{completeness}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${completeness === 100 ? 'bg-green-500' : completeness >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">100% mapping required for full Scope 3 GHG Protocol compliance</p>
      </div>

      {/* Actions */}
      {unmapped.length > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-sm text-amber-800">{unmapped.filter(p => p.emission_mapping_status === 'Pending').length} products still in "Pending" status — bulk flag for review?</span>
          <Button size="sm" variant="outline" onClick={bulkFlag} disabled={flagging} className="border-amber-300 text-amber-700 hover:bg-amber-100">
            {flagging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Flag className="w-3.5 h-3.5 mr-1" />Flag All Pending</>}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-sm text-foreground">Products Requiring Attention</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : unmapped.length === 0 ? (
          <div className="p-8 text-center text-green-700 text-sm flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            All products have emission factors mapped.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">UPC / SKU</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unmapped.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.upc || p.sku || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        p.emission_mapping_status === 'Flagged'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {p.emission_mapping_status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.emission_mapping_status !== 'Flagged' && (
                        <button onClick={() => resolve(p)} className="text-xs text-muted-foreground hover:text-red-600 transition-colors">
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}