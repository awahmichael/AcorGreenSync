import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, PackageSearch, Bell, BellRing, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = { pending: 'bg-amber-100 text-amber-700', ordered_from_supplier: 'bg-blue-100 text-blue-700', in_transit: 'bg-indigo-100 text-indigo-700', arrived: 'bg-cyan-100 text-cyan-700', notified: 'bg-purple-100 text-purple-700', collected: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

export default function SpecialOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const load = async () => { setLoading(true); try { const [o, p, sup, st] = await Promise.all([base44.entities.SpecialOrder.list('-order_date', 100), base44.entities.Product.list(), base44.entities.Supplier.filter({ is_active: true }), base44.entities.Store.list()]); setOrders(o); setProducts(p); setSuppliers(sup); setStores(st); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);
  const advanceStatus = async (order) => {
    const flow = ['pending', 'ordered_from_supplier', 'in_transit', 'arrived', 'notified', 'collected'];
    const idx = flow.indexOf(order.status);
    if (idx >= 0 && idx < flow.length - 1) { try { await base44.entities.SpecialOrder.update(order.id, { status: flow[idx + 1], collected_date: flow[idx + 1] === 'collected' ? new Date().toISOString() : undefined }); toast.success(`Status → ${flow[idx + 1].replace(/_/g, ' ')}`); load(); } catch (e) { toast.error(e.message); } }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Special Orders</h1><p className="text-sm text-muted-foreground mt-0.5">Back-orders for out-of-stock items — track from order to collection</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Special Order</Button>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'pending', 'ordered_from_supplier', 'in_transit', 'arrived', 'notified', 'collected', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>{s.replace(/_/g, ' ')}</button>
        ))}
      </div>
      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Order Ref</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Customer</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Qty</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Deposit</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">ETA</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th></tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-muted/30"><td className="px-4 py-3 text-sm font-mono">{o.order_ref}</td><td className="px-4 py-3 text-sm"><div className="font-medium">{o.customer_name}</div><div className="text-xs text-muted-foreground">{o.customer_phone}</div></td><td className="px-4 py-3 text-sm">{o.product_name}</td><td className="px-4 py-3 text-sm text-right">{o.quantity}</td><td className="px-4 py-3 text-sm text-right">£{(o.deposit_paid || 0).toFixed(2)}</td><td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[o.status]}`}>{o.status.replace(/_/g, ' ')}</span></td><td className="px-4 py-3 text-sm text-muted-foreground">{o.estimated_arrival || '—'}</td><td className="px-4 py-3 text-right">{o.status !== 'collected' && o.status !== 'cancelled' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceStatus(o)}>Advance →</Button>}</td></tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No special orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <SpecialOrderModal products={products} suppliers={suppliers} stores={stores} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function SpecialOrderModal({ products, suppliers, stores, onClose, onSaved }) {
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', product_id: '', quantity: 1, unit_price: 0, deposit_paid: 0, supplier_id: '', store_id: '', estimated_arrival: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleProductChange = (pid) => { const p = products.find(x => x.id === pid); set('product_id', pid); if (p) set('unit_price', p.price); };
  const handleSave = async () => {
    if (!form.customer_name || !form.product_id) { toast.error('Customer name and product are required'); return; }
    setSaving(true);
    try {
      const product = products.find(p => p.id === form.product_id);
      const supplier = suppliers.find(s => s.id === form.supplier_id);
      const store = stores.find(s => s.id === form.store_id);
      await base44.entities.SpecialOrder.create({ order_ref: `SO-${Date.now()}`, customer_name: form.customer_name, customer_phone: form.customer_phone, product_id: form.product_id, product_name: product?.name || '', quantity: form.quantity, unit_price: form.unit_price, deposit_paid: form.deposit_paid, status: 'pending', supplier_id: form.supplier_id, supplier_name: supplier?.name || '', store_id: form.store_id, store_name: store?.name || '', estimated_arrival: form.estimated_arrival, order_date: new Date().toISOString(), notes: form.notes });
      toast.success('Special order created'); onSaved();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Special Order</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Customer Name *</Label><Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label>Product *</Label><Select value={form.product_id} onValueChange={handleProductChange}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.stock_quantity <= 0 && '⚠ Out of stock'}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min="1" value={form.quantity} onChange={e => set('quantity', parseInt(e.target.value) || 1)} /></div>
          <div className="space-y-1.5"><Label>Unit Price (£)</Label><Input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', parseFloat(e.target.value) || 0)} /></div>
          <div className="space-y-1.5"><Label>Deposit (£)</Label><Input type="number" step="0.01" value={form.deposit_paid} onChange={e => set('deposit_paid', parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Supplier</Label><Select value={form.supplier_id} onValueChange={v => set('supplier_id', v)}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Store</Label><Select value={form.store_id} onValueChange={v => set('store_id', v)}><SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger><SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-1.5"><Label>Estimated Arrival</Label><Input type="date" value={form.estimated_arrival} onChange={e => set('estimated_arrival', e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Special Order'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}