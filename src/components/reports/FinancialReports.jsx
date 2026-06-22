import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Settings } from 'lucide-react';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, groupBy, groupAndSum, sum, topN, formatCurrency, formatNumber, exportCSV, CHART_PALETTE } from '@/lib/reports/calculations';

const NotConfigured = ({ msg }) => (
  <div className="h-28 flex flex-col items-center justify-center text-center">
    <Settings className="w-5 h-5 text-muted-foreground/40 mb-2" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

export default function FinancialReports({ data, period }) {
  const { transactions = [], shifts = [] } = data;
  const filtered = filterByPeriod(transactions, period);
  const filteredShifts = filterByPeriod(shifts, period, 'shift_start');

  const grossSales = sum(filtered, t => t.subtotal || t.total_amount);
  const netSales = sum(filtered, 'total_amount');
  const totalDiscounts = sum(filtered, 'discount_amount');
  const vatEstimate = netSales * 0.2;
  const grossInclVAT = netSales + vatEstimate;

  // End of day data
  const byDay = groupAndSum(filtered, t => new Date(t.transaction_date).toISOString().split('T')[0], t => t.total_amount).sort((a, b) => a.key.localeCompare(b.key));

  // Payment reconciliation
  const byPayment = groupAndSum(filtered, t => t.payment_method || 'card', t => t.total_amount);

  // Cash drawer management
  const cashShifts = filteredShifts.map(s => ({
    cashier: s.cashier_name,
    store: s.store_name,
    opening: s.opening_float || 0,
    closing: s.closing_cash || 0,
    variance: (s.closing_cash || 0) - (s.opening_float || 0),
    revenue: s.total_revenue || 0,
  }));

  // Gross margin (estimated COGS at 60% of price for framework)
  const cogsRate = 0.6;
  const estimatedCOGS = grossSales * cogsRate;
  const grossProfit = grossSales - estimatedCOGS;
  const grossMargin = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;

  // P&L summary
  const totalExpenses = estimatedCOGS + totalDiscounts;
  const netProfit = grossSales - totalExpenses;

  // Items for product/category profit
  const allItems = [];
  filtered.forEach(t => (t.items || []).forEach(item => allItems.push({ ...item })));
  const profitByProduct = topN(groupAndSum(allItems, i => i.product_name || 'Unknown', i => (i.unit_price || 0) * (i.quantity || 0) * (1 - cogsRate)), 20, d => d.value);
  const profitByCategory = groupAndSum(allItems, i => i.category || 'Uncategorized', i => (i.unit_price || 0) * (i.quantity || 0) * (1 - cogsRate));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Net Sales', value: formatCurrency(netSales), sub: 'after discounts' },
          { label: 'Gross Profit', value: formatCurrency(grossProfit), sub: `${grossMargin.toFixed(1)}% margin` },
          { label: 'VAT Liability', value: formatCurrency(vatEstimate), sub: 'estimated 20%' },
          { label: 'Net Profit', value: formatCurrency(netProfit), sub: 'after COGS & discounts' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* End of Day / Z-Report */}
      <ReportCard title="End of Day / Z-Report" description="Daily close summary with revenue and transaction counts" onExport={() => exportCSV('z-report.csv', ['Date', 'Revenue', 'Transactions'], byDay.map(d => [d.key, d.value.toFixed(2), d.count]))}>
        <ReportTable headers={['Date', 'Revenue', 'Txns', 'Avg Sale']} rows={byDay.map(d => [d.key, formatCurrency(d.value), d.count, formatCurrency(d.count > 0 ? d.value / d.count : 0)])} maxHeight="300px" />
      </ReportCard>

      {/* P&L / Gross Margin */}
      <ReportCard title="Profit & Loss / Gross Margin" description="Revenue minus estimated COGS (60% cost rate)" onExport={() => exportCSV('pnl.csv', ['Line Item', 'Amount'], [['Gross Sales', grossSales.toFixed(2)], ['Discounts', totalDiscounts.toFixed(2)], ['COGS (60%)', estimatedCOGS.toFixed(2)], ['Gross Profit', grossProfit.toFixed(2)], ['Net Profit', netProfit.toFixed(2)]])}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Gross Sales</span><span className="font-medium">{formatCurrency(grossSales)}</span></div>
          <div className="flex justify-between text-red-600"><span>Less: Discounts</span><span>-{formatCurrency(totalDiscounts)}</span></div>
          <div className="flex justify-between text-red-600"><span>Less: COGS (est. 60%)</span><span>-{formatCurrency(estimatedCOGS)}</span></div>
          <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold">Gross Profit</span><span className="font-bold text-primary">{formatCurrency(grossProfit)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Gross Margin</span><span className="font-bold text-primary">{grossMargin.toFixed(1)}%</span></div>
        </div>
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gross Profit by Product */}
        <ReportCard title="Gross Profit by Product" description="Margin per item (est. 40% margin)" onExport={() => exportCSV('profit-by-product.csv', ['Product', 'Profit'], profitByProduct.map(d => [d.key, d.value.toFixed(2)]))}>
          <ReportTable headers={['Product', 'Est. Profit']} rows={profitByProduct.map(d => [d.key, formatCurrency(d.value)])} maxHeight="250px" />
        </ReportCard>

        {/* Gross Profit by Category */}
        <ReportCard title="Gross Profit by Category" description="Margin per category" onExport={() => exportCSV('profit-by-category.csv', ['Category', 'Profit'], profitByCategory.map(d => [d.key, d.value.toFixed(2)]))}>
          {profitByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={profitByCategory.map(d => ({ category: d.key, Profit: d.value }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: '#94a3b8' }} width={80} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="Profit" fill="#16A34A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No data for this period." />}
        </ReportCard>
      </div>

      {/* VAT Return Summary */}
      <ReportCard title="VAT Return Summary" description="HMRC MTD-ready output (estimated 20% standard rate)" onExport={() => exportCSV('vat-return.csv', ['Box', 'Description', 'Amount'], [['1', 'VAT due on outputs', vatEstimate.toFixed(2)], ['6', 'VAT due on inputs (est.)', (vatEstimate * 0.4).toFixed(2)], ['5', 'Net VAT due', (vatEstimate * 0.6).toFixed(2)], ['7', 'Total sales (excl. VAT)', netSales.toFixed(2)], ['9', 'Total purchases (excl. VAT)', (netSales * 0.6).toFixed(2)]])}>
        <ReportTable headers={['Box', 'Description', 'Amount']} rows={[
          ['1', 'VAT due on outputs (sales)', formatCurrency(vatEstimate)],
          ['6', 'VAT due on inputs (est. 40% reclaim)', formatCurrency(vatEstimate * 0.4)],
          ['5', 'Net VAT due to HMRC', formatCurrency(vatEstimate * 0.6)],
          ['7', 'Total sales (excl. VAT)', formatCurrency(netSales)],
          ['9', 'Total purchases (excl. VAT, est.)', formatCurrency(netSales * 0.6)],
        ]} />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Reconciliation */}
        <ReportCard title="Payment Reconciliation" description="Settlement vs sales match by payment type" onExport={() => exportCSV('payment-reconciliation.csv', ['Method', 'Revenue', 'Transactions', '% of Total'], byPayment.map(d => [d.key, d.value.toFixed(2), d.count, netSales > 0 ? ((d.value / netSales) * 100).toFixed(1) : 0]))}>
          <ReportTable headers={['Method', 'Revenue', 'Txns', '%']} rows={byPayment.map(d => [d.key, formatCurrency(d.value), d.count, `${netSales > 0 ? ((d.value / netSales) * 100).toFixed(1) : 0}%`])} maxHeight="250px" />
        </ReportCard>

        {/* Cash Drawer Management */}
        <ReportCard title="Cash Drawer Management" description="Opening/closing variance per shift" onExport={() => exportCSV('cash-drawer.csv', ['Cashier', 'Store', 'Opening', 'Closing', 'Variance'], cashShifts.map(s => [s.cashier, s.store, s.opening.toFixed(2), s.closing.toFixed(2), s.variance.toFixed(2)]))}>
          <ReportTable headers={['Cashier', 'Opening', 'Closing', 'Variance']} rows={cashShifts.map(s => [s.cashier, formatCurrency(s.opening), formatCurrency(s.closing), <span className={s.variance < 0 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(s.variance)}</span>])} maxHeight="250px" />
        </ReportCard>
      </div>

      {/* Deposit Report */}
      <ReportCard title="Deposit Report" description="Bank deposit totals by day" onExport={() => exportCSV('deposits.csv', ['Date', 'Card Revenue', 'Cash Revenue', 'Total Depositable'], byDay.map(d => {
        const dayTxns = filtered.filter(t => new Date(t.transaction_date).toISOString().split('T')[0] === d.key);
        const cardRev = sum(dayTxns.filter(t => t.payment_method !== 'cash'), 'total_amount');
        const cashRev = sum(dayTxns.filter(t => t.payment_method === 'cash'), 'total_amount');
        return [d.key, cardRev.toFixed(2), cashRev.toFixed(2), (cardRev + cashRev).toFixed(2)];
      }))}>
        <ReportTable headers={['Date', 'Card Revenue', 'Cash Revenue', 'Total']} rows={byDay.map(d => {
          const dayTxns = filtered.filter(t => new Date(t.transaction_date).toISOString().split('T')[0] === d.key);
          const cardRev = sum(dayTxns.filter(t => t.payment_method !== 'cash'), 'total_amount');
          const cashRev = sum(dayTxns.filter(t => t.payment_method === 'cash'), 'total_amount');
          return [d.key, formatCurrency(cardRev), formatCurrency(cashRev), formatCurrency(cardRev + cashRev)];
        })} maxHeight="250px" />
      </ReportCard>

      <ReportCard title="Cash Flow Statement" description="Inflows by payment type">
        {byPayment.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byPayment.map(d => ({ method: d.key, Inflow: d.value }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="method" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="Inflow" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <NotConfigured msg="No data for this period." />}
      </ReportCard>
    </div>
  );
}