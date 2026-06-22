import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, ShoppingBag, Truck, Package, Store } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = { new: 'bg-blue-100 text-blue-700', confirmed: 'bg-purple-100 text-purple-700', picking: 'bg-amber-100 text-amber-700', ready: 'bg-cyan-100 text-cyan-700', shipped: 'bg-indigo-100 text-indigo-700', delivered: 'bg-green-100 text-green-700', picked_up: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const fulfillmentIcons = { delivery: Truck, pickup: Store, bopis: Store, ship_from_store: Package };

export default function Ecommerce() {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const load = async () => { setLoading(true); try { const [o, s] = await Promise.all([base44.entities.OnlineOrder.list('-order_date', 100), base44.entities.Store.list()]); setOrders(o); setStores(s); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);
  const advanceStatus = async (order) => {
    const flow = ['new', 'confirmed', 'picking', 'ready', 'shipped', 'delivered'];
    const idx = flow.indexOf(order.status);
    if (idx >= 0 && idx < flow.length - 1) { try { await base44.entities.OnlineOrder.update(order.id, { status: flow[idx + 1] }); toast.success(`Status → ${flow[idx + 1]}`); load(); } catch (e) { toast.error(e.message); } }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">E-commerce Orders</h1><p className="text-sm text-muted-foreground mt-0.5">Online orders with BOPIS, ship-from-store, and delivery fulfillment</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Online Order</Button>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'new', 'confirmed', 'picking', 'ready', 'shipped', 'delivered', 'picked_up', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>{s.replace(/_/g, ' ')}</button>
        ))}
      </div>
      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Order Ref</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Customer</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th></tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.map(o => { const FIcon = fulfillmentIcons[o.fulfillment_type] || ShoppingBag; return (
                <tr key={o.id} className="hover:bg-muted/30"><td className="px-4 py-3 text-sm font-mono">{o.order_ref}</td><td className="px-4 py-3 text-sm font-medium">{o.customer_name}</td><td className="px-4 py-3 text-sm"><span className="flex items-center gap-1 text-muted-foreground capitalize"><FIcon className="w-3 h-3" />{o.fulfillment_type.replace(/_/g, ' ')}</span></td><td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[o.status]}`}>{o.status.replace(/_/g, ' ')}</span></td><td className="px-4 py-3 text-sm font-semibold text-right">£{(o.total_amount || 0).toFixed(2)}</td><td className="px-4 py-3 text-sm text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}</td><td className="px-4 py-3 text-right">{o.status !== 'delivered' && o.status !== 'picked_up' && o.status !== 'cancelled' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceStatus(o)}>Advance →</Button>}</td></tr>
              ); })}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No online orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <OnlineOrderModal stores={stores} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function OnlineOrderModal({ stores, onClose, onSaved }) {
  const [form, setForm] = useState({ customer_name: '', customer_email: '', fulfillment_type: 'delivery', delivery_address: '', store_id: '', notes: '', items_text: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.customer_name) { toast.error('Enter customer name'); return; }
    setSaving(true);
    try {
      const store = stores.find(s => s.id === form.store_id);
      const items = form.items_text.split('\n').filter(l => l.trim()).map(l => { const [name, qty, price] = l.split(',').map(s => s.trim()); return { product_name: name || '', quantity: parseFloat(qty) || 1, unit_price: parseFloat(price) || 0, line_total: (parseFloat(qty) || 1) * (parseFloat(price) || 0) }; });
      const subtotal = items.reduce((s, i) => s + i.line_total, 0);
      await base44.entities.OnlineOrder.create({ order_ref: `WEB-${Date.now()}`, customer_name: form.customer_name, customer_email: form.customer_email, fulfillment_type: form.fulfillment_type, status: 'new', items, subtotal, shipping_cost: 0, total_amount: subtotal, delivery_address: form.delivery_address, store_id: form.store_id, store_name: store?.name || '', order_date: new Date().toISOString(), notes: form.notes });
      toast.success('Online order created'); onSaved();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Online Order</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Customer Name *</Label><Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.customer_email} onChange={e => set('customer_email', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Fulfillment</Label><Select value={form.fulfillment_type} onValueChange={v => set('fulfillment_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="delivery">Delivery</SelectItem><SelectItem value="pickup">Pickup</SelectItem><SelectItem value="bopis">BOPIS</SelectItem><SelectItem value="ship_from_store">Ship from Store</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Fulfilling Store</Label><Select value={form.store_id} onValueChange={v => set('store_id', v)}><SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger><SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {form.fulfillment_type === 'delivery' && <div className="space-y-1.5"><Label>Delivery Address</Label><Input value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} /></div>}
        <div className="space-y-1.5"><Label>Items (one per line: name, qty, price)</Label><textarea className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring" rows={4} value={form.items_text} onChange={e => set('items_text', e.target.value)} placeholder="Coffee Beans, 2, 12.50&#10;Mug, 1, 8.00" />
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Order'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}