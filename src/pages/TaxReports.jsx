import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Download, PoundSterling, FileText, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const TAX_RATE_LABELS = {
  20: 'Standard (20%)',
  5: 'Reduced (5%)',
  0: 'Zero-Rated (0%)'
};

export default function TaxReports() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Transaction.list('-transaction_date', 500);
        setTransactions(data || []);
      } catch (err) {
        toast.error('Failed to load transactions');
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
    const date = t.transaction_date.slice(0, 10);
    return date >= fromDate && date <= toDate;
  });

  const byTaxRate = {};
  periodTxns.forEach(t => {
    const rate = t.tax_rate ?? 20;
    if (!byTaxRate[rate]) byTaxRate[rate] = { sales: 0, tax: 0, count: 0 };
    byTaxRate[rate].sales += (t.subtotal || (t.total_amount || 0) - (t.tax_amount || 0));
    byTaxRate[rate].tax += t.tax_amount || 0;
    byTaxRate[rate].count += 1;
  });

  const totalSales = Object.values(byTaxRate).reduce((s, r) => s + r.sales, 0);
  const totalTax = Object.values(byTaxRate).reduce((s, r) => s + r.tax, 0);
  const totalGross = totalSales + totalTax;

  const byPayment = {};
  periodTxns.forEach(t => {
    const method = t.payment_method || 'card';
    if (!byPayment[method]) byPayment[method] = { sales: 0, tax: 0, count: 0 };
    byPayment[method].sales += t.total_amount || 0;
    byPayment[method].tax += t.tax_amount || 0;
    byPayment[method].count += 1;
  });

  const exportVatReturn = () => {
    const rows = [
      ['VAT Return Summary'],
      ['Period', `${fromDate} to ${toDate}`],
      [],
      ['Tax Rate', 'Transaction Count', 'Net Sales (£)', 'VAT Amount (£)', 'Gross (£)']
    ];
    Object.entries(byTaxRate).forEach(([rate, data]) => {
      rows.push([TAX_RATE_LABELS[rate] || `${rate}%`, data.count, data.sales.toFixed(2), data.tax.toFixed(2), (data.sales + data.tax).toFixed(2)]);
    });
    rows.push([]);
    rows.push(['TOTALS', periodTxns.length, totalSales.toFixed(2), totalTax.toFixed(2), totalGross.toFixed(2)]);
    rows.push([]);
    rows.push(['Breakdown by Payment Method']);
    rows.push(['Method', 'Transactions', 'Gross Sales (£)', 'VAT (£)']);
    Object.entries(byPayment).forEach(([method, data]) => {
      rows.push([method, data.count, data.sales.toFixed(2), data.tax.toFixed(2)]);
    });

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-return-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('VAT return exported');
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6 text-primary" /> Tax Reports</h1>
        <p className="text-sm text-muted-foreground">VAT summary of taxes collected via sales. Export for your accountant or HMRC MTD submission.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>Note:</strong> This report shows VAT collected from your sales transactions. Pass this to your accountant for HMRC filing. AcorCloud is a reporting tool, not a tax filing service.
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs font-medium text-muted-foreground">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="block rounded-md border border-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="block rounded-md border border-input px-3 py-2 text-sm" />
        </div>
        <Button variant="outline" onClick={exportVatReturn}><Download className="w-4 h-4" /> Export VAT Return</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileText className="w-4 h-4" /><span className="text-xs font-medium">Transactions</span></div>
          <div className="text-2xl font-bold">{periodTxns.length}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><TrendingUp className="w-4 h-4" /><span className="text-xs font-medium">Net Sales</span></div>
          <div className="text-2xl font-bold">£{totalSales.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><PoundSterling className="w-4 h-4" /><span className="text-xs font-medium">VAT Collected</span></div>
          <div className="text-2xl font-bold text-amber-600">£{totalTax.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Receipt className="w-4 h-4" /><span className="text-xs font-medium">Gross Total</span></div>
          <div className="text-2xl font-bold">£{totalGross.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <h3 className="px-4 py-3 font-semibold border-b border-border">VAT Breakdown by Tax Rate</h3>
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Tax Rate</th><th className="px-4 py-3 font-semibold text-right">Transactions</th>
            <th className="px-4 py-3 font-semibold text-right">Net Sales</th><th className="px-4 py-3 font-semibold text-right">VAT Amount</th>
            <th className="px-4 py-3 font-semibold text-right">Gross</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {Object.entries(byTaxRate).map(([rate, data]) => (
              <tr key={rate} className="hover:bg-muted/20">
                <td className="px-4 py-2.5"><Badge variant="outline">{TAX_RATE_LABELS[rate] || `${rate}%`}</Badge></td>
                <td className="px-4 py-2.5 text-right">{data.count}</td>
                <td className="px-4 py-2.5 text-right">£{data.sales.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-amber-600">£{data.tax.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right font-medium">£{(data.sales + data.tax).toFixed(2)}</td>
              </tr>
            ))}
            {Object.keys(byTaxRate).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No transactions in selected period.</td></tr>
            )}
          </tbody>
          {Object.keys(byTaxRate).length > 0 && (
            <tfoot className="bg-muted/50 font-bold">
              <tr>
                <td className="px-4 py-3">TOTALS</td>
                <td className="px-4 py-3 text-right">{periodTxns.length}</td>
                <td className="px-4 py-3 text-right">£{totalSales.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-amber-600">£{totalTax.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">£{totalGross.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}