import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Leaf, TrendingDown, AlertCircle, RefreshCw, ArrowUpRight, ArrowDownRight, BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import KpiCard from '@/components/dashboard/KpiCard';
import NetZeroProgress from '@/components/dashboard/NetZeroProgress';
import SyncStatusBanner from '@/components/dashboard/SyncStatusBanner';
import BusinessDashboard from '@/components/dashboard/BusinessDashboard';

const TABS = [
  { id: 'business', label: 'Business', icon: BarChart2 },
  { id: 'carbon', label: 'Carbon Reporting', icon: Leaf },
];

export default function Dashboard() {
  const [tab, setTab] = useState('business');
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [carbonTargets, setCarbonTargets] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const { queue, syncing, syncQueue, clearQueue } = useOfflineQueue();

  // Trigger sync when dashboard loads and we're online with a queue
  useEffect(() => {
    if (isOnline && queue.length > 0) syncQueue();
  }, [isOnline]);

  useEffect(() => {
    Promise.all([
      base44.entities.Transaction.list('-transaction_date', 100),
      base44.entities.Product.list(),
      base44.entities.CarbonTarget.filter({ is_active: true }),
      base44.entities.Shift.list('-shift_start', 20),
    ]).then(([txns, prods, targets, shiftData]) => {
      setTransactions(txns);
      setProducts(prods);
      setCarbonTargets(targets);
      setShifts(shiftData);
    }).finally(() => setLoading(false));
  }, []);

  // Carbon aggregates
  const totalCO2e = transactions.reduce((sum, t) => sum + (t.total_kg_co2e || 0), 0);
  const upstreamCO2e = transactions.reduce((sum, t) => sum + (t.upstream_kg_co2e || 0), 0);
  const downstreamCO2e = transactions.reduce((sum, t) => sum + (t.downstream_kg_co2e || 0), 0);
  const pendingMapping = products.filter(p => p.emission_mapping_status === 'Pending' || p.emission_mapping_status === 'Flagged').length;

  const monthlyData = getMonthlyData(transactions);
  const categoryData = getCategoryBreakdown(transactions);

  const activeTarget = carbonTargets.find(t => t.scope === 'Company-wide') || carbonTargets[0] || null;
  const NET_ZERO_TARGET = activeTarget?.annual_kg_co2e || null;
  const progressPct = NET_ZERO_TARGET ? Math.min((totalCO2e / NET_ZERO_TARGET) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tab === 'business' ? 'Sales performance & operations overview' : 'Scope 3 emissions — UK Net Zero compliance'}
          </p>
        </div>
        {/* Tab switcher */}
        <div className="flex bg-muted rounded-lg p-1 gap-1 self-start sm:self-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sync banner (always visible) */}
      <SyncStatusBanner
        queueCount={queue.length}
        isOnline={isOnline}
        syncing={syncing}
        onRetry={syncQueue}
        onClear={clearQueue}
      />

      {/* BUSINESS TAB */}
      {tab === 'business' && (
        <BusinessDashboard transactions={transactions} products={products} shifts={shifts} />
      )}

      {/* CARBON TAB */}
      {tab === 'carbon' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Leaf className="w-4 h-4 text-primary" />
            <span>Data sources: DEFRA 2024 / Climatiq.io</span>
          </div>

          {/* Carbon KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Scope 3 Emissions" value={`${totalCO2e.toFixed(2)} kg`} subtitle="CO₂e — all transactions" icon={Leaf} color="green" />
            <KpiCard title="Upstream Emissions" value={`${upstreamCO2e.toFixed(2)} kg`} subtitle="Category 1 — Purchased Goods" icon={ArrowUpRight} color="blue" />
            <KpiCard title="Downstream Emissions" value={`${downstreamCO2e.toFixed(2)} kg`} subtitle="Category 11 — Sold Products" icon={ArrowDownRight} color="purple" />
            <KpiCard title="Pending Mapping" value={pendingMapping} subtitle="Products need emission factors" icon={AlertCircle} color={pendingMapping > 0 ? 'amber' : 'green'} />
          </div>

          {/* Net Zero Progress */}
          {NET_ZERO_TARGET ? (
            <NetZeroProgress current={totalCO2e} target={NET_ZERO_TARGET} progressPct={progressPct} />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-amber-800">No carbon target set. <a href="/settings" className="font-semibold underline">Go to Settings</a> to add your annual Scope 3 budget.</span>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="font-semibold text-foreground mb-4">By Category</h3>
              {categoryData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                        {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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

          {/* Recent transactions with carbon */}
          <div className="bg-white rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Emission Audit — Recent Transactions</h3>
            </div>
            <div className="divide-y divide-border">
              {transactions.slice(0, 5).map(t => (
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
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">No transactions yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
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