import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Store, Radio, TrendingUp, ShoppingCart, Leaf, Activity, Zap } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization.jsx';

export default function LiveStoreMonitor({ stores, transactions: initialTxns }) {
  const [liveTxns, setLiveTxns] = useState(initialTxns || []);
  const [pulse, setPulse] = useState(false);
  const { organizationId } = useOrganization();
  const mountedRef = useRef(true);

  // Subscribe to real-time transaction events
  useEffect(() => {
    mountedRef.current = true;
    if (!organizationId) return;

    const unsubscribe = base44.entities.Transaction.subscribe((event) => {
      if (!mountedRef.current) return;

      setPulse(true);
      setTimeout(() => setPulse(false), 1000);

      if (event.type === 'create') {
        setLiveTxns(prev => [event.data, ...prev].slice(0, 100));
      } else if (event.type === 'update') {
        setLiveTxns(prev => prev.map(t => t.id === event.data.id ? event.data : t));
      } else if (event.type === 'delete') {
        setLiveTxns(prev => prev.filter(t => t.id !== event.data.id));
      }
    });

    return () => {
      mountedRef.current = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [organizationId]);

  // Group by store
  const storeStats = stores.map(store => {
    const storeTxns = liveTxns.filter(t => t.store_id === store.id || t.store_name === store.name);
    const today = new Date().toDateString();
    const todayTxns = storeTxns.filter(t => t.transaction_date && new Date(t.transaction_date).toDateString() === today);
    return {
      ...store,
      todayRevenue: todayTxns.reduce((s, t) => s + (t.total_amount || 0), 0),
      todayCount: todayTxns.length,
      totalCO2e: todayTxns.reduce((s, t) => s + (t.total_kg_co2e || 0), 0),
      avgBasket: todayTxns.length ? todayTxns.reduce((s, t) => s + (t.total_amount || 0), 0) / todayTxns.length : 0,
      recentTxns: storeTxns.slice(0, 3),
    };
  });

  const totalTodayRevenue = storeStats.reduce((s, st) => s + st.todayRevenue, 0);
  const totalTodayCount = storeStats.reduce((s, st) => s + st.todayCount, 0);

  if (stores.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <Store className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No stores configured. Add stores in Settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Live status bar */}
      <div className="bg-white rounded-xl border border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${pulse ? 'bg-green-500 animate-ping' : 'bg-green-500'} `} />
          <div>
            <div className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Live Multi-Store Monitor
            </div>
            <div className="text-xs text-muted-foreground">
              {stores.length} stores · {totalTodayCount} transactions today · £{totalTodayRevenue.toFixed(2)} revenue
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full font-medium">
          <Activity className="w-3.5 h-3.5" />
          Real-time
        </div>
      </div>

      {/* Store cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {storeStats.map(store => (
          <div key={store.id} className="bg-white rounded-xl border border-border p-5 space-y-4 relative overflow-hidden">
            {/* Pulse overlay */}
            {pulse && (
              <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            )}

            {/* Store header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  {store.name}
                </div>
                <div className="text-xs text-muted-foreground">{store.location || 'No location set'}</div>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${pulse ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Revenue
                </div>
                <div className="text-lg font-bold text-foreground">£{store.todayRevenue.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3" /> Sales
                </div>
                <div className="text-lg font-bold text-foreground">{store.todayCount}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Leaf className="w-3 h-3" /> CO₂e
                </div>
                <div className="text-lg font-bold text-primary">{store.totalCO2e.toFixed(1)}</div>
              </div>
            </div>

            {/* Avg basket */}
            <div className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">Avg Basket</span>
              <span className="font-semibold text-foreground">£{store.avgBasket.toFixed(2)}</span>
            </div>

            {/* Recent activity */}
            {store.recentTxns.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Latest
                </div>
                {store.recentTxns.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                    <span className="text-muted-foreground font-mono">{t.transaction_ref?.slice(-8)}</span>
                    <span className="font-medium text-foreground">£{(t.total_amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-2">No sales today yet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}