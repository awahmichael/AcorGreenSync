import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Leaf, TrendingDown, ShoppingCart, Package, AlertCircle, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import KpiCard from '@/components/dashboard/KpiCard';
import NetZeroProgress from '@/components/dashboard/NetZeroProgress';
import SyncStatusBanner from '@/components/dashboard/SyncStatusBanner';

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const { queue } = useOfflineQueue();

  useEffect(() => {
    Promise.all([
      base44.entities.Transaction.list('-transaction_date', 100),
      base44.entities.Product.list(),
    ]).then(([txns, prods]) => {
      setTransactions(txns);
      setProducts(prods);
    }).finally(() => setLoading(false));
  }, []);

  // Aggregate stats
  const totalCO2e = transactions.reduce((sum, t) => sum + (t.total_kg_co2e || 0), 0);
  const upstreamCO2e = transactions.reduce((sum, t) => sum + (t.upstream_kg_co2e || 0), 0);
  const downstreamCO2e = transactions.reduce((sum, t) => sum + (t.downstream_kg_co2e || 0), 0);
  const pendingMapping = products.filter(p => p.emission_mapping_status === 'Pending' || p.emission_mapping_status === 'Flagged').length;

  // Monthly chart data
  const monthlyData = getMonthlyData(transactions);

  // Category breakdown
  const categoryData = getCategoryBreakdown(transactions);

  const NET_ZERO_TARGET = 1000; // kg CO2e target
  const progressPct = Math.min((totalCO2e / NET_ZERO_TARGET) * 100, 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carbon Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Scope 3 emissions overview — UK Net Zero compliance</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Leaf className="w-4 h-4 text-primary" />
          <span>DEFRA / Climatiq.io</span>
        </div>
      </div>

      {/* Offline sync banner */}
      <SyncStatusBanner queueCount={queue.length} isOnline={isOnline} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Scope 3 Emissions"
          value={`${totalCO2e.toFixed(2)} kg`}
          subtitle="CO₂e — all transactions"
          icon={Leaf}
          color="green"
        />
        <KpiCard
          title="Upstream Emissions"
          value={`${upstreamCO2e.toFixed(2)} kg`}
          subtitle="Category 1 — Purchased Goods"
          icon={ArrowUpRight}
          color="blue"
        />
        <KpiCard
          title="Downstream Emissions"
          value={`${downstreamCO2e.toFixed(2)} kg`}
          subtitle="Category 11 — Sold Products"
          icon={ArrowDownRight}
          color="purple"
        />
        <KpiCard
          title="Pending Mapping"
          value={pendingMapping}
          subtitle="Products need emission factors"
          icon={AlertCircle}
          color={pendingMapping > 0 ? "amber" : "green"}
        />
      </div>

      {/* Net Zero Progress */}
      <NetZeroProgress current={totalCO2e} target={NET_ZERO_TARGET} progressPct={progressPct} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly emissions trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Monthly Emissions Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip formatter={(v) => [`${v.toFixed(2)} kg CO₂e`, 'Emissions']} />
              <Area type="monotone" dataKey="co2e" stroke="#16A34A" fill="url(#co2Gradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">By Category</h3>
          {categoryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v.toFixed(2)} kg CO₂e`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {categoryData.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value.toFixed(1)} kg</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Recent Transactions</h3>
        </div>
        <div className="divide-y divide-border">
          {transactions.slice(0, 5).map((t) => (
            <div key={t.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">{t.transaction_ref}</div>
                <div className="text-xs text-muted-foreground">{t.store_name} · {new Date(t.transaction_date).toLocaleDateString('en-GB')}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-primary">{(t.total_kg_co2e || 0).toFixed(2)} kg CO₂e</div>
                <div className="text-xs text-muted-foreground">£{(t.total_amount || 0).toFixed(2)}</div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">No transactions yet. Start using the POS terminal.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = ['#16A34A', '#15803D', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0'];

function getMonthlyData(transactions) {
  const months = {};
  transactions.forEach(t => {
    const d = new Date(t.transaction_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    if (!months[key]) months[key] = { month: label, co2e: 0 };
    months[key].co2e += t.total_kg_co2e || 0;
  });
  return Object.values(months).slice(-6);
}

function getCategoryBreakdown(transactions) {
  const cats = {};
  transactions.forEach(t => {
    (t.items || []).forEach(item => {
      const cat = item.category || 'Uncategorised';
      if (!cats[cat]) cats[cat] = 0;
      cats[cat] += item.kg_co2e || 0;
    });
  });
  return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}