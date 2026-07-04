import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Download, PoundSterling, FileText, TrendingUp, FileCheck, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';

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
  const [submittingMtd, setSubmittingMtd] = useState(false);
  const [hmrcResult, setHmrcResult] = useState(null);
  const { organizationId } = useOrganization();

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    (async () => {
      try {
        const data = await base44.entities.Transaction.filter({ organization_id: organizationId }, '-transaction_date', 500);
        setTransactions(data || []);
      } catch (err) {
        toast.error('Failed to load transactions');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

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

  const exportMtdVat = () => {
    const netSales = totalSales;
    const vatDue = totalTax;
    const vatReclaimed = 0;
    const netVat = vatDue - vatReclaimed;
    const euAcquisitions = 0;
    const euSupplies = 0;

    const rows = [
      ['HMRC Making Tax Digital — VAT Return'],
      ['Period', `${fromDate} to ${toDate}`],
      ['Generated', new Date().toLocaleString('en-GB')],
      [],
      ['Box', 'Description', 'Value (£)'],
      ['Box 1', 'VAT due on sales and other outputs', vatDue.toFixed(2)],
      ['Box 2', 'VAT due on acquisitions from EU member states', '0.00'],
      ['Box 3', 'Total VAT due (Box 1 + Box 2)', vatDue.toFixed(2)],
      ['Box 4', 'VAT reclaimed on purchases and other inputs', vatReclaimed.toFixed(2)],
      ['Box 5', 'Net VAT to pay or reclaim (Box 3 - Box 4)', netVat.toFixed(2)],
      ['Box 6', 'Total value of sales and other outputs (excl VAT)', netSales.toFixed(2)],
      ['Box 7', 'Total value of purchases and other inputs (excl VAT)', '0.00'],
      ['Box 8', 'Total value of supplies to EU member states (excl VAT)', euSupplies.toFixed(2)],
      ['Box 9', 'Total value of acquisitions from EU (excl VAT)', euAcquisitions.toFixed(2)],
    ];

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmrc-mtd-vat-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('HMRC MTD 9-box VAT return exported');
  };

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

  const submitToHmrc = async () => {
    setSubmittingMtd(true);
    setHmrcResult(null);
    try {
      const resp = await base44.functions.invoke('submitVatToHmrc', {
        organization_id: organizationId,
        period_start: fromDate,
        period_end: toDate,
        box1: totalTax,
        box2: 0,
        box3: totalTax,
        box4: 0,
        box5: totalTax,
        box6: totalSales,
        box7: 0,
        box8: 0,
        box9: 0,
        finalised: true,
      });
      setHmrcResult(resp.data);
      if (resp.data?.success) {
        toast.success('VAT return submitted to HMRC');
      } else {
        toast.error(resp.data?.error || 'HMRC submission failed');
      }
    } catch (err) {
      setHmrcResult({ success: false, error: err.message });
      toast.error('HMRC submission failed');
    }
    setSubmittingMtd(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6 text-primary" /> Tax Reports</h1>
        <p className="text-sm text-muted-foreground">VAT summary of taxes collected via sales. Export for your accountant or HMRC MTD submission.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>VAT reporting & HMRC MTD:</strong> Export your 9-box VAT return as CSV, or submit directly to HMRC via Making Tax Digital. To submit directly, connect your HMRC account in Settings → HMRC MTD first.
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
        <Button variant="outline" onClick={exportMtdVat}><FileCheck className="w-4 h-4" /> Export HMRC MTD (9-Box)</Button>
        <Button onClick={submitToHmrc} disabled={submittingMtd} className="bg-primary hover:bg-primary/90">
          {submittingMtd ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit to HMRC MTD
        </Button>
      </div>

      {hmrcResult && (
        <div className={`rounded-lg p-4 text-sm ${hmrcResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {hmrcResult.success ? (
            <div>
              <strong>✓ VAT Return Submitted to HMRC</strong><br />
              Processing Date: {hmrcResult.processing_date}<br />
              Form Bundle: {hmrcResult.form_number}<br />
              {hmrcResult.charge_ref && <span>Charge Reference: {hmrcResult.charge_ref}</span>}
            </div>
          ) : (
            <div>
              <strong>✗ HMRC Submission Failed</strong><br />
              {hmrcResult.error}
            </div>
          )}
        </div>
      )}

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