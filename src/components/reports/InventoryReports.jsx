import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Settings } from 'lucide-react';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, flattenItems, groupBy, groupAndSum, sum, sortByValue, formatCurrency, formatNumber, exportCSV, CHART_PALETTE } from '@/lib/reports/calculations';

const NotConfigured = ({ msg }) => (
  <div className="h-28 flex flex-col items-center justify-center text-center">
    <Settings className="w-5 h-5 text-muted-foreground/40 mb-2" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

export default function InventoryReports({ data, period, dateRange }) {
  const { products = [], stockMovements = [], transactions = [], suppliers = [], stores = [] } = data;
  const filteredTxns = filterByPeriod(transactions, period, 'transaction_date', dateRange);
  const items = flattenItems(filteredTxns);

  // Inventory valuation
  const totalValue = sum(products, p => (p.stock_quantity || 0) * (p.price || 0));
  const totalUnits = sum(products, p => p.stock_quantity || 0);
  const activeProducts = products.filter(p => p.is_active !== false);

  // Stock on hand
  const stockOnHand = sortByValue(products.map(p => ({ ...p, value: p.stock_quantity || 0 })), p => p.value).slice(0, 50);

  // Low stock
  const lowStock = products.filter(p => (p.stock_quantity || 0) <= 5 && p.is_active !== false).sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0));

  // Dusty inventory - products with no sales in the period
  const soldProductIds = new Set(items.map(i => i.product_id));
  const dusty = activeProducts.filter(p => !soldProductIds.has(p.id) && (p.stock_quantity || 0) > 0);

  // Sell-through rate
  const sellThrough = products.map(p => {
    const sold = items.filter(i => i.product_id === p.id).reduce((s, i) => s + (i.quantity || 0), 0);
    const stock = p.stock_quantity || 0;
    return { name: p.name, sold, stock, rate: stock + sold > 0 ? (sold / (stock + sold)) * 100 : 0 };
  }).filter(s => s.sold > 0 || s.stock > 0).sort((a, b) => b.rate - a.rate).slice(0, 20);

  // Stock movements
  const movements = filterByPeriod(stockMovements, period, 'movement_date', dateRange);
  const movementsByType = groupAndSum(movements, m => m.movement_type, m => m.quantity || 0);

  // Inventory by store
  const byStore = groupAndSum(products, p => {
    const store = stores.find(s => s.id === p.store_id);
    return store?.name || 'Unassigned';
  }, p => (p.stock_quantity || 0) * (p.price || 0));

  // Inventory by vendor
  const byVendor = groupAndSum(products, p => {
    const supplier = suppliers.find(s => s.id === p.supplier_id);
    return supplier?.name || 'Unknown';
  }, p => (p.stock_quantity || 0) * (p.price || 0));

  // ABC Analysis
  const sortedByValue = sortByValue(products.map(p => ({ name: p.name, value: (p.stock_quantity || 0) * (p.price || 0) })), p => p.value);
  const totalInvValue = sum(sortedByValue, p => p.value);
  let cumulative = 0;
  const abcData = sortedByValue.map(p => {
    cumulative += p.value;
    const pct = totalInvValue > 0 ? (cumulative / totalInvValue) * 100 : 0;
    return { ...p, class: pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C' };
  });
  const abcSummary = [
    { class: 'A', count: abcData.filter(p => p.class === 'A').length, value: abcData.filter(p => p.class === 'A').reduce((s, p) => s + p.value, 0) },
    { class: 'B', count: abcData.filter(p => p.class === 'B').length, value: abcData.filter(p => p.class === 'B').reduce((s, p) => s + p.value, 0) },
    { class: 'C', count: abcData.filter(p => p.class === 'C').length, value: abcData.filter(p => p.class === 'C').reduce((s, p) => s + p.value, 0) },
  ];

  // Dynamic reorder - suggest reorder for low stock items based on sales velocity
  const reorderSuggestions = products.map(p => {
    const sold = items.filter(i => i.product_id === p.id).reduce((s, i) => s + (i.quantity || 0), 0);
    const dailyVelocity = sold / Math.max(period, 1);
    const daysOfStock = dailyVelocity > 0 ? (p.stock_quantity || 0) / dailyVelocity : 999;
    const reorderQty = dailyVelocity > 0 && daysOfStock < 14 ? Math.ceil(dailyVelocity * 30) : 0;
    return { name: p.name, stock: p.stock_quantity || 0, sold, dailyVel: dailyVelocity.toFixed(1), daysLeft: daysOfStock === 999 ? '∞' : Math.ceil(daysOfStock), reorder: reorderQty };
  }).filter(r => r.reorder > 0).sort((a, b) => b.reorder - a.reorder);

  // Transfers
  const transfers = movements.filter(m => m.movement_type === 'transfer_in' || m.movement_type === 'transfer_out');
  // Wastage
  const wastage = movements.filter(m => m.movement_type === 'wastage');

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Inventory Value', value: formatCurrency(totalValue), sub: `${formatNumber(products.length)} products` },
          { label: 'Total Units in Stock', value: formatNumber(totalUnits), sub: 'across all stores' },
          { label: 'Low Stock Items', value: lowStock.length, sub: '≤ 5 units remaining' },
          { label: 'Dusty Inventory', value: dusty.length, sub: 'no sales this period' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory Valuation */}
        <ReportCard title="Inventory Valuation" description="Stock-at-cost across all stores" onExport={() => exportCSV('inventory-valuation.csv', ['Metric', 'Value'], [['Total Value', totalValue.toFixed(2)], ['Total Units', totalUnits], ['Product Count', products.length]])}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={abcSummary.map(s => ({ class: `Class ${s.class}`, Value: s.value, Items: s.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="class" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="Value" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportCard>

        {/* ABC Analysis */}
        <ReportCard title="ABC Analysis (Pareto)" description="Classification by inventory value contribution" onExport={() => exportCSV('abc-analysis.csv', ['Class', 'Items', 'Value'], abcSummary.map(s => [s.class, s.count, s.value.toFixed(2)]))}>
          <ReportTable headers={['Class', 'Items', 'Value', '% of Total']} rows={abcSummary.map(s => [`Class ${s.class}`, s.count, formatCurrency(s.value), totalInvValue > 0 ? `${((s.value / totalInvValue) * 100).toFixed(1)}%` : '0%'])} />
        </ReportCard>
      </div>

      {/* Stock On Hand */}
      <ReportCard title="Stock On Hand" description="Current quantity per product (top 50)" onExport={() => exportCSV('stock-on-hand.csv', ['Product', 'SKU', 'Stock', 'Value'], stockOnHand.map(p => [p.name, p.sku || '', p.stock_quantity || 0, ((p.stock_quantity || 0) * (p.price || 0)).toFixed(2)]))}>
        <ReportTable headers={['Product', 'Stock', 'Unit Price', 'Value']} rows={stockOnHand.map(p => [p.name, formatNumber(p.stock_quantity || 0), formatCurrency(p.price), formatCurrency((p.stock_quantity || 0) * (p.price || 0))])} maxHeight="300px" />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Alert */}
        <ReportCard title="Low Stock Alert" description="Items at or below 5 units" onExport={() => exportCSV('low-stock.csv', ['Product', 'Stock'], lowStock.map(p => [p.name, p.stock_quantity || 0]))}>
          <ReportTable headers={['Product', 'Stock']} rows={lowStock.map(p => [p.name, formatNumber(p.stock_quantity || 0)])} maxHeight="250px" />
        </ReportCard>

        {/* Dynamic Reorder */}
        <ReportCard title="Dynamic Reorder Report" description="AI-suggested reorder quantities based on sales velocity" onExport={() => exportCSV('reorder-suggestions.csv', ['Product', 'Stock', 'Sold', 'Daily Velocity', 'Days Left', 'Suggested Reorder'], reorderSuggestions.map(r => [r.name, r.stock, r.sold, r.dailyVel, r.daysLeft, r.reorder]))}>
          <ReportTable headers={['Product', 'Stock', 'Days Left', 'Reorder Qty']} rows={reorderSuggestions.map(r => [r.name, r.stock, r.daysLeft, r.reorder])} maxHeight="250px" />
        </ReportCard>
      </div>

      {/* Sell-Through Rate */}
      <ReportCard title="Sell-Through Rate" description="Units sold ÷ (units sold + stock on hand)" onExport={() => exportCSV('sell-through.csv', ['Product', 'Sold', 'Stock', 'Rate %'], sellThrough.map(s => [s.name, s.sold, s.stock, s.rate.toFixed(1)]))}>
        <ReportTable headers={['Product', 'Units Sold', 'Stock', 'Sell-Through %']} rows={sellThrough.map(s => [s.name, s.sold, s.stock, `${s.rate.toFixed(1)}%`])} maxHeight="250px" />
      </ReportCard>

      {/* Dusty Inventory */}
      <ReportCard title="Dusty Inventory / Dead Stock" description="Products with stock but no sales this period" onExport={() => exportCSV('dusty-inventory.csv', ['Product', 'Stock', 'Value'], dusty.map(p => [p.name, p.stock_quantity || 0, ((p.stock_quantity || 0) * (p.price || 0)).toFixed(2)]))}>
        <ReportTable headers={['Product', 'Stock', 'Tied-Up Value']} rows={dusty.map(p => [p.name, formatNumber(p.stock_quantity || 0), formatCurrency((p.stock_quantity || 0) * (p.price || 0))])} maxHeight="250px" />
      </ReportCard>

      {/* Stock Movement History */}
      <ReportCard title="Stock Movement History" description="All stock movements this period" onExport={() => exportCSV('stock-movements.csv', ['Date', 'Product', 'Type', 'Qty', 'Store'], movements.map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.movement_type, m.quantity, m.store_name || '']))}>
        <ReportTable headers={['Date', 'Product', 'Type', 'Qty', 'Store']} rows={movements.slice(0, 50).map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.movement_type, m.quantity, m.store_name || '—'])} maxHeight="300px" />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory by Store */}
        <ReportCard title="Inventory by Store" description="Stock value distribution across locations" onExport={() => exportCSV('inventory-by-store.csv', ['Store', 'Value'], byStore.map(d => [d.key, d.value.toFixed(2)]))}>
          {byStore.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byStore.map(d => ({ name: d.key, value: d.value }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={e => e.name}>
                  {byStore.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No store-assigned inventory." />}
        </ReportCard>

        {/* Inventory by Vendor */}
        <ReportCard title="Inventory by Vendor" description="Stock value grouped by supplier" onExport={() => exportCSV('inventory-by-vendor.csv', ['Vendor', 'Value', 'Products'], byVendor.map(d => [d.key, d.value.toFixed(2), d.count]))}>
          <ReportTable headers={['Vendor', 'Value', 'Products']} rows={byVendor.map(d => [d.key, formatCurrency(d.value), d.count])} maxHeight="250px" />
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock Transfer Log */}
        <ReportCard title="Stock Transfer Log" description="Inter-store movement audit" onExport={() => exportCSV('stock-transfers.csv', ['Date', 'Product', 'Type', 'Qty', 'Store'], transfers.map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.movement_type, m.quantity, m.store_name || '']))}>
          <ReportTable headers={['Date', 'Product', 'Direction', 'Qty']} rows={transfers.map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.movement_type, m.quantity])} maxHeight="200px" />
        </ReportCard>

        {/* Wastage Report */}
        <ReportCard title="Wastage / Write-off Report" description="Damaged and expired stock" onExport={() => exportCSV('wastage.csv', ['Date', 'Product', 'Qty', 'Store'], wastage.map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.quantity, m.store_name || '']))}>
          <ReportTable headers={['Date', 'Product', 'Qty', 'Notes']} rows={wastage.map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.quantity, m.notes || '—'])} maxHeight="200px" />
        </ReportCard>
      </div>

      <ReportCard title="Shrinkage Report" description="Expected vs actual stock variance">
        <NotConfigured msg="Requires stock count / variance audit data. Enable stocktake functionality to generate shrinkage reports." />
      </ReportCard>
    </div>
  );
}