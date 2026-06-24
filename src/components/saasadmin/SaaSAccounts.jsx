import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Plus, Download, DollarSign, TrendingUp, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import PLStatement from '@/components/saasadmin/PLStatement';
import VatByOrg from '@/components/saasadmin/VatByOrg';
import ExpensesManager from '@/components/saasadmin/ExpensesManager';
import ExpenseModal from '@/components/saasadmin/ExpenseModal';

const FISCAL_YEARS = [
  { label: 'FY 2026/27 (1 Apr 2026 – 31 Mar 2027)', start: '2026-04-01', end: '2027-03-31' },
  { label: 'FY 2025/26 (1 Apr 2025 – 31 Mar 2026)', start: '2025-04-01', end: '2026-03-31' },
  { label: 'FY 2024/25 (1 Apr 2024 – 31 Mar 2025)', start: '2024-04-01', end: '2025-03-31' },
];

export default function SaaSAccounts() {
  const [activeTab, setActiveTab] = useState('pl');
  const [fiscalYear, setFiscalYear] = useState(FISCAL_YEARS[0]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txns, exps, pos, orgs] = await Promise.all([
        base44.entities.Transaction.list('-transaction_date', 5000),
        base44.entities.Expense.list('-date', 500),
        base44.entities.PurchaseOrder.list('-order_date', 500),
        base44.entities.Organization.list('-created_date', 500)
      ]);
      setTransactions(txns || []);
      setExpenses(exps || []);
      setPurchaseOrders(pos || []);
      setOrganizations(orgs || []);
    } catch (err) {
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const isInFiscalYear = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= new Date(fiscalYear.start) && d <= new Date(fiscalYear.end);
  };

  const filteredTxns = transactions.filter(t => isInFiscalYear(t.transaction_date));
  const filteredExpenses = expenses.filter(e => isInFiscalYear(e.date));
  const filteredPOs = purchaseOrders.filter(po => po.received_date && isInFiscalYear(po.received_date));

  const computeFinancials = () => {
    const turnover = filteredTxns.reduce((s, t) => s + (t.subtotal || 0), 0);
    const orderCount = filteredTxns.length;
    const stockPurchased = filteredPOs.reduce((s, po) => s + (po.subtotal || 0), 0);
    const freightIn = filteredPOs.reduce((s, po) => s + (po.shipping_cost || 0) + (po.duty_cost || 0), 0);
    const packaging = filteredExpenses.filter(e => e.category === 'packaging').reduce((s, e) => s + (e.amount || 0), 0);
    const totalCOGS = stockPurchased + freightIn + packaging;
    const grossProfit = turnover - totalCOGS;
    const deliveryToCustomers = filteredExpenses.filter(e => e.category === 'delivery_to_customers').reduce((s, e) => s + (e.amount || 0), 0);
    const platformFees = filteredExpenses.filter(e => e.category === 'platform_fees').reduce((s, e) => s + (e.amount || 0), 0);
    const marketing = filteredExpenses.filter(e => e.category === 'marketing').reduce((s, e) => s + (e.amount || 0), 0);
    const officeAdmin = filteredExpenses.filter(e => e.category === 'office_admin').reduce((s, e) => s + (e.amount || 0), 0);
    const otherExpenses = filteredExpenses.filter(e => e.category === 'other').reduce((s, e) => s + (e.amount || 0), 0);
    const totalOpEx = deliveryToCustomers + platformFees + marketing + officeAdmin + otherExpenses;
    const operatingProfit = grossProfit - totalOpEx;
    const corpTaxRate = 0.19;
    const corpTax = Math.max(0, operatingProfit) * corpTaxRate;
    const profitAfterTax = operatingProfit - corpTax;
    const operatingMargin = turnover > 0 ? (operatingProfit / turnover * 100) : 0;
    const outputVat = filteredTxns.reduce((s, t) => s + (t.tax_amount || 0), 0);
    const inputVat = filteredExpenses.filter(e => e.is_vat_reclaimable).reduce((s, e) => s + (e.vat_amount || 0), 0);
    const netVat = outputVat - inputVat;
    return { turnover, orderCount, stockPurchased, freightIn, packaging, totalCOGS, grossProfit, deliveryToCustomers, platformFees, marketing, officeAdmin, otherExpenses, totalOpEx, operatingProfit, corpTaxRate, corpTax, profitAfterTax, operatingMargin, outputVat, inputVat, netVat };
  };

  const fin = computeFinancials();

  const handleExport = () => {
    const csv = [
      'Accounts Export',
      `Fiscal Year,${fiscalYear.label}`,
      '',
      'PROFIT & LOSS STATEMENT',
      '',
      `Turnover (Net Sales),${fin.turnover.toFixed(2)}`,
      `,${fin.orderCount} orders`,
      '',
      'COST OF GOODS SOLD',
      `Stock / Goods Purchased,${-fin.stockPurchased.toFixed(2)}`,
      `Freight In (Import / Delivery of Stock),${-fin.freightIn.toFixed(2)}`,
      `Packaging,${-fin.packaging.toFixed(2)}`,
      `Gross Profit,${fin.grossProfit.toFixed(2)}`,
      '',
      'ADMINISTRATIVE & OPERATING EXPENSES',
      `Delivery to Customers,${-fin.deliveryToCustomers.toFixed(2)}`,
      `Platform / Transaction Fees,${-fin.platformFees.toFixed(2)}`,
      `Marketing,${-fin.marketing.toFixed(2)}`,
      `Office & Admin,${-fin.officeAdmin.toFixed(2)}`,
      `Other Expenses,${-fin.otherExpenses.toFixed(2)}`,
      `Operating Profit (Profit Before Tax),${fin.operatingProfit.toFixed(2)}`,
      '',
      'TAXATION',
      `Corporation Tax (${(fin.corpTaxRate * 100).toFixed(0)}%),${-fin.corpTax.toFixed(2)}`,
      `Profit After Tax,${fin.profitAfterTax.toFixed(2)}`,
      '',
      'VAT SUMMARY',
      `Output VAT (on sales),${fin.outputVat.toFixed(2)}`,
      `Input VAT (on purchases - reclaimable),${fin.inputVat.toFixed(2)}`,
      `Net VAT Position,${fin.netVat.toFixed(2)}`
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts-${fiscalYear.label.split(' ')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-neutral-700 border-t-orange-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="bg-neutral-900 rounded-xl p-6 space-y-5 text-white">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Accounts</h2>
          <p className="text-sm text-neutral-400">Limited Company · VAT Registered · Corporation Tax</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={fiscalYear.label} onValueChange={(v) => setFiscalYear(FISCAL_YEARS.find(fy => fy.label === v))}>
            <SelectTrigger className="w-72 bg-neutral-800 border-neutral-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FISCAL_YEARS.map(fy => <SelectItem key={fy.label} value={fy.label}>{fy.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} className="border-neutral-600 text-white hover:bg-neutral-800"><Download className="w-4 h-4" /> Export CSV</Button>
          <Button onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }} className="bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4" /> Add Expense</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-700">
        <button onClick={() => setActiveTab('pl')} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'pl' ? 'border-orange-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}>P&L Summary</button>
        <button onClick={() => setActiveTab('vat')} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'vat' ? 'border-orange-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}>VAT & Tax</button>
        <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'expenses' ? 'border-orange-500 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}>Expenses ({filteredExpenses.length})</button>
      </div>

      {activeTab === 'pl' && <PLStatement fin={fin} />}
      {activeTab === 'vat' && <VatByOrg transactions={filteredTxns} organizations={organizations} />}
      {activeTab === 'expenses' && <ExpensesManager expenses={filteredExpenses} onReload={loadData} />}

      {showExpenseModal && <ExpenseModal expense={editingExpense} onClose={() => setShowExpenseModal(false)} onSaved={loadData} />}
    </div>
  );
}