import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Wrench, Clock, CheckCircle2, Package } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = { received: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', awaiting_parts: 'bg-orange-100 text-orange-700', completed: 'bg-green-100 text-green-700', delivered: 'bg-cyan-100 text-cyan-700', cancelled: 'bg-red-100 text-red-700' };
const serviceIcons = { repair: Wrench, customization: Package, alteration: Wrench, assembly: Package, other: Wrench };

export default function WorkOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const load = async () => { setLoading(true); try { const [o, p, s] = await Promise.all([base44.entities.WorkOrder.list('-received_date', 100), base44.entities.Product.list(), base44.entities.Store.list()]); setOrders(o); setProducts(p); setStores(s); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);
  const advanceStatus = async (order) => {
    const flow = ['received', 'in_progress', 'completed', 'delivered'];
    const idx = flow.indexOf(order.status);
    if (idx >= 0 && idx < flow.length - 1) { try { await base44.entities.WorkOrder.update(order.id, { status: flow[idx + 1], completed_date: flow[idx + 1] === 'completed' ? new Date().toISOString() : undefined }); toast.success(`Status → ${flow[idx + 1].replace(/_/g, ' ')}`); load(); } catch (e) { toast.error(e.message); } }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Work Orders</h1><p className="text-sm text-muted-foreground mt-0.5">Service management — repairs, customizations, alterations, and assemblies</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Work Order</Button>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'received', 'in_progress', 'awaiting_parts', 'completed', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>{s.replace(/_/g, ' ')}</button>
        ))}
      </div>
      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Ref</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Customer</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Service</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Assigned</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Charge</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th></tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.map(o => { const SIcon = serviceIcons[o.service_type] || Wrench; return (
                <tr key={o.id} className="hover:bg-muted/30"><td className="px-4 py-3 text-sm font-mono">{o.order_ref}</td><td className="px-4 py-3 text-sm"><div className="font-medium">{o.customer_name}</div><div className="text-xs text-muted-foreground">{o.customer_phone}</div></td><td className="px-4 py-3 text-sm">{o.product_name}</td><td className="px-4 py-3 text-sm"><span className="flex items-center gap-1 capitalize"><SIcon className="w-3 h-3 text-muted-foreground" />{o.service_type}</span></td><td className="px-4 py-3 text-sm text-muted-foreground">{o.assigned_to || 'Unassigned'}</td><td className="px-4 py-3 text-sm font-medium text-right">£{(o.total_charge || 0).toFixed(2)}</td><td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[o.status]}`}>{o.status.replace(/_/g, ' ')}</span></td><td className="px-4 py-3 text-right">{o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'completed' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceStatus(o)}>Advance →</Button>}</td></tr>
              ); })}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No work orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <WorkOrderModal products={products} stores={stores} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function WorkOrderModal({ products, stores, onClose, onSaved }) {
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', product_id: '', service_type: 'repair', description: '', assigned_to: '', labor_cost: 0, parts_cost: 0, deposit_paid: 0, store_id: '', expected_completion: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const totalCharge = (parseFloat(form.labor_cost) || 0) + (parseFloat(form.parts_cost) || 0);

  const handleSave = async () => {
    if (!form.customer_name || !form.product_id) { toast.error('Customer and product required'); return; }
    setSaving(true);
    try {
      const product = products.find(p => p.id === form.product_id);
      const store = stores.find(s => s.id === form.store_id);
      await base44.entities.WorkOrder.create({ order_ref: `WO-${Date.now()}`, customer_name: form.customer_name, customer_phone: form.customer_phone, product_id: form.product_id, product_name: product?.name || '', service_type: form.service_type, description: form.description, assigned_to: form.assigned_to, labor_cost: parseFloat(form.labor_cost) || 0, parts_cost: parseFloat(form.parts_cost) || 0, total_charge: totalCharge, deposit_paid: parseFloat(form.deposit_paid) || 0, status: 'received', store_id: form.store_id, store_name: store?.name || '', received_date: new Date().toISOString(), expected_completion: form.expected_completion, notes: form.notes });
      toast.success('Work order created'); onSaved();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Customer Name *</Label><Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div><div className="space-y-1.5"><Label>Phone</Label><Input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></div></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Product *</Label><Select value={form.product_id} onValueChange={v => set('product_id', v)}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Service Type</Label><Select value={form.service_type} onValueChange={v => set('service_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="repair">Repair</SelectItem><SelectItem value="customization">Customization</SelectItem><SelectItem value="alteration">Alteration</SelectItem><SelectItem value="assembly">Assembly</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
        </div>
        <div className="space-y-1.5"><Label>Description / Issue</Label><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Customer's issue or work required..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Assigned To</Label><Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Technician name" /></div>
          <div className="space-y-1.5"><Label>Expected Completion</Label><Input type="date" value={form.expected_completion} onChange={e => set('expected_completion', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Labor Cost (£)</Label><Input type="number" step="0.01" value={form.labor_cost} onChange={e => set('labor_cost', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Parts Cost (£)</Label><Input type="number" step="0.01" value={form.parts_cost} onChange={e => set('parts_cost', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Deposit (£)</Label><Input type="number" step="0.01" value={form.deposit_paid} onChange={e => set('deposit_paid', e.target.value)} /></div>
        </div>
        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2"><span className="text-sm font-medium">Total Charge</span><span className="text-lg font-bold text-primary">£{totalCharge.toFixed(2)}</span></div>
        <div className="space-y-1.5"><Label>Store</Label><Select value={form.store_id} onValueChange={v => set('store_id', v)}><SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger><SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Work Order'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}