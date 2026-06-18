import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, FileText, Calendar, Leaf, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function Reports() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    base44.entities.Transaction.list('-transaction_date', 500).then(setTransactions).finally(() => setLoading(false));
  }, []);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(period));
  const filtered = transactions.filter(t => new Date(t.transaction_date) >= cutoff);

  const totalCO2e = filtered.reduce((s, t) => s + (t.total_kg_co2e || 0), 0);
  const upstreamCO2e = filtered.reduce((s, t) => s + (t.upstream_kg_co2e || 0), 0);
  const downstreamCO2e = filtered.reduce((s, t) => s + (t.downstream_kg_co2e || 0), 0);
  const totalRevenue = filtered.reduce((s, t) => s + (t.total_amount || 0), 0);
  const avgCO2ePerTxn = filtered.length > 0 ? totalCO2e / filtered.length : 0;

  const chartData = getWeeklyBreakdown(filtered);

  const exportCSV = () => {
    const rows = [
      ['Transaction Ref', 'Date', 'Store', 'Total £', 'Total CO₂e (kg)', 'Upstream CO₂e (kg)', 'Downstream CO₂e (kg)', 'Sync Status'],
      ...filtered.map(t => [
        t.transaction_ref,
        new Date(t.transaction_date).toLocaleDateString('en-GB'),
        t.store_name || '',
        (t.total_amount || 0).toFixed(2),
        (t.total_kg_co2e || 0).toFixed(4),
        (t.upstream_kg_co2e || 0).toFixed(4),
        (t.downstream_kg_co2e || 0).toFixed(4),
        t.sync_status,
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acorcloud-greensync-scope3-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('CSV report downloaded');
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(22, 163, 74);
    doc.text('AcorCloud Green-Sync', 20, 25);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.text('Scope 3 Carbon Emissions Report', 20, 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: Last ${period} days | Generated: ${new Date().toLocaleDateString('en-GB')}`, 20, 44);
    doc.text('In line with UK Net Zero targets — GHG Protocol Scope 3 Categories 1 & 11', 20, 51);

    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.line(20, 56, 190, 56);

    // Summary
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text('Summary', 20, 66);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const summaryRows = [
      ['Total Transactions', filtered.length.toString()],
      ['Total Revenue', `£${totalRevenue.toFixed(2)}`],
      ['Total Scope 3 Emissions', `${totalCO2e.toFixed(4)} kg CO₂e`],
      ['Upstream (Cat. 1 - Purchased Goods)', `${upstreamCO2e.toFixed(4)} kg CO₂e`],
      ['Downstream (Cat. 11 - Sold Products)', `${downstreamCO2e.toFixed(4)} kg CO₂e`],
      ['Average CO₂e per Transaction', `${avgCO2ePerTxn.toFixed(4)} kg CO₂e`],
    ];
    summaryRows.forEach(([label, val], i) => {
      doc.setTextColor(80, 80, 80);
      doc.text(label, 20, 76 + i * 8);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(val, 140, 76 + i * 8);
      doc.setFont('helvetica', 'normal');
    });

    // Transactions table
    let y = 140;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Transaction Detail', 20, y);
    y += 8;
    doc.setFontSize(8);
    doc.setFillColor(240, 253, 244);
    doc.rect(20, y, 170, 7, 'F');
    doc.setTextColor(22, 163, 74);
    doc.text('Ref', 22, y + 5);
    doc.text('Date', 60, y + 5);
    doc.text('£', 90, y + 5);
    doc.text('CO₂e (kg)', 110, y + 5);
    doc.text('Upstream', 140, y + 5);
    doc.text('Downstream', 165, y + 5);
    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    filtered.slice(0, 30).forEach((t, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(20, y - 4, 170, 7, 'F');
      }
      doc.text((t.transaction_ref || '').substring(0, 15), 22, y);
      doc.text(new Date(t.transaction_date).toLocaleDateString('en-GB'), 60, y);
      doc.text(`${(t.total_amount || 0).toFixed(2)}`, 90, y);
      doc.text(`${(t.total_kg_co2e || 0).toFixed(3)}`, 110, y);
      doc.text(`${(t.upstream_kg_co2e || 0).toFixed(3)}`, 140, y);
      doc.text(`${(t.downstream_kg_co2e || 0).toFixed(3)}`, 165, y);
      y += 7;
    });

    doc.save(`acorcloud-greensync-scope3-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF report downloaded');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scope 3 Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">UK Net Zero compliance — GHG Protocol Categories 1 & 11</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}>
            <FileText className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button onClick={exportPDF} className="bg-primary hover:bg-primary/90">
            <Download className="w-4 h-4 mr-2" />
            PDF Report
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total CO₂e', value: `${totalCO2e.toFixed(2)} kg`, sub: 'Scope 3 all categories', icon: Leaf, color: 'text-primary' },
          { label: 'Upstream (Cat.1)', value: `${upstreamCO2e.toFixed(2)} kg`, sub: 'Purchased Goods', icon: ArrowUpRight, color: 'text-blue-600' },
          { label: 'Downstream (Cat.11)', value: `${downstreamCO2e.toFixed(2)} kg`, sub: 'Sold Products', icon: ArrowDownRight, color: 'text-purple-600' },
          { label: 'Transactions', value: filtered.length, sub: `last ${period} days`, icon: RefreshCw, color: 'text-muted-foreground' },
          { label: 'Revenue', value: `£${totalRevenue.toFixed(0)}`, sub: `last ${period} days`, icon: Download, color: 'text-muted-foreground' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
            <div className="text-xl font-bold text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-4">Weekly Scope 3 Breakdown</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit=" kg" />
              <Tooltip formatter={(v) => [`${v.toFixed(3)} kg CO₂e`]} />
              <Legend />
              <Bar dataKey="upstream" name="Upstream (Cat.1)" fill="#16A34A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="downstream" name="Downstream (Cat.11)" fill="#86EFAC" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No transaction data for this period.
          </div>
        )}
      </div>

      {/* Transaction table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Transaction Audit Trail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Store</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total CO₂e</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Upstream</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Downstream</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.slice(0, 50).map(t => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{t.transaction_ref}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.store_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">£{(t.total_amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{(t.total_kg_co2e || 0).toFixed(4)}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{(t.upstream_kg_co2e || 0).toFixed(4)}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{(t.downstream_kg_co2e || 0).toFixed(4)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      t.sync_status === 'synced' ? 'bg-green-50 text-green-700' :
                      t.sync_status === 'pending_sync' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {t.sync_status}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No transactions in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getWeeklyBreakdown(transactions) {
  const weeks = {};
  transactions.forEach(t => {
    const d = new Date(t.transaction_date);
    const week = `W${getWeekNumber(d)}`;
    if (!weeks[week]) weeks[week] = { week, upstream: 0, downstream: 0 };
    weeks[week].upstream += t.upstream_kg_co2e || 0;
    weeks[week].downstream += t.downstream_kg_co2e || 0;
  });
  return Object.values(weeks).slice(-8);
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}