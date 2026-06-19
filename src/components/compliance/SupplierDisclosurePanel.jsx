import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const STATUS_STYLE = {
  'Disclosed': 'bg-green-50 text-green-700 border-green-200',
  'Partial': 'bg-blue-50 text-blue-700 border-blue-200',
  'Requested': 'bg-amber-50 text-amber-700 border-amber-200',
  'Not Disclosed': 'bg-red-50 text-red-700 border-red-200',
};

export default function SupplierDisclosurePanel() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    base44.entities.Supplier.list().then(setSuppliers).finally(() => setLoading(false));
  }, []);

  const updateStatus = async (supplier, status) => {
    setUpdating(supplier.id);
    await base44.entities.Supplier.update(supplier.id, { carbon_disclosure_status: status });
    setSuppliers(prev => prev.map(s => s.id === supplier.id ? { ...s, carbon_disclosure_status: status } : s));
    toast.success(`${supplier.name} updated to ${status}`);
    setUpdating(null);
  };

  const bulkRequest = async () => {
    const notRequested = suppliers.filter(s => s.carbon_disclosure_status === 'Not Disclosed' || !s.carbon_disclosure_status);
    await Promise.allSettled(notRequested.map(s => base44.entities.Supplier.update(s.id, { carbon_disclosure_status: 'Requested' })));
    setSuppliers(prev => prev.map(s =>
      (s.carbon_disclosure_status === 'Not Disclosed' || !s.carbon_disclosure_status)
        ? { ...s, carbon_disclosure_status: 'Requested' }
        : s
    ));
    toast.success(`Disclosure requested from ${notRequested.length} supplier(s)`);
  };

  const disclosed = suppliers.filter(s => s.carbon_disclosure_status === 'Disclosed').length;
  const partial = suppliers.filter(s => s.carbon_disclosure_status === 'Partial').length;
  const notDisclosed = suppliers.filter(s => !s.carbon_disclosure_status || s.carbon_disclosure_status === 'Not Disclosed').length;
  const pct = suppliers.length > 0 ? Math.round(((disclosed + partial * 0.5) / suppliers.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Suppliers', value: suppliers.length, color: 'text-foreground' },
          { label: 'Disclosed', value: disclosed, color: 'text-green-600' },
          { label: 'Partial', value: partial, color: 'text-blue-600' },
          { label: 'Not Disclosed', value: notDisclosed, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Supply Chain Disclosure Coverage</span>
          <span className={`font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">Target: ≥80% supplier disclosure for SECR / TCFD reporting</p>
      </div>

      {notDisclosed > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-sm text-amber-800">{notDisclosed} supplier(s) have not been asked to disclose</span>
          <Button size="sm" variant="outline" onClick={bulkRequest} className="border-amber-300 text-amber-700 hover:bg-amber-100">
            <Mail className="w-3.5 h-3.5 mr-1" />Mark All as Requested
          </Button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-sm">Supplier Carbon Disclosure Status</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="divide-y divide-border">
            {suppliers.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-foreground truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.category || 'General'} · {s.country || 'UK'}{s.declared_scope3_kg_co2e ? ` · ${s.declared_scope3_kg_co2e.toLocaleString()} kg CO₂e declared` : ''}</div>
                </div>
                <Select
                  value={s.carbon_disclosure_status || 'Not Disclosed'}
                  onValueChange={v => updateStatus(s, v)}
                  disabled={updating === s.id}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    {updating === s.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <SelectValue />}
                  </SelectTrigger>
                  <SelectContent>
                    {['Disclosed', 'Partial', 'Requested', 'Not Disclosed'].map(st => (
                      <SelectItem key={st} value={st}><span className={`text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_STYLE[st]}`}>{st}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {suppliers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">No suppliers found. Add suppliers in the Suppliers section.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}