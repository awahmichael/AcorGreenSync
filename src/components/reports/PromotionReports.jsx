import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Settings } from 'lucide-react';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, flattenItems, groupBy, groupAndSum, sum, formatCurrency, formatNumber, exportCSV, CHART_PALETTE } from '@/lib/reports/calculations';

const NotConfigured = ({ msg }) => (
  <div className="h-28 flex flex-col items-center justify-center text-center">
    <Settings className="w-5 h-5 text-muted-foreground/40 mb-2" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

export default function PromotionReports({ data, period }) {
  const { promotions = [], transactions = [] } = data;
  const filtered = filterByPeriod(transactions, period);
  const activePromos = promotions.filter(p => p.is_active !== false);
  const totalDiscounts = sum(filtered, 'discount_amount');

  // Promotion performance - estimate based on type and value
  const promoPerformance = promotions.map(p => {
    const applicableTxns = filtered.filter(t => {
      if (!t.applied_promotions) return false;
      return t.applied_promotions.includes(p.name);
    });
    const discountGiven = sum(applicableTxns, 'discount_amount');
    const revenue = sum(applicableTxns, 'total_amount');
    return {
      name: p.name,
      type: p.type,
      value: p.value,
      isActive: p.is_active !== false,
      transactions: applicableTxns.length,
      discount: discountGiven,
      revenue: revenue,
      roi: discountGiven > 0 ? revenue / discountGiven : 0,
    };
  }).sort((a, b) => b.discount - a.discount);

  // Discount usage over time
  const items = flattenItems(filtered);
  const discountByDay = groupAndSum(filtered, t => new Date(t.transaction_date).toISOString().split('T')[0], t => t.discount_amount || 0).sort((a, b) => a.key.localeCompare(b.key));

  // Promo code redemptions
  const promoCodePromos = promotions.filter(p => p.type === 'promo_code' && p.promo_code);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active Promotions', value: activePromos.length, sub: `${promotions.length} total` },
          { label: 'Total Discounts Given', value: formatCurrency(totalDiscounts), sub: 'this period' },
          { label: 'Avg Discount / Txn', value: formatCurrency(filtered.length > 0 ? totalDiscounts / filtered.length : 0), sub: 'per transaction' },
          { label: 'Promo Code Types', value: promoCodePromos.length, sub: 'code-based promotions' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Discount Usage Report */}
      <ReportCard title="Discount Usage Report" description="Total discounts given over time" onExport={() => exportCSV('discount-usage.csv', ['Date', 'Discount'], discountByDay.map(d => [d.key, d.value.toFixed(2)]))}>
        {discountByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={discountByDay.map(d => ({ date: d.key.split('-').slice(1).join('/'), Discount: d.value }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${v.toFixed(0)}`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="Discount" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <NotConfigured msg="No discount data for this period." />}
      </ReportCard>

      {/* Promotion Performance */}
      <ReportCard title="Promotion Performance" description="Per-promotion ROI and uplift analysis" onExport={() => exportCSV('promo-performance.csv', ['Promotion', 'Type', 'Active', 'Transactions', 'Discount', 'Revenue', 'ROI'], promoPerformance.map(p => [p.name, p.type, p.isActive ? 'Yes' : 'No', p.transactions, p.discount.toFixed(2), p.revenue.toFixed(2), p.roi.toFixed(2)]))}>
        <ReportTable headers={['Promotion', 'Type', 'Status', 'Txns', 'Discount', 'Revenue', 'ROI']} rows={promoPerformance.map(p => [p.name, p.type, p.isActive ? 'Active' : 'Inactive', p.transactions, formatCurrency(p.discount), formatCurrency(p.revenue), `${p.roi.toFixed(1)}x`])} maxHeight="300px" />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Promo Code Redemptions */}
        <ReportCard title="Promo Code Redemptions" description="Code-based promotion usage" onExport={() => exportCSV('promo-codes.csv', ['Code', 'Promotion', 'Value'], promoCodePromos.map(p => [p.promo_code, p.name, p.value]))}>
          {promoCodePromos.length > 0 ? (
            <ReportTable headers={['Code', 'Promotion', 'Type', 'Value']} rows={promoCodePromos.map(p => [p.promo_code, p.name, p.type, p.type === 'percentage' ? `${p.value}%` : formatCurrency(p.value)])} maxHeight="200px" />
          ) : <NotConfigured msg="No promo code promotions configured." />}
        </ReportCard>

        {/* Gift Card Sales */}
        <ReportCard title="Gift Card Sales & Balances" description="Sold vs outstanding liability">
          <NotConfigured msg="Gift card system not configured. Add GiftCard entity to enable gift card sales and balance tracking." />
        </ReportCard>
      </div>
    </div>
  );
}