import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, PoundSterling, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function TaxCompliancePanel() {
  const [transactions, setTransactions] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    (async () => {
      try {
        const [txData, orgData] = await Promise.all([
          base44.entities.Transaction.list('-transaction_date', 500),
          base44.entities.Organization.list('-created_date', 500)
        ]);
        setTransactions(txData || []);
        setOrgs(orgData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const periodTxns = transactions.filter(t => {
    if (!t.transaction_date) return false;
    return t.transaction_date.slice(0, 7) === periodMonth;
  });

  const totalSales = periodTxns.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalTax = periodTxns.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
  const taxableSales = totalSales - totalTax;

  const byOrg = {};
  periodTxns.forEach(t => {
    const orgName = orgs.find(o => o.id === t.organization_id)?.name || t.store_name || 'Unassigned';
    if (!byOrg[orgName]) byOrg[orgName] = { sales: 0, tax: 0, count: 0 };
    byOrg[orgName].sales += t.total_amount || 0;
    byOrg[orgName].tax += t.tax_amount || 0;
    byOrg[orgName].count += 1;
  });

  const exportCsv = () => {
    const rows = [['Organization', 'Transaction Ref', 'Date', 'Subtotal', 'Tax Rate', 'Tax Amount', 'Total', 'Payment Status']];
    periodTxns.forEach(t => {
      rows.push([
        orgs.find(o => o.id === t.organization_id)?.name || t.store_name || '',
        t.transaction_ref || '',
        new Date(t.transaction_date).toLocaleString('en-GB'),
        (t.subtotal || 0).toFixed(2),
        (t.tax_rate || 0) + '%',
        (t.tax_amount || 0).toFixed(2),
        (t.total_amount || 0).toFixed(2),
        t.payment_status || ''
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-summary-${periodMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('VAT summary exported');
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Disclaimer:</strong> This is a data aggregation tool for your platform revenue visibility. Tax filing remains the responsibility of each tenant merchant. Exported data should be passed to a certified accountant.
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tax Period</label>
          <input type="month" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)} className="block w-full rounded-md border border-input px-3 py-2 text-sm" />
        </div>
        <Button variant="outline" onClick={exportCsv} className="mt-5"><Download className="w-4 h-4" /> Export VAT Summary</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Receipt className="w-4 h-4" /><span className="text-xs font-medium">Transactions</span></div>
          <div className="text-2xl font-bold">{periodTxns.length}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><PoundSterling className="w-4 h-4" /><span className="text-xs font-medium">Taxable Sales</span></div>
          <div className="text-2xl font-bold">£{taxableSales.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><PoundSterling className="w-4 h-4" /><span className="text-xs font-medium">VAT Collected</span></div>
          <div className="text-2xl font-bold text-amber-600">£{totalTax.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Receipt className="w-4 h-4" /><span className="text-xs font-medium">Gross Sales</span></div>
          <div className="text-2xl font-bold">£{totalSales.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <h3 className="px-4 py-3 font-semibold border-b border-border">VAT Breakdown by Organization</h3>
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Organization</th><th className="px-4 py-3 font-semibold text-right">Transactions</th>
            <th className="px-4 py-3 font-semibold text-right">Taxable Sales</th><th className="px-4 py-3 font-semibold text-right">VAT Collected</th>
            <th className="px-4 py-3 font-semibold text-right">Gross Total</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {Object.entries(byOrg).map(([orgName, data]) => (
              <tr key={orgName} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 font-medium">{orgName}</td>
                <td className="px-4 py-2.5 text-right">{data.count}</td>
                <td className="px-4 py-2.5 text-right">£{(data.sales - data.tax).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-amber-600">£{data.tax.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right font-medium">£{data.sales.toFixed(2)}</td>
              </tr>
            ))}
            {Object.keys(byOrg).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No transactions in this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}