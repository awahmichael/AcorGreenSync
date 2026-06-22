import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, RotateCcw, ArrowLeft, Leaf, PoundSterling, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const REASON_LABELS = {
  faulty: 'Faulty Product',
  unwanted: 'Unwanted',
  wrong_item: 'Wrong Item',
  damaged: 'Damaged',
  other: 'Other',
};

const METHOD_LABELS = {
  original: 'Original Payment Method',
  cash: 'Cash',
  card: 'Card',
  store_credit: 'Store Credit',
};

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [foundTxn, setFoundTxn] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [refundMethod, setRefundMethod] = useState('original');
  const [reason, setReason] = useState('unwanted');
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Return.list('-return_date', 100).then(setReturns).finally(() => setLoading(false));
  }, []);

  const searchTransaction = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setFoundTxn(null);
    try {
      const txns = await base44.entities.Transaction.filter({ transaction_ref: searchQuery.trim() });
      const txn = txns[0] || null;
      if (txn) {
        setFoundTxn(txn);
        const initial = {};
        (txn.items || []).forEach((item, i) => { initial[i] = false; });
        setSelectedItems(initial);
      } else {
        toast.error('Transaction not found');
      }
    } catch {
      toast.error('Search failed');
    }
    setSearching(false);
  };

  const toggleItem = (idx) => {
    setSelectedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const setReturnQty = (idx, qty) => {
    setSelectedItems(prev => ({ ...prev, [`qty_${idx}`]: qty }));
  };

  const selectedReturnItems = () => {
    if (!foundTxn) return [];
    return (foundTxn.items || []).filter((_, i) => selectedItems[i])
      .map((item, i) => {
        const qty = selectedItems[`qty_${i}`] || item.quantity;
        const ratio = qty / item.quantity;
        return {
          product_name: item.product_name,
          quantity: qty,
          unit_price: item.unit_price,
          kg_co2e: (item.kg_co2e || 0) * ratio,
        };
      });
  };

  const refundTotal = selectedReturnItems().reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const carbonReversal = selectedReturnItems().reduce((s, i) => s + (i.kg_co2e || 0), 0);

  const processReturn = async () => {
    const items = selectedReturnItems();
    if (items.length === 0) { toast.error('Select at least one item to return'); return; }
    setProcessing(true);
    try {
      const returnRef = `RET-${Date.now()}`;
      await base44.entities.Return.create({
        return_ref: returnRef,
        original_transaction_ref: foundTxn.transaction_ref,
        original_transaction_id: foundTxn.id,
        return_items: items,
        refund_amount: refundTotal,
        refund_method: refundMethod,
        reason,
        processed_by: 'Cashier',
        return_date: new Date().toISOString(),
        carbon_reversal_kg_co2e: carbonReversal,
        store_name: foundTxn.store_name,
      });

      // Restock returned items
      await Promise.allSettled(items.map(async (item) => {
        const products = await base44.entities.Product.filter({ name: item.product_name });
        if (products[0]) {
          const newQty = (products[0].stock_quantity || 0) + item.quantity;
          await base44.entities.Product.update(products[0].id, { stock_quantity: newQty });
        }
      }));

      toast.success(`Return processed — £${refundTotal.toFixed(2)} refunded, ${carbonReversal.toFixed(2)} kg CO₂e reversed`);
      setFoundTxn(null);
      setSelectedItems({});
      setSearchQuery('');
      setReturns(await base44.entities.Return.list('-return_date', 100));
    } catch (err) {
      toast.error(`Return failed: ${err.message}`);
    }
    setProcessing(false);
  };

  const totalRefunded = returns.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const totalCO2eReversed = returns.reduce((s, r) => s + (r.carbon_reversal_kg_co2e || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Returns & Refunds</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Process returns with automatic stock restock and carbon reversal</p>
      </div>

      {!foundTxn ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Returns', value: returns.length, color: 'text-primary' },
              { label: 'Refunded', value: `£${totalRefunded.toFixed(2)}`, color: 'text-red-500' },
              { label: 'CO₂e Reversed', value: `${totalCO2eReversed.toFixed(1)} kg`, color: 'text-green-500' },
              { label: 'Avg Refund', value: returns.length ? `£${(totalRefunded / returns.length).toFixed(2)}` : '£0', color: 'text-muted-foreground' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Search for transaction */}
          <div className="bg-white rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Find Original Transaction
            </h3>
            <div className="flex gap-3">
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchTransaction(); }}
                placeholder="Enter transaction reference (e.g. TXN-1234567890)"
                className="font-mono"
              />
              <Button onClick={searchTransaction} disabled={searching} className="bg-primary hover:bg-primary/90">
                {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Search
              </Button>
            </div>
          </div>

          {/* Recent returns */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Recent Returns</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Return Ref</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Original Txn</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Reason</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Refund</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">CO₂e Reversed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : returns.map(r => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs">{r.return_ref}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.original_transaction_ref}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.return_date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{REASON_LABELS[r.reason] || r.reason}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-500">-£{(r.refund_amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-primary font-medium">{(r.carbon_reversal_kg_co2e || 0).toFixed(2)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && returns.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">No returns processed yet.</div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Return processing view */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Processing Return for {foundTxn.transaction_ref}</h3>
              <p className="text-xs text-muted-foreground">{new Date(foundTxn.transaction_date).toLocaleDateString('en-GB')} · {foundTxn.store_name} · £{(foundTxn.total_amount || 0).toFixed(2)} original total</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFoundTxn(null); setSelectedItems({}); }}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/40">
              <h4 className="text-sm font-semibold">Select items to return</h4>
            </div>
            <div className="divide-y divide-border">
              {(foundTxn.items || []).map((item, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedItems[i] || false}
                    onChange={() => toggleItem(i)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground">£{(item.unit_price || 0).toFixed(2)} each · {(item.kg_co2e || 0).toFixed(3)} kg CO₂e</div>
                  </div>
                  {selectedItems[i] && (
                    <Input
                      type="number"
                      min="1"
                      max={item.quantity}
                      value={selectedItems[`qty_${i}`] || item.quantity}
                      onChange={e => setReturnQty(i, Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-16 h-8 text-center"
                    />
                  )}
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Qty: {selectedItems[i] ? (selectedItems[`qty_${i}`] || item.quantity) : item.quantity}</div>
                    <div className="text-sm font-medium">£{((item.unit_price || 0) * (selectedItems[i] ? (selectedItems[`qty_${i}`] || item.quantity) : 0)).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Refund details */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Refund Method</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Items selected</span>
                <span className="font-medium">{selectedReturnItems().length}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="flex items-center gap-2"><PoundSterling className="w-4 h-4 text-red-500" /> Refund Total</span>
                <span className="text-red-500">£{refundTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-primary"><Leaf className="w-3.5 h-3.5" /> Carbon Reversal</span>
                <span className="font-medium text-primary">{carbonReversal.toFixed(3)} kg CO₂e</span>
              </div>
              <p className="text-xs text-muted-foreground">Returned items will be restocked automatically. The reversed CO₂e adjusts Scope 3 reporting.</p>
            </div>

            <Button onClick={processReturn} disabled={processing || selectedReturnItems().length === 0} className="w-full bg-primary hover:bg-primary/90">
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Process Return
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}