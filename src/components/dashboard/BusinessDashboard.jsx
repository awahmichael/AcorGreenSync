import { useMemo } from 'react';
import { ShoppingCart, TrendingUp, Package, Users, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KpiCard from '@/components/dashboard/KpiCard';

export default function BusinessDashboard({ transactions, products, shifts }) {
  const today = new Date().toDateString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const todayTxns = transactions.filter(t => new Date(t.transaction_date).toDateString() === today);
  const weekTxns = transactions.filter(t => new Date(t.transaction_date) >= weekAgo);

  const revenueToday = todayTxns.reduce((s, t) => s + (t.total_amount || 0), 0);
  const revenueWeek = weekTxns.reduce((s, t) => s + (t.total_amount || 0), 0);
  const revenueMonth = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    return transactions.filter(t => new Date(t.transaction_date) >= start).reduce((s, t) => s + (t.total_amount || 0), 0);
  }, [transactions]);

  const avgBasket = weekTxns.length ? revenueWeek / weekTxns.length : 0;
  const lowStock = products.filter(p => (p.stock_quantity || 0) <= 5 && p.is_active);
  const openShift = shifts.find(s => s.status === 'open');

  // Daily revenue for the last 7 days
  const dailyRevenue = useMemo(() => {
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toDateString();
      days[key] = { day: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), revenue: 0, txns: 0 };
    }
    weekTxns.forEach(t => {
      const key = new Date(t.transaction_date).toDateString();
      if (days[key]) { days[key].revenue += t.total_amount || 0; days[key].txns++; }
    });
    return Object.values(days);
  }, [weekTxns]);

  // Top products by revenue this week
  const topProducts = useMemo(() => {
    const map = {};
    weekTxns.forEach(t => {
      (t.items || []).forEach(item => {
        if (!map[item.product_name]) map[item.product_name] = { name: item.product_name, revenue: 0, qty: 0 };
        map[item.product_name].revenue += (item.unit_price || 0) * (item.quantity || 0);
        map[item.product_name].qty += item.quantity || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [weekTxns]);

  // Sales by category this week
  const categoryRevenue = useMemo(() => {
    const map = {};
    weekTxns.forEach(t => {
      (t.items || []).forEach(item => {
        const cat = item.category || 'Other';
        if (!map[cat]) map[cat] = 0;
        map[cat] += (item.unit_price || 0) * (item.quantity || 0);
      });
    });
    return Object.entries(map).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [weekTxns]);

  return (
    <div className="space-y-6">
      {/* Shift status banner */}
      {openShift && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium">Shift open</span>
            <span className="text-green-700">— {openShift.cashier_name} · {openShift.store_name}</span>
          </div>
          <span className="text-green-600 text-xs">Since {new Date(openShift.shift_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Revenue Today" value={`£${revenueToday.toFixed(2)}`} subtitle={`${todayTxns.length} transaction${todayTxns.length !== 1 ? 's' : ''}`} icon={TrendingUp} color="green" />
        <KpiCard title="Revenue This Week" value={`£${revenueWeek.toFixed(2)}`} subtitle={`${weekTxns.length} transactions`} icon={ShoppingCart} color="blue" />
        <KpiCard title="Avg Basket Value" value={`£${avgBasket.toFixed(2)}`} subtitle="7-day average" icon={ArrowUpRight} color="purple" />
        <KpiCard title="Low Stock Alerts" value={lowStock.length} subtitle="Products ≤ 5 units left" icon={AlertTriangle} color={lowStock.length > 0 ? 'amber' : 'green'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-day revenue bar chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Revenue — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyRevenue} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `£${v}`} />
              <Tooltip formatter={v => [`£${Number(v).toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue this month summary */}
        <div className="bg-white rounded-xl border border-border p-5 flex flex-col justify-between">
          <h3 className="font-semibold text-foreground mb-4">This Month</h3>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-primary">£{revenueMonth.toFixed(2)}</div>
            </div>
            <div className="space-y-2">
              {categoryRevenue.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[120px]">{c.name}</span>
                  <span className="font-medium text-foreground">£{c.revenue.toFixed(2)}</span>
                </div>
              ))}
              {categoryRevenue.length === 0 && <p className="text-sm text-muted-foreground">No sales data yet</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4">Top Products This Week</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">£{p.revenue.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{p.qty} sold</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No sales this week yet</p>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Low Stock Alerts
          </h3>
          {lowStock.length > 0 ? (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.category}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock_quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.stock_quantity === 0 ? 'Out of stock' : `${p.stock_quantity} left`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">All products well stocked ✓</div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-xl border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Recent Transactions</h3>
          <a href="/pos" className="text-xs text-primary hover:underline">Go to POS →</a>
        </div>
        <div className="divide-y divide-border">
          {transactions.slice(0, 6).map(t => (
            <div key={t.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">{t.transaction_ref}</div>
                <div className="text-xs text-muted-foreground">{t.store_name} · {new Date(t.transaction_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-foreground">£{(t.total_amount || 0).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground capitalize">{t.payment_method || 'card'}</div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="px-5 py-8 text-center text-muted-foreground text-sm">No transactions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}