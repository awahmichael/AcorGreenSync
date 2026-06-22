import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, groupBy, groupAndSum, sum, avg, topN, sortByValue, formatCurrency, formatNumber, formatCO2e, exportCSV, CHART_PALETTE } from '@/lib/reports/calculations';

export default function CustomerReports({ data, period }) {
  const { customers = [], transactions = [] } = data;
  const filtered = filterByPeriod(transactions, period);
  const totalCustomers = customers.length;
  const newCustomers = customers.filter(c => (c.transaction_count || 0) <= 1).length;
  const returningCustomers = totalCustomers - newCustomers;
  const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

  const totalSpend = sum(customers, 'total_spend');
  const avgCLV = totalCustomers > 0 ? totalSpend / totalCustomers : 0;
  const totalPoints = sum(customers, 'loyalty_points');
  const totalCarbon = sum(customers, 'total_kg_co2e');

  const topSpenders = topN(customers.map(c => ({ ...c, value: c.total_spend || 0 })), 20, c => c.value);
  const byTier = groupAndSum(customers, c => c.tier || 'Bronze', c => c.total_spend || 0);

  const customerTxns = filtered.filter(t => t.customer_id || t.customer_name);
  const byCustomerTxns = groupAndSum(customerTxns, t => t.customer_name || 'Unknown', t => t.total_amount);

  const loyaltyMembers = customers.filter(c => (c.loyalty_points || 0) > 0);
  const loyaltyRate = totalCustomers > 0 ? (loyaltyMembers.length / totalCustomers) * 100 : 0;
  const avgPoints = totalCustomers > 0 ? totalPoints / totalCustomers : 0;

  const segments = [
    { label: 'VIP (£1000+)', count: customers.filter(c => (c.total_spend || 0) >= 1000).length },
    { label: 'Regular (£250-999)', count: customers.filter(c => (c.total_spend || 0) >= 250 && (c.total_spend || 0) < 1000).length },
    { label: 'Occasional (£50-249)', count: customers.filter(c => (c.total_spend || 0) >= 50 && (c.total_spend || 0) < 250).length },
    { label: 'New (<£50)', count: customers.filter(c => (c.total_spend || 0) < 50).length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', value: formatNumber(totalCustomers), sub: 'in CRM database' },
          { label: 'Avg Lifetime Value', value: formatCurrency(avgCLV), sub: 'per customer' },
          { label: 'Retention Rate', value: `${retentionRate.toFixed(1)}%`, sub: `${returningCustomers} returning` },
          { label: 'Loyalty Members', value: loyaltyMembers.length, sub: `${loyaltyRate.toFixed(0)}% enrolled` },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <ReportCard title="New vs Returning Customers" description="Customer acquisition vs retention split" onExport={() => exportCSV('new-vs-returning.csv', ['Type', 'Count'], [['New', newCustomers], ['Returning', returningCustomers]])}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[{ type: 'New', count: newCustomers }, { type: 'Returning', count: returningCustomers }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip />
            <Bar dataKey="count" fill="#16A34A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Customer Lifetime Value (CLV)" description="Projected total spend per customer" onExport={() => exportCSV('clv-report.csv', ['Metric', 'Value'], [['Total Spend', totalSpend.toFixed(2)], ['Avg CLV', avgCLV.toFixed(2)], ['Customers', totalCustomers]])}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Customer Spend</span><span className="font-medium">{formatCurrency(totalSpend)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Average CLV</span><span className="font-medium text-primary">{formatCurrency(avgCLV)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Highest CLV</span><span className="font-medium">{formatCurrency(topSpenders[0]?.total_spend || 0)}</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Total Lifetime Carbon</span><span className="font-medium text-purple-600">{formatCO2e(totalCarbon)}</span></div>
          </div>
        </ReportCard>

        <ReportCard title="Customer Retention Rate" description="% of customers returning after first purchase" onExport={() => exportCSV('retention.csv', ['Metric', 'Value'], [['Total', totalCustomers], ['New', newCustomers], ['Returning', returningCustomers], ['Rate %', retentionRate.toFixed(1)]])}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">New Customers</span><span className="font-medium text-blue-600">{newCustomers}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Returning Customers</span><span className="font-medium text-primary">{returningCustomers}</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Retention Rate</span><span className="font-bold text-primary">{retentionRate.toFixed(1)}%</span></div>
          </div>
        </ReportCard>
      </div>

      <ReportCard title="Top Customers by Spend" description="VIP ranking by lifetime value" onExport={() => exportCSV('top-customers.csv', ['Customer', 'Tier', 'Spend', 'Txns', 'CO2e'], topSpenders.map(c => [c.name, c.tier, (c.total_spend || 0).toFixed(2), c.transaction_count || 0, (c.total_kg_co2e || 0).toFixed(4)]))}>
        <ReportTable headers={['Customer', 'Tier', 'Spend', 'Txns', 'CO2e']} rows={topSpenders.map(c => [c.name, c.tier || 'Bronze', formatCurrency(c.total_spend), c.transaction_count || 0, formatCO2e(c.total_kg_co2e)])} maxHeight="300px" />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="Loyalty Points Balance" description="Outstanding loyalty point liability" onExport={() => exportCSV('loyalty-balance.csv', ['Metric', 'Value'], [['Total Points', totalPoints], ['Avg Points', avgPoints.toFixed(1)], ['Members', loyaltyMembers.length]])}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Points Outstanding</span><span className="font-medium">{formatNumber(totalPoints)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Avg Points / Customer</span><span className="font-medium">{avgPoints.toFixed(0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Enrolment Rate</span><span className="font-medium text-primary">{loyaltyRate.toFixed(1)}%</span></div>
          </div>
        </ReportCard>

        <ReportCard title="Loyalty Program Performance" description="Spend by tier" onExport={() => exportCSV('loyalty-by-tier.csv', ['Tier', 'Customers', 'Spend'], byTier.map(d => [d.key, d.count, d.value.toFixed(2)]))}>
          {byTier.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byTier.map(d => ({ tier: d.key, Spend: d.value }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="tier" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="Spend" fill="#16A34A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-8">No loyalty data.</p>}
        </ReportCard>
      </div>

      <ReportCard title="Customer Purchase History" description="Recent transactions linked to customers" onExport={() => exportCSV('customer-history.csv', ['Customer', 'Revenue', 'Txns'], byCustomerTxns.map(d => [d.key, d.value.toFixed(2), d.count]))}>
        <ReportTable headers={['Customer', 'Revenue', 'Txns']} rows={byCustomerTxns.map(d => [d.key, formatCurrency(d.value), d.count])} maxHeight="250px" />
      </ReportCard>

      <ReportCard title="Customer Segmentation" description="Cohort analysis by spend bracket" onExport={() => exportCSV('customer-segments.csv', ['Segment', 'Count'], segments.map(s => [s.label, s.count]))}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={segments.map(s => ({ segment: s.label, Customers: s.count }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis type="category" dataKey="segment" tick={{ fontSize: 10, fill: '#94a3b8' }} width={120} />
            <Tooltip />
            <Bar dataKey="Customers" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}