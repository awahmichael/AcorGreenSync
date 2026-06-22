import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Monitor, ShoppingBag, Leaf, PoundSterling } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerDisplay() {
  const [transactions, setTransactions] = useState([]);
  const [latest, setLatest] = useState(null);
  const [mode, setMode] = useState('idle'); // idle | checkout | receipt

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const txns = await base44.entities.Transaction.list('-transaction_date', 1);
        if (mounted && txns[0]) setLatest(txns[0]);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const totalItems = latest?.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const totalCO2e = latest?.items?.reduce((s, i) => s + (i.kg_co2e || 0) * (i.quantity || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center"><Leaf className="w-5 h-5 text-white" /></div>
          <div><div className="font-bold text-lg">AcorCloud</div><div className="text-primary text-xs font-medium">Green-Sync POS</div></div>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Monitor className="w-4 h-4" /><span>Customer Display</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        {!latest ? (
          <div className="text-center">
            <ShoppingBag className="w-20 h-20 mx-auto text-white/20 mb-4" />
            <h2 className="text-3xl font-bold mb-2">Welcome</h2>
            <p className="text-white/50 text-lg">Scan items to begin checkout</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="bg-white/5 backdrop-blur rounded-3xl p-8 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div><div className="text-white/50 text-sm">Transaction</div><div className="font-mono font-bold text-lg">{latest.transaction_ref}</div></div>
                <div className="text-right"><div className="text-white/50 text-sm">Items</div><div className="font-bold text-2xl">{totalItems}</div></div>
              </div>

              {/* Items */}
              <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                {latest.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
                    <div className="flex-1"><div className="font-medium text-lg">{item.product_name}</div><div className="text-white/40 text-sm">£{(item.unit_price || 0).toFixed(2)} × {item.quantity}</div></div>
                    <div className="font-bold text-xl">£{((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                {latest.discount_amount > 0 && (
                  <div className="flex justify-between text-white/70"><span className="text-lg">Discounts</span><span className="text-lg text-green-400">-£{(latest.discount_amount || 0).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold">Total</span>
                  <span className="text-4xl font-bold text-primary">£{(latest.total_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 text-primary"><Leaf className="w-5 h-5" /><span className="text-sm font-medium">Carbon Footprint</span></div>
                  <span className="text-lg font-bold text-primary">{totalCO2e.toFixed(3)} kg CO₂e</span>
                </div>
              </div>

              {/* Payment status */}
              <div className="mt-6 text-center">
                {latest.sync_status === 'synced' ? (
                  <div className="bg-green-500/20 text-green-400 rounded-xl py-3 font-semibold text-lg">✓ Payment Complete — Thank You!</div>
                ) : (
                  <div className="bg-amber-500/20 text-amber-400 rounded-xl py-3 font-semibold text-lg">Processing Payment...</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-white/10 flex items-center justify-between text-white/40 text-sm">
        <span>{new Date().toLocaleTimeString()}</span>
        <span className="flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5 text-primary" /> Tracking Scope 3 Carbon Emissions</span>
      </div>
    </div>
  );
}