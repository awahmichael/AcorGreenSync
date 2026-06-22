import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, groupBy, groupAndSum, sum, avg, sortByValue, formatCurrency, formatNumber, exportCSV } from '@/lib/reports/calculations';

export default function StaffReports({ data, period, dateRange }) {
  const { shifts = [], transactions = [] } = data;
  const filtered = filterByPeriod(transactions, period, 'transaction_date', dateRange);
  const filteredShifts = filterByPeriod(shifts, period, 'shift_start', dateRange);

  // Sales by staff
  const byStaff = groupAndSum(filtered, t => t.cashier_name || 'Unknown', t => t.total_amount);
  const staffStats = sortByValue(byStaff.map(s => {
    const staffTxns = filtered.filter(t => (t.cashier_name || 'Unknown') === s.key);
    const staffItems = staffTxns.reduce((sum, t) => sum + (t.items || []).reduce((is, i) => is + (i.quantity || 0), 0), 0);
    return {
      name: s.key,
      revenue: s.value,
      txns: s.count,
      aov: s.count > 0 ? s.value / s.count : 0,
      units: staffItems,
      upt: s.count > 0 ? staffItems / s.count : 0,
    };
  }), s => s.revenue);

  // Shift summary
  const openShifts = filteredShifts.filter(s => s.status === 'open');
  const closedShifts = filteredShifts.filter(s => s.status === 'closed' || s.status === 'reconciled');
  const totalShiftRevenue = sum(filteredShifts, 'total_revenue');
  const totalShiftCO2e = sum(filteredShifts, 'total_kg_co2e');

  // Hours worked
  const hoursData = filteredShifts.map(s => {
    const start = new Date(s.shift_start);
    const end = s.shift_end ? new Date(s.shift_end) : new Date();
    const hours = (end - start) / 3600000;
    return { name: s.cashier_name, hours: Math.round(hours * 10) / 10, revenue: s.total_revenue || 0, txns: s.total_transactions || 0 };
  });
  const totalHours = sum(hoursData, h => h.hours);
  const hoursByStaff = groupAndSum(hoursData, h => h.name, h => h.hours);

  // Commission (estimated at 2% as framework)
  const commissionRate = 0.02;
  const commissionData = staffStats.map(s => ({ ...s, commission: s.revenue * commissionRate }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff', value: staffStats.length, sub: 'active cashiers' },
          { label: 'Revenue Generated', value: formatCurrency(sum(staffStats, s => s.revenue)), sub: 'this period' },
          { label: 'Open Shifts', value: openShifts.length, sub: 'currently active' },
          { label: 'Total Hours', value: `${totalHours.toFixed(0)}h`, sub: 'worked this period' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
            <div className="text-xl font-bold text-foreground mt-1">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Sales by Staff Member */}
      <ReportCard title="Sales by Staff Member" description="Per-cashier revenue and transaction breakdown" onExport={() => exportCSV('staff-sales.csv', ['Staff', 'Revenue', 'Transactions', 'AOV', 'Units', 'UPT'], staffStats.map(s => [s.name, s.revenue.toFixed(2), s.txns, s.aov.toFixed(2), s.units, s.upt.toFixed(1)]))}>
        <ReportTable headers={['Staff', 'Revenue', 'Txns', 'AOV', 'Units', 'UPT']} rows={staffStats.map(s => [s.name, formatCurrency(s.revenue), s.txns, formatCurrency(s.aov), s.units, s.upt.toFixed(1)])} maxHeight="300px" />
      </ReportCard>

      {/* Staff Performance Leaderboard */}
      <ReportCard title="Staff Performance Leaderboard" description="Ranking by revenue, AOV, and units per transaction" onExport={() => exportCSV('staff-leaderboard.csv', ['Rank', 'Staff', 'Revenue', 'AOV', 'UPT'], staffStats.map((s, i) => [i + 1, s.name, s.revenue.toFixed(2), s.aov.toFixed(2), s.upt.toFixed(1)]))}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={staffStats.slice(0, 10).map(s => ({ name: s.name, Revenue: s.revenue, AOV: s.aov }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="Revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="AOV" fill="#86EFAC" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Commission Report */}
        <ReportCard title="Commission Report" description={`Estimated commission at ${(commissionRate * 100)}% rate`} onExport={() => exportCSV('commission.csv', ['Staff', 'Revenue', 'Commission'], commissionData.map(s => [s.name, s.revenue.toFixed(2), s.commission.toFixed(2)]))}>
          <ReportTable headers={['Staff', 'Revenue', 'Commission']} rows={commissionData.map(s => [s.name, formatCurrency(s.revenue), formatCurrency(s.commission)])} maxHeight="250px" />
        </ReportCard>

        {/* Hours Worked */}
        <ReportCard title="Hours Worked / Time Clock" description="Total hours by staff member" onExport={() => exportCSV('staff-hours.csv', ['Staff', 'Hours'], hoursByStaff.map(d => [d.key, d.value.toFixed(1)]))}>
          <ReportTable headers={['Staff', 'Hours']} rows={hoursByStaff.map(d => [d.key, `${d.value.toFixed(1)}h`])} maxHeight="250px" />
        </ReportCard>
      </div>

      {/* Shift Summary / Z-Report */}
      <ReportCard title="Shift Summary / Z-Report" description="Per-shift cash reconciliation" onExport={() => exportCSV('shift-summary.csv', ['Cashier', 'Store', 'Start', 'End', 'Revenue', 'Txns', 'CO2e', 'Status'], filteredShifts.map(s => [s.cashier_name, s.store_name, new Date(s.shift_start).toLocaleString('en-GB'), s.shift_end ? new Date(s.shift_end).toLocaleString('en-GB') : 'Open', (s.total_revenue || 0).toFixed(2), s.total_transactions || 0, (s.total_kg_co2e || 0).toFixed(4), s.status]))}>
        <ReportTable headers={['Cashier', 'Store', 'Revenue', 'Txns', 'CO₂e', 'Status']} rows={filteredShifts.slice(0, 30).map(s => [s.cashier_name, s.store_name, formatCurrency(s.total_revenue), s.total_transactions || 0, `${(s.total_kg_co2e || 0).toFixed(3)} kg`, s.status])} maxHeight="300px" />
      </ReportCard>
    </div>
  );
}