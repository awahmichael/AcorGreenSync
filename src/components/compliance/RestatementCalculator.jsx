import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, Calculator, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { complianceEngine } from '@/lib/rml';

/**
 * RestatementCalculator — Recalculates historic transactions using current
 * product factors, showing the delta vs original reported values.
 * 
 * This leverages the SCD Type 2 versioning system: each transaction line item
 * has applied_version + applied_carbon_coefficient baked in, while current
 * product records hold the latest factors. The calculator compares the two.
 */
export default function RestatementCalculator() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [period, setPeriod] = useState('90');

  useEffect(() => {
    Promise.all([
      base44.entities.Transaction.list('-transaction_date', 500),
      base44.entities.Product.filter({ is_current_version: true }),
    ]).then(([txns, prods]) => {
      setTransactions(txns);
      setProducts(prods);
    }).finally(() => setLoading(false));
  }, []);

  const calculate = async () => {
    setCalculating(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(period));
    const filtered = transactions.filter(t => new Date(t.transaction_date) >= cutoff);

    const res = await complianceEngine.calculateRestatement(filtered, products);
    setResult(res);
    setCalculating(false);
    toast.success(`Restated ${filtered.length} transactions using current factors`);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Emissions Restatement Calculator
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recalculates historic transactions using current carbon factors — shows what would change if factors were applied retroactively.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={calculate} disabled={calculating}>
            {calculating ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Calculator className="w-3.5 h-3.5 mr-1" />}
            Calculate
          </Button>
        </div>
      </div>

      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground">Original (as reported)</div>
              <div className="text-xl font-bold text-foreground mt-1">{result.originalCO2e.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">kg CO₂e</div>
            </div>
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground">Restated (current factors)</div>
              <div className="text-xl font-bold text-foreground mt-1">{result.restatedCO2e.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">kg CO₂e</div>
            </div>
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground">Delta</div>
              <div className={`text-xl font-bold mt-1 ${result.delta < 0 ? 'text-green-600' : result.delta > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {result.delta >= 0 ? '+' : ''}{result.delta.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">kg CO₂e</div>
            </div>
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="text-xs text-muted-foreground">Change %</div>
              <div className={`text-xl font-bold mt-1 ${result.deltaPct < 0 ? 'text-green-600' : result.deltaPct > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {result.deltaPct >= 0 ? '+' : ''}{result.deltaPct.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">{result.restatedCount} of {result.transactionCount} affected</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 flex items-start gap-2">
            <ArrowUpDown className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Historic transactions are <strong>not modified</strong>. They retain their original <code>applied_version</code> and <code>applied_carbon_coefficient</code> values.
              This restatement is for audit reporting purposes only — it shows what emissions <em>would be</em> if current factors were applied retroactively.
            </span>
          </div>

          {/* Details table */}
          {result.details.length > 0 ? (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30">
                <h3 className="font-semibold text-sm">Transactions Affected by Factor Changes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Ref</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Original</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Restated</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.details.slice(0, 50).map((d, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs">{d.transaction_ref}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(d.transaction_date).toLocaleDateString('en-GB')}</td>
                        <td className="px-4 py-3 text-right">{d.original.toFixed(4)}</td>
                        <td className="px-4 py-3 text-right">{d.restated.toFixed(4)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${d.delta < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              No transactions affected by factor changes in this period.
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
          <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Select a period and click Calculate to restate emissions using current carbon factors.
        </div>
      )}
    </div>
  );
}