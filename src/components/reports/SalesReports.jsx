import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Settings } from 'lucide-react';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, flattenItems, groupBy, groupAndSum, sum, topN, getHour, getDayName, getDateKey, getMonthKey, getYear, formatCurrency, formatNumber, exportCSV, getItemRevenue, CHART_PALETTE } from '@/lib/reports/calculations';

const NotConfigured = ({ msg }) => (
  <div className="h-28 flex flex-col items-center justify-center text-center">
    <Settings className="w-5 h-5 text-muted-foreground/40 mb-2" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

export default function SalesReports({ data, period }) {
  const { transactions, products, suppliers } = data;
  const filtered = filterByPeriod(transactions, period);
  const items = flattenItems(filtered);

  const productMap = {}; (products || []).forEach(p => productMap[p.id] = p);
  const supplierMap = {}; (suppliers || []).forEach(s => supplierMap[s.id] = s.name);

  const grossSales = sum(filtered, t => t.subtotal || t.total_amount);
  const netSales = sum(filtered, 'total_amount');
  const totalDiscounts = sum(filtered, 'discount_amount');
  const txnCount = filtered.length;
  const aov = txnCount ? netSales / txnCount : 0;
  const totalUnits = sum(items, i => i.quantity || 0);
  const upt = txnCount ? totalUnits / txnCount : 0;

  const dailyData = groupAndSum(filtered, t => getDateKey(t.transaction_date), t => t.total_amount)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(d => ({ date: d.key.split('-').slice(1).join('/'), Revenue: d.value }));

  const byProduct = topN(groupAndSum(items, i => i.product_name || 'Unknown', i => getItemRevenue(i)), 50, d => d.value);
  const byCategory = groupAndSum(items, i => i.category || 'Uncategorized', i => getItemRevenue(i));
  const byStaff = topN(groupAndSum(filtered, t => t.cashier_name || 'Unknown', t => t.total_amount), 20, d => d.value);
  const byPayment = groupAndSum(filtered, t => t.payment_method || 'card', t => t.total_amount);
  const byCustomer = topN(groupAndSum(filtered, t => t.customer_name || 'Walk-in', t => t.total_amount), 20, d => d.value);
  const byStore = groupAndSum(filtered, t => t.store_name || 'Unknown', t => t.total_amount);
  const byVendor = topN(groupAndSum(items, i => {
    const p = productMap[i.product_id];
    return (p?.supplier_id && supplierMap[p.supplier_id]) || 'Unknown';
  }, i => getItemRevenue(i)), 20, d => d.value);

  const hourData = [];
  for (let h = 0; h < 24; h++) {
    const ht = filtered.filter(t => getHour(t.transaction_date) === h);
    if (ht.length) hourData.push({ hour: `${h}:00`, Revenue: sum(ht, 'total_amount') });
  }
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayGroups = groupBy(filtered, t => getDayName(t.transaction_date));
  const dayData = dayOrder.map(d => ({ day: d, Revenue: sum(dayGroups[d] || [], 'total_amount') }));

  const topProducts = topN(groupAndSum(items, i => i.product_name || 'Unknown', i => i.quantity || 0), 10, d => d.value);

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const allTimeTxns = filterByPeriod(transactions, 730);
  const yoyData = Array.from({ length: 12 }, (_, m) => {
    const mk = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
    const pk = `${prevYear}-${String(m + 1).padStart(2, '0')}`;
    return {
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
      [String(currentYear)]: sum(allTimeTxns.filter(t => getMonthKey(t.transaction_date) === mk), 'total_amount'),
      [String(prevYear)]: sum(allTimeTxns.filter(t => getMonthKey(t.transaction_date) === pk), 'total_amount'),
    };
  });

  const vatEstimate = netSales * 0.2;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Gross Sales', value: formatCurrency(grossSales), sub: `${txnCount} transactions` },
          { label: 'Net Sales', value: formatCurrency(netSales), sub: `after discounts` },
          { label: 'Avg Order Value', value: formatCurrency(aov), sub: 'per transaction' },
          { label: 'Units / Transaction', value: upt.toFixed(1), sub: `${formatNumber(totalUnits)} units sold` },
          { label: 'Total Discounts', value: formatCurrency(totalDiscounts), sub: `${grossSales > 0 ? ((totalDiscounts / grossSales) * 100).toFixed(1) : 0}% of gross` },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Sales Over Time */}
      <ReportCard title="Sales Over Time" description="Daily revenue trend" onExport={() => exportCSV('sales-over-time.csv', ['Date', 'Revenue'], dailyData.map(d => [d.date, d.Revenue.toFixed(2)]))}>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Line type="monotone" dataKey="Revenue" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <NotConfigured msg="No sales data for this period." />}
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales by Hour */}
        <ReportCard title="Sales by Hour" description="Peak trading hours" onExport={() => exportCSV('sales-by-hour.csv', ['Hour', 'Revenue'], hourData.map(d => [d.hour, d.Revenue.toFixed(2)]))}>
          {hourData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="Revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No data for this period." />}
        </ReportCard>

        {/* Sales by Day of Week */}
        <ReportCard title="Sales by Day of Week" description="Revenue by weekday" onExport={() => exportCSV('sales-by-dow.csv', ['Day', 'Revenue'], dayData.map(d => [d.day, d.Revenue.toFixed(2)]))}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportCard>
      </div>

      {/* Sales Year-over-Year */}
      <ReportCard title="Sales Year-over-Year" description={`${currentYear} vs ${prevYear} monthly comparison`} onExport={() => exportCSV('sales-yoy.csv', ['Month', String(currentYear), String(prevYear)], yoyData.map(d => [d.month, d[currentYear].toFixed(2), d[prevYear].toFixed(2)]))}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={yoyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => formatCurrency(v)} />
            <Legend />
            <Bar dataKey={String(currentYear)} fill="#16A34A" radius={[4, 4, 0, 0]} />
            <Bar dataKey={String(prevYear)} fill="#86EFAC" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales by Category */}
        <ReportCard title="Sales by Category" description="Revenue distribution across product categories" onExport={() => exportCSV('sales-by-category.csv', ['Category', 'Revenue'], byCategory.map(d => [d.key, d.value.toFixed(2)]))}>
          {byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={byCategory.map(d => ({ name: d.key, value: d.value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={e => e.name}>
                  {byCategory.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No data for this period." />}
        </ReportCard>

        {/* Top Selling Products */}
        <ReportCard title="Top Selling Products" description="Best sellers by unit volume" onExport={() => exportCSV('top-products.csv', ['Product', 'Units Sold'], topProducts.map(d => [d.key, d.value]))}>
          <ReportTable headers={['Product', 'Units', 'Revenue']} rows={topProducts.map(d => [d.key, formatNumber(d.value), formatCurrency(groupAndSum(items, i => i.product_name, i => getItemRevenue(i)).find(p => p.key === d.key)?.value || 0)])} />
        </ReportCard>
      </div>

      {/* Sales by Product */}
      <ReportCard title="Sales by Product" description="Full product-level revenue breakdown" onExport={() => exportCSV('sales-by-product.csv', ['Product', 'Revenue', 'Transactions'], byProduct.map(d => [d.key, d.value.toFixed(2), d.count]))}>
        <ReportTable headers={['Product', 'Revenue', 'Txns']} rows={byProduct.map(d => [d.key, formatCurrency(d.value), d.count])} maxHeight="300px" />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales by Staff */}
        <ReportCard title="Sales by Staff Member" description="Per-cashier revenue" onExport={() => exportCSV('sales-by-staff.csv', ['Staff', 'Revenue', 'Transactions'], byStaff.map(d => [d.key, d.value.toFixed(2), d.count]))}>
          <ReportTable headers={['Staff', 'Revenue', 'Txns']} rows={byStaff.map(d => [d.key, formatCurrency(d.value), d.count])} maxHeight="250px" />
        </ReportCard>

        {/* Sales by Payment Method */}
        <ReportCard title="Sales by Payment Method" description="Revenue split by payment type" onExport={() => exportCSV('sales-by-payment.csv', ['Method', 'Revenue'], byPayment.map(d => [d.key, d.value.toFixed(2)]))}>
          {byPayment.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byPayment.map(d => ({ name: d.key, value: d.value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={e => `${e.name}`}>
                  {byPayment.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No data for this period." />}
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales by Customer */}
        <ReportCard title="Sales by Customer" description="Top spenders" onExport={() => exportCSV('sales-by-customer.csv', ['Customer', 'Revenue', 'Transactions'], byCustomer.map(d => [d.key, d.value.toFixed(2), d.count]))}>
          <ReportTable headers={['Customer', 'Revenue', 'Txns']} rows={byCustomer.map(d => [d.key, formatCurrency(d.value), d.count])} maxHeight="250px" />
        </ReportCard>

        {/* Sales by Store */}
        <ReportCard title="Sales by Store Location" description="Multi-store revenue comparison" onExport={() => exportCSV('sales-by-store.csv', ['Store', 'Revenue', 'Transactions'], byStore.map(d => [d.key, d.value.toFixed(2), d.count]))}>
          {byStore.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStore.map(d => ({ store: d.key, Revenue: d.value }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="store" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="Revenue" fill="#16A34A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No data for this period." />}
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales by Vendor */}
        <ReportCard title="Sales by Vendor / Brand" description="Revenue grouped by supplier brand" onExport={() => exportCSV('sales-by-vendor.csv', ['Vendor', 'Revenue', 'Transactions'], byVendor.map(d => [d.key, d.value.toFixed(2), d.count]))}>
          <ReportTable headers={['Vendor', 'Revenue', 'Items']} rows={byVendor.map(d => [d.key, formatCurrency(d.value), d.count])} maxHeight="250px" />
        </ReportCard>

        {/* VAT Estimate */}
        <ReportCard title="Sales Tax / VAT Report" description="Estimated 20% VAT on net sales" onExport={() => exportCSV('vat-report.csv', ['Metric', 'Amount'], [['Net Sales', netSales.toFixed(2)], ['Estimated VAT (20%)', vatEstimate.toFixed(2)], ['Gross (incl. VAT)', (netSales + vatEstimate).toFixed(2)]])}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Net Sales (excl. VAT)</span><span className="font-medium">{formatCurrency(netSales)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estimated VAT (20%)</span><span className="font-medium text-primary">{formatCurrency(vatEstimate)}</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Gross (incl. VAT)</span><span className="font-bold">{formatCurrency(netSales + vatEstimate)}</span></div>
          </div>
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportCard title="Sales by Product Variant" description="Breakdown by size/colour/variant">
          <NotConfigured msg="Variant tracking not configured. Add variant fields to Product entity to enable." />
        </ReportCard>
        <ReportCard title="Sales by Channel" description="In-store vs online breakdown">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">In-Store (POS)</span><span className="font-medium text-primary">{formatCurrency(netSales)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Online</span><span className="font-medium">£0.00</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatCurrency(netSales)}</span></div>
          </div>
        </ReportCard>
        <ReportCard title="Tips Report" description="Staff tips breakdown">
          <NotConfigured msg="Tips tracking not applicable for retail POS." />
        </ReportCard>
      </div>
    </div>
  );
}