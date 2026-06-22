import { useMemo, useState } from 'react';
import { Store, Leaf, TrendingUp, ShoppingCart, ArrowDownRight, ArrowUpRight, MapPin, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiCard from '@/components/dashboard/KpiCard';

const CHART_COLORS = ['#16A34A', '#2563EB', '#7C3AED', '#EA580C', '#0891B2', '#DB2777'];

export default function StoreComparison({ transactions, stores }) {
  const [selectedStores, setSelectedStores] = useState([]);

  // Group transactions by store_id
  const storeData = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const key = t.store_id || t.store_name || 'unknown';
      if (!map[key]) {
        const store = stores.find(s => s.id === key);
        map[key] = {
          store_id: key,
          store_name: store?.name || t.store_name || 'Unknown Store',
          location: store?.location || '',
          revenue: 0,
          co2e: 0,
          upstream: 0,
          downstream: 0,
          txns: 0,
        };
      }
      map[key].revenue += t.total_amount || 0;
      map[key].co2e += t.total_kg_co2e || 0;
      map[key].upstream += t.upstream_kg_co2e || 0;
      map[key].downstream += t.downstream_kg_co2e || 0;
      map[key].txns++;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [transactions, stores]);

  // Default select all stores
  const activeStores = selectedStores.length === 0 ? storeData : storeData.filter(s => selectedStores.includes(s.store_id));

  const toggleStore = (id) => {
    setSelectedStores(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedStores([]);
  const clearAll = () => setSelectedStores(['__none__']);

  // Totals across active stores
  const totals = activeStores.reduce((acc, s) => ({
    revenue: acc.revenue + s.revenue,
    co2e: acc.co2e + s.co2e,
    upstream: acc.upstream + s.upstream,
    downstream: acc.downstream + s.downstream,
    txns: acc.txns + s.txns,
  }), { revenue: 0, co2e: 0, upstream: 0, downstream: 0, txns: 0 });

  const avgBasket = totals.txns ? totals.revenue / totals.txns : 0;
  const carbonIntensity = totals.revenue ? totals.co2e / totals.revenue : 0;

  // Best performer (lowest carbon intensity)
  const ranked = [...activeStores]
    .map(s => ({ ...s, intensity: s.revenue ? s.co2e / s.revenue : 0 }))
    .sort((a, b) => a.intensity - b.intensity);
  const bestPerformer = ranked[0];

  // Chart data
  const revenueChartData = activeStores.map(s => ({
    name: s.store_name.length > 15 ? s.store_name.slice(0, 13) + '…' : s.store_name,
    revenue: Number(s.revenue.toFixed(2)),
  }));

  const carbonChartData = activeStores.map(s => ({
    name: s.store_name.length > 15 ? s.store_name.slice(0, 13) + '…' : s.store_name,
    upstream: Number(s.upstream.toFixed(2)),
    downstream: Number(s.downstream.toFixed(2)),
  }));

  if (storeData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <Store className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No store transaction data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Store toggle bar */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Select Stores to Compare</h3>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={selectAll} className="text-primary hover:underline font-medium">Select All</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={clearAll} className="text-muted-foreground hover:underline">Clear</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {storeData.map(s => {
            const isActive = selectedStores.length === 0 || selectedStores.includes(s.store_id);
            return (
              <button
                key={s.store_id}
                onClick={() => toggleStore(s.store_id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  isActive
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted border-transparent text-muted-foreground hover:bg-accent'
                }`}
              >
                <MapPin className="w-3 h-3" />
                {s.store_name}
                {s.location && <span className="opacity-60">· {s.location}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Combined Revenue" value={`£${totals.revenue.toFixed(2)}`} subtitle={`${totals.txns} transactions`} icon={TrendingUp} color="green" />
        <KpiCard title="Combined CO₂e" value={`${totals.co2e.toFixed(2)} kg`} subtitle="Scope 3 total" icon={Leaf} color="blue" />
        <KpiCard title="Avg Basket" value={`£${avgBasket.toFixed(2)}`} subtitle="across active stores" icon={ShoppingCart} color="purple" />
        <KpiCard title="Carbon Intensity" value={`${carbonIntensity.toFixed(3)} kg/£`} subtitle="CO₂e per £ revenue" icon={ArrowDownRight} color={carbonIntensity < 0.5 ? 'green' : 'amber'} />
      </div>

      {/* Best performer banner */}
      {bestPerformer && activeStores.length > 1 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div>
              <div className="text-sm font-semibold text-foreground">Best Carbon Performer: {bestPerformer.store_name}</div>
              <div className="text-xs text-muted-foreground">
                {bestPerformer.intensity.toFixed(3)} kg CO₂e per £ revenue · {bestPerformer.co2e.toFixed(2)} kg total
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="text-sm font-bold text-foreground">£{bestPerformer.revenue.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue comparison bar chart */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Revenue by Store</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueChartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `£${v}`} />
              <Tooltip formatter={v => [`£${Number(v).toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Carbon comparison stacked bar chart */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">CO₂e by Store (Upstream vs Downstream)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={carbonChartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}kg`} />
              <Tooltip formatter={v => [`${Number(v).toFixed(2)} kg CO₂e`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="upstream" stackId="a" fill="#2563EB" name="Upstream (Cat 1)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="downstream" stackId="a" fill="#7C3AED" name="Downstream (Cat 11)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Store Comparison Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Store</th>
                <th className="text-right px-5 py-3 font-semibold">Revenue</th>
                <th className="text-right px-5 py-3 font-semibold">Transactions</th>
                <th className="text-right px-5 py-3 font-semibold">Avg Basket</th>
                <th className="text-right px-5 py-3 font-semibold">Total CO₂e</th>
                <th className="text-right px-5 py-3 font-semibold">Upstream</th>
                <th className="text-right px-5 py-3 font-semibold">Downstream</th>
                <th className="text-right px-5 py-3 font-semibold">kg/£ Intensity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.map((s, i) => (
                <tr key={s.store_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {i === 0 && activeStores.length > 1 && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                      <div>
                        <div className="font-medium text-foreground">{s.store_name}</div>
                        {s.location && <div className="text-xs text-muted-foreground">{s.location}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-5 py-3 font-medium text-foreground">£{s.revenue.toFixed(2)}</td>
                  <td className="text-right px-5 py-3 text-muted-foreground">{s.txns}</td>
                  <td className="text-right px-5 py-3 text-muted-foreground">£{s.txns ? (s.revenue / s.txns).toFixed(2) : '0.00'}</td>
                  <td className="text-right px-5 py-3 font-medium text-primary">{s.co2e.toFixed(2)}</td>
                  <td className="text-right px-5 py-3 text-blue-600">{s.upstream.toFixed(2)}</td>
                  <td className="text-right px-5 py-3 text-purple-600">{s.downstream.toFixed(2)}</td>
                  <td className="text-right px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.intensity < 0.3 ? 'bg-green-100 text-green-700' :
                      s.intensity < 0.6 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {i === 0 && activeStores.length > 1 ? <ArrowUpRight className="w-3 h-3" /> : null}
                      {s.intensity.toFixed(3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="px-5 py-3 text-foreground">Totals ({activeStores.length} stores)</td>
                <td className="text-right px-5 py-3 text-foreground">£{totals.revenue.toFixed(2)}</td>
                <td className="text-right px-5 py-3 text-foreground">{totals.txns}</td>
                <td className="text-right px-5 py-3 text-foreground">£{avgBasket.toFixed(2)}</td>
                <td className="text-right px-5 py-3 text-primary">{totals.co2e.toFixed(2)}</td>
                <td className="text-right px-5 py-3 text-blue-600">{totals.upstream.toFixed(2)}</td>
                <td className="text-right px-5 py-3 text-purple-600">{totals.downstream.toFixed(2)}</td>
                <td className="text-right px-5 py-3 text-foreground">{carbonIntensity.toFixed(3)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}