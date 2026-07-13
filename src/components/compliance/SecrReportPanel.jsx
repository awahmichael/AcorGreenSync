import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { FileDown, Loader2, ShieldCheck, FileText, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SecrReportPanel() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);

  const load = () => {
    setLoading(true);
    base44.entities.ReportingPeriod.filter({ status: 'locked' }, '-period_start').then(setPeriods).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const generateReport = async (period) => {
    setGenerating(period.id);
    try {
      const response = await fetch(`/api/functions/generateSecrReport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_id: period.id }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SECR_Report_${period.label || period.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(`SECR Regulatory Pack downloaded for ${period.label}`, { duration: 4000 });
    } catch (err) {
      toast.error(`Failed to generate report: ${err.message}`);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <span className="text-green-400 font-medium">SECR Regulatory Pack</span> — Generate a Streamlined Energy and Carbon
          Reporting (SECR) compliant PDF from any sealed reporting period. Each pack includes the full emissions summary,
          top product breakdown, audit trail metadata, and the SHA-256 integrity hash for independent auditor verification.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Sealed Periods — Available for Export</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading sealed periods...</div>
        ) : periods.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No sealed periods found</p>
            <p className="text-xs text-muted-foreground mt-1">Seal a reporting period in the Period Lock tab first, then return here to generate a regulatory pack.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {periods.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{p.label}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                      🔒 Sealed
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.period_start} → {p.period_end}
                    {p.total_transactions != null && <> · {p.total_transactions} transactions</>}
                    {p.total_kg_co2e != null && <> · {p.total_kg_co2e.toFixed(2)} kg CO₂e</>}
                    {p.total_revenue != null && <> · £{p.total_revenue.toFixed(0)}</>}
                  </div>
                  {p.data_hash && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 font-mono">
                      <ShieldCheck className="w-3 h-3 text-green-600" />
                      <span className="text-green-700">SHA-256:</span>
                      <code className="text-slate-600">{p.data_hash.substring(0, 40)}…</code>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => generateReport(p)}
                  disabled={generating === p.id}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {generating === p.id ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {generating === p.id ? 'Generating...' : 'Generate SECR Pack'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-800">
        <div className="font-medium mb-1 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          What's included in the pack?
        </div>
        <ul className="space-y-0.5 text-green-700 ml-5 list-disc">
          <li>Organization details and VAT registration</li>
          <li>Scope 3 emissions summary (Category 1 upstream + Category 11 downstream)</li>
          <li>Top 15 products by carbon impact</li>
          <li>SHA-256 integrity hash for auditor verification</li>
          <li>Full audit trail metadata (cashier IDs, store IDs, manager overrides)</li>
          <li>GHG Protocol / DEFRA methodology reference</li>
        </ul>
      </div>
    </div>
  );
}