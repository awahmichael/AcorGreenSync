import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Building2, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

function toCSV(data, headers) {
  const rows = data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AccountingExport() {
  const [transactions, setTransactions] = useState([]);
  const [returns, setReturns] = useState([]);
  [base44.entities.PurchaseOrder, base44.entities.Invoice];
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    Promise.all([
      base44.entities.Transaction.list('-transaction_date', 500),
      base44.entities.Return.list('-return_date', 200),
      base44.entities.PurchaseOrder.list('-order_date', 200),
      base44.entities.Invoice.list('-issue_date', 200),
    ]).then(([txns, rets, pos, invs]) => { setTransactions(txns); setReturns(rets); setPurchaseOrders(pos); setInvoices(invs); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const periodDays = parseInt(period);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - periodDays);
  const periodTxns = transactions.filter(t => new Date(t.transaction_date) >= cutoff);
  const periodReturns = returns.filter(r => new Date(r.return_date) >= cutoff);
  const periodPOs = purchaseOrders.filter(p => new Date(p.order_date) >= cutoff);
  const periodInvoices = invoices.filter(i => new Date(i.issue_date) >= cutoff);

  const exports = [
    { id: 'sales', label: 'Sales Transactions', icon: DollarSign, color: 'text-green-600 bg-green-50', count: periodTxns.length, desc: 'Daily sales summary with payment method, subtotal, discounts, and totals', data: periodTxns.map(t => ({ date: t.transaction_date?.split('T')[0], ref: t.transaction_ref, customer: t.customer_name || '', payment_method: t.payment_method, subtotal: t.subtotal?.toFixed(2), discount: (t.discount_amount || 0).toFixed(2), total: t.total_amount?.toFixed(2), cogs: (t.total_cogs || 0).toFixed(2), co2e: (t.total_kg_co2e || 0).toFixed(3) })), headers: ['date', 'ref', 'customer', 'payment_method', 'subtotal', 'discount', 'total', 'cogs', 'co2e'] },
    { id: 'returns', label: 'Returns & Refunds', icon: FileSpreadsheet, color: 'text-red-600 bg-red-50', count: periodReturns.length, desc: 'All returns with refund amounts and carbon reversals', data: periodReturns.map(r => ({ date: r.return_date?.split('T')[0], ref: r.return_ref, original_txn: r.original_transaction_ref, reason: r.reason, method: r.refund_method, refund: (r.refund_amount || 0).toFixed(2), co2e_reversal: (r.carbon_reversal_kg_co2e || 0).toFixed(3) })), headers: ['date', 'ref', 'original_txn', 'reason', 'method', 'refund', 'co2e_reversal'] },
    { id: 'pos', label: 'Purchase Orders', icon: Building2, color: 'text-blue-600 bg-blue-50', count: periodPOs.length, desc: 'PO summary with supplier, landed costs, and status', data: periodPOs.map(p => ({ date: p.order_date?.split('T')[0], ref: p.po_ref, supplier: p.supplier_name, store: p.store_name, status: p.status, subtotal: (p.subtotal || 0).toFixed(2), shipping: (p.shipping_cost || 0).toFixed(2), duty: (p.duty_cost || 0).toFixed(2), insurance: (p.insurance_cost || 0).toFixed(2), landed_cost: (p.landed_cost_total || 0).toFixed(2) })), headers: ['date', 'ref', 'supplier', 'store', 'status', 'subtotal', 'shipping', 'duty', 'insurance', 'landed_cost'] },
    { id: 'invoices', label: 'B2B Invoices', icon: FileSpreadsheet, color: 'text-purple-600 bg-purple-50', count: periodInvoices.length, desc: 'Invoice summary with VAT, payment status, and balances', data: periodInvoices.map(i => ({ issue_date: i.issue_date, due_date: i.due_date || '', ref: i.invoice_ref, customer: i.customer_name, subtotal: (i.subtotal || 0).toFixed(2), vat: (i.tax_amount || 0).toFixed(2), total: (i.total_amount || 0).toFixed(2), paid: (i.amount_paid || 0).toFixed(2), balance: (i.balance_due || 0).toFixed(2), status: i.status })), headers: ['issue_date', 'due_date', 'ref', 'customer', 'subtotal', 'vat', 'total', 'paid', 'balance', 'status'] },
  ];

  const handleExport = (exp) => {
    if (exp.data.length === 0) { toast.error('No data to export for this period'); return; }
    const csv = toCSV(exp.data, exp.headers);
    downloadCSV(csv, `${exp.id}-export-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`${exp.label} exported (${exp.data.length} records)`);
  };

  const handleExportAll = () => {
    exports.forEach(exp => { if (exp.data.length > 0) { const csv = toCSV(exp.data, exp.headers); downloadCSV(csv, `${exp.id}-export-${new Date().toISOString().split('T')[0]}.csv`); } });
    toast.success('All reports exported');
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Accounting Export</h1><p className="text-sm text-muted-foreground mt-0.5">Export financial data to CSV for Xero, QuickBooks, or Sage import</p></div>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
          </select>
          <Button onClick={handleExportAll} disabled={loading} className="bg-primary hover:bg-primary/90"><Download className="w-4 h-4 mr-2" />Export All</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exports.map(exp => { const Icon = exp.icon; return (
          <div key={exp.id} className="bg-white border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${exp.color}`}><Icon className="w-5 h-5" /></div><div><div className="font-semibold text-foreground">{exp.label}</div><div className="text-xs text-muted-foreground">{exp.desc}</div></div></div>
              <span className="text-xs font-medium bg-muted/50 px-2 py-1 rounded-full text-muted-foreground">{exp.count} records</span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => handleExport(exp)} disabled={exp.count === 0}><Download className="w-3.5 h-3.5 mr-1.5" />Export CSV</Button>
          </div>
        ); })}
      </div>
      <div className="mt-6 bg-muted/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-primary" /><span className="text-sm font-semibold">Export Format</span></div>
        <p className="text-xs text-muted-foreground">CSV files compatible with Xero, QuickBooks Online, Sage 50, and FreeAgent. Each export includes headers and properly escaped values. Import as bank statements, bills, or invoices depending on your accounting software.</p>
      </div>
    </div>
  );
}