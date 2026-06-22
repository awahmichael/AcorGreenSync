import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Settings } from 'lucide-react';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, groupBy, groupAndSum, sum, sortByValue, formatCurrency, formatNumber, exportCSV, CHART_PALETTE } from '@/lib/reports/calculations';

const NotConfigured = ({ msg }) => (
  <div className="h-28 flex flex-col items-center justify-center text-center">
    <Settings className="w-5 h-5 text-muted-foreground/40 mb-2" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

export default function OperationalReports({ data, period, dateRange }) {
  const { returns = [], suppliers = [], stockMovements = [], transactions = [], auditLogs = [], stores = [] } = data;
  const filteredReturns = filterByPeriod(returns, period, 'return_date', dateRange);
  const filteredMovements = filterByPeriod(stockMovements, period, 'movement_date', dateRange);
  const filteredLogs = filterByPeriod(auditLogs, period, 'performed_at', dateRange);
  const filteredTxns = filterByPeriod(transactions, period, 'transaction_date', dateRange);

  // Returns
  const totalRefunds = sum(filteredReturns, 'refund_amount');
  const totalCarbonReversed = sum(filteredReturns, 'carbon_reversal_kg_co2e');
  const returnsByReason = groupAndSum(filteredReturns, r => r.reason || 'unwanted', r => r.refund_amount || 0);
  const returnsByMethod = groupAndSum(filteredReturns, r => r.refund_method || 'original', r => r.refund_amount || 0);

  // Multi-store comparison
  const byStore = groupAndSum(filteredTxns, t => t.store_name || 'Unknown', t => t.total_amount);
  const storeComparison = byStore.map(s => {
    const storeTxns = filteredTxns.filter(t => (t.store_name || 'Unknown') === s.key);
    return {
      store: s.key,
      revenue: s.value,
      txns: s.count,
      co2e: sum(storeTxns, 'total_kg_co2e'),
      avgSale: s.count > 0 ? s.value / s.count : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Goods received
  const goodsReceived = filteredMovements.filter(m => m.movement_type === 'purchase_in');

  // Audit log
  const logsByAction = groupAndSum(filteredLogs, l => l.action || 'unknown', l => 1);

  // Supplier summary
  const supplierStats = suppliers.map(s => ({
    name: s.name,
    disclosure: s.carbon_disclosure_status || 'Not Disclosed',
    distance: s.distance_km || 0,
    transport: s.transport_mode || 'road_hgv',
    declaredCO2e: s.declared_scope3_kg_co2e || 0,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Returns', value: filteredReturns.length, sub: 'this period' },
          { label: 'Total Refunds', value: formatCurrency(totalRefunds), sub: 'processed' },
          { label: 'Carbon Reversed', value: `${totalCarbonReversed.toFixed(2)} kg`, sub: 'from returns' },
          { label: 'Goods Received', value: goodsReceived.length, sub: 'deliveries this period' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Return / Refund Report */}
        <ReportCard title="Return / Refund Report" description="Returns by value and volume" onExport={() => exportCSV('returns.csv', ['Ref', 'Original Txn', 'Refund', 'Method', 'Reason', 'Date', 'CO2e Reversed'], filteredReturns.map(r => [r.return_ref, r.original_transaction_ref, (r.refund_amount || 0).toFixed(2), r.refund_method, r.reason, new Date(r.return_date).toLocaleDateString('en-GB'), (r.carbon_reversal_kg_co2e || 0).toFixed(4)]))}>
          <ReportTable headers={['Ref', 'Original Txn', 'Refund', 'Reason', 'CO2e Reversed']} rows={filteredReturns.slice(0, 20).map(r => [r.return_ref, r.original_transaction_ref, formatCurrency(r.refund_amount), r.reason, `${(r.carbon_reversal_kg_co2e || 0).toFixed(3)} kg`])} maxHeight="250px" />
        </ReportCard>

        {/* Return Reasons Analysis */}
        <ReportCard title="Return Reasons Analysis" description="Breakdown by fault, unwanted, wrong item, damaged" onExport={() => exportCSV('return-reasons.csv', ['Reason', 'Count', 'Refund Amount'], returnsByReason.map(d => [d.key, d.count, d.value.toFixed(2)]))}>
          {returnsByReason.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={returnsByReason.map(d => ({ name: d.key, value: d.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={e => e.name}>
                  {returnsByReason.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No returns this period." />}
        </ReportCard>
      </div>

      {/* Multi-Store Comparison */}
      <ReportCard title="Multi-Store Comparison" description="Side-by-side performance across locations" onExport={() => exportCSV('store-comparison.csv', ['Store', 'Revenue', 'Transactions', 'CO2e', 'Avg Sale'], storeComparison.map(s => [s.store, s.revenue.toFixed(2), s.txns, s.co2e.toFixed(4), s.avgSale.toFixed(2)]))}>
        <ReportTable headers={['Store', 'Revenue', 'Txns', 'CO2e', 'Avg Sale', 'CO2e/£']} rows={storeComparison.map(s => [s.store, formatCurrency(s.revenue), s.txns, `${s.co2e.toFixed(2)} kg`, formatCurrency(s.avgSale), s.revenue > 0 ? `${(s.co2e / s.revenue * 1000).toFixed(2)}` : '0'])} maxHeight="300px" />
      </ReportCard>

      {/* Activity / Audit Log */}
      <ReportCard title="Activity / Audit Log" description="All system user actions" onExport={() => exportCSV('audit-log.csv', ['Date', 'Action', 'Entity', 'Reference', 'User'], filteredLogs.map(l => [new Date(l.performed_at).toLocaleString('en-GB'), l.action, l.entity_type, l.entity_ref || '', l.user_name || '']))}>
        <ReportTable headers={['Date', 'Action', 'Entity', 'Reference', 'User']} rows={filteredLogs.slice(0, 50).map(l => [new Date(l.performed_at).toLocaleString('en-GB'), l.action, l.entity_type, l.entity_ref || '—', l.user_name || '—'])} maxHeight="300px" />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Goods Received */}
        <ReportCard title="Goods Received Report" description="Deliveries matched to purchase orders" onExport={() => exportCSV('goods-received.csv', ['Date', 'Product', 'Qty', 'Store', 'Reference'], goodsReceived.map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.quantity, m.store_name || '', m.reference || '']))}>
          <ReportTable headers={['Date', 'Product', 'Qty', 'Store', 'Ref']} rows={goodsReceived.slice(0, 20).map(m => [new Date(m.movement_date).toLocaleDateString('en-GB'), m.product_name, m.quantity, m.store_name || '—', m.reference || '—'])} maxHeight="250px" />
        </ReportCard>

        {/* Supplier Performance */}
        <ReportCard title="Supplier Performance" description="Supplier directory with disclosure status" onExport={() => exportCSV('suppliers.csv', ['Supplier', 'Disclosure', 'Distance (km)', 'Transport', 'Declared CO2e'], supplierStats.map(s => [s.name, s.disclosure, s.distance, s.transport, s.declaredCO2e.toFixed(2)]))}>
          <ReportTable headers={['Supplier', 'Disclosure', 'Distance', 'Transport', 'CO2e']} rows={supplierStats.map(s => [s.name, s.disclosure, `${s.distance} km`, s.transport, s.declaredCO2e > 0 ? `${s.declaredCO2e.toFixed(0)} kg` : '—'])} maxHeight="250px" />
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Purchase Order History" description="PO log with fulfilment status">
          <NotConfigured msg="Purchase order system not configured. Add PurchaseOrder entity to enable PO tracking." />
        </ReportCard>
        <ReportCard title="Audit Log Summary" description="Actions by type" onExport={() => exportCSV('audit-summary.csv', ['Action', 'Count'], logsByAction.map(d => [d.key, d.count]))}>
          {logsByAction.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={logsByAction.map(d => ({ action: d.key, Count: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="action" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip />
                <Bar dataKey="Count" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No audit logs this period." />}
        </ReportCard>
      </div>
    </div>
  );
}