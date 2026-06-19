import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PendingEmissionsPanel() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Transaction.filter({ sync_status: 'pending_emission_calc' }),
      base44.entities.Product.list(),
    ]).then(([txns, prods]) => {
      setTransactions(txns);
      setProducts(prods);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Recalculate emissions for a transaction using current product factors
  const resolveOne = async (txn) => {
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));
    const updatedItems = (txn.items || []).map(item => {
      const product = productMap[item.product_id];
      const factor = product?.emission_factor_defra || product?.emission_factor_climatiq || 0;
      return { ...item, emission_factor: factor, emission_factor_source: product?.emission_factor_source || 'Pending', kg_co2e: factor * item.quantity };
    });
    const total_kg_co2e = updatedItems.reduce((s, i) => s + i.kg_co2e, 0);
    const upstream = updatedItems.filter(i => i.scope3_category !== 'Category_11_Use_of_Sold_Products').reduce((s, i) => s + i.kg_co2e, 0);
    const downstream = updatedItems.filter(i => i.scope3_category !== 'Category_1_Purchased_Goods').reduce((s, i) => s + i.kg_co2e, 0);

    await base44.entities.Transaction.update(txn.id, {
      items: updatedItems,
      total_kg_co2e,
      upstream_kg_co2e: upstream,
      downstream_kg_co2e: downstream,
      sync_status: 'synced',
    });
  };

  const resolveAll = async () => {
    setResolving(true);
    await Promise.allSettled(transactions.map(resolveOne));
    toast.success(`${transactions.length} transaction(s) resolved`);
    load();
    setResolving(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            These transactions were recorded when product emission factors were missing. Resolve them now to recalculate CO₂e using current factors.
          </p>
        </div>
        {transactions.length > 0 && (
          <Button size="sm" onClick={resolveAll} disabled={resolving} className="shrink-0">
            {resolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Resolve All ({transactions.length})
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Transactions with Pending Emission Calculation</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${transactions.length > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {transactions.length} pending
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-green-700 text-sm flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            No pending emission calculations. All transactions are resolved.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Ref</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Store</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Items</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs">{t.transaction_ref}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.store_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">£{(t.total_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{(t.items || []).length}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => resolveOne(t).then(load)} className="text-xs text-primary hover:underline">Resolve</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}