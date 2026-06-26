import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Package, Plus, ArrowUpDown, AlertTriangle, Search, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const MOVEMENT_LABELS = {
  purchase_in: { label: 'Purchase In', color: 'text-green-600 bg-green-50', sign: '+' },
  sale_out: { label: 'Sale Out', color: 'text-blue-600 bg-blue-50', sign: '-' },
  adjustment: { label: 'Adjustment', color: 'text-amber-600 bg-amber-50', sign: '±' },
  transfer_in: { label: 'Transfer In', color: 'text-purple-600 bg-purple-50', sign: '+' },
  transfer_out: { label: 'Transfer Out', color: 'text-purple-600 bg-purple-50', sign: '-' },
  wastage: { label: 'Wastage', color: 'text-red-600 bg-red-50', sign: '-' },
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    product_id: '', store_id: '', movement_type: 'purchase_in',
    quantity: '', reference: '', notes: '',
    movement_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    Promise.all([
      base44.entities.Product.filter({ is_current_version: true }),
      base44.entities.StockMovement.list('-movement_date', 100),
      base44.entities.Store.list(),
    ]).then(([p, m, s]) => { setProducts(p); setMovements(m); setStores(s); }).finally(() => setLoading(false));
  }, []);

  const saveMovement = async () => {
    if (!form.product_id || !form.quantity) { toast.error('Product and quantity required'); return; }
    const product = products.find(p => p.id === form.product_id);
    const store = stores.find(s => s.id === form.store_id);
    const qty = parseFloat(form.quantity);
    const isOut = ['sale_out', 'transfer_out', 'wastage'].includes(form.movement_type);
    const delta = isOut ? -qty : qty;

    await base44.entities.StockMovement.create({
      ...form,
      quantity: qty,
      product_name: product?.name || '',
      store_name: store?.name || '',
      unit: product?.unit || 'unit',
      movement_date: new Date(form.movement_date).toISOString(),
    });

    // Update product stock
    const newStock = Math.max(0, (product?.stock_quantity || 0) + delta);
    await base44.entities.Product.update(form.product_id, { stock_quantity: newStock });

    toast.success('Stock movement recorded');
    setShowModal(false);
    setForm({ product_id: '', store_id: '', movement_type: 'purchase_in', quantity: '', reference: '', notes: '', movement_date: new Date().toISOString().split('T')[0] });
    const [p, m] = await Promise.all([base44.entities.Product.filter({ is_current_version: true }), base44.entities.StockMovement.list('-movement_date', 100)]);
    setProducts(p); setMovements(m);
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = products.filter(p => (p.stock_quantity || 0) <= 5 && p.is_active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Stock levels, movements, and reorder alerts</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Record Movement
        </Button>
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-amber-800">Low Stock Alert: </span>
            <span className="text-amber-700">{lowStock.map(p => `${p.name} (${p.stock_quantity})`).join(', ')}</span>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total SKUs', value: products.length, icon: Package, color: 'text-primary' },
          { label: 'Low Stock', value: lowStock.length, icon: AlertTriangle, color: 'text-amber-500' },
          { label: 'Movements (30d)', value: movements.length, icon: ArrowUpDown, color: 'text-blue-500' },
          { label: 'Pending Mapping', value: products.filter(p => p.emission_mapping_status === 'Pending').length, icon: TrendingDown, color: 'text-purple-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      {/* Product stock table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Unit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.map(p => {
                const isLow = (p.stock_quantity || 0) <= 5;
                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className={`px-4 py-3 text-right font-bold ${isLow ? 'text-amber-600' : 'text-foreground'}`}>
                      {p.stock_quantity || 0} {isLow && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{p.unit || 'unit'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent movements */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Recent Stock Movements</h3>
        </div>
        <div className="divide-y divide-border">
          {movements.slice(0, 20).map(m => {
            const cfg = MOVEMENT_LABELS[m.movement_type] || MOVEMENT_LABELS.adjustment;
            return (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{m.product_name}</div>
                    <div className="text-xs text-muted-foreground">{m.store_name || '—'} · {new Date(m.movement_date).toLocaleDateString('en-GB')}</div>
                  </div>
                </div>
                <div className="text-sm font-bold">{cfg.sign}{m.quantity} {m.unit || 'unit'}</div>
              </div>
            );
          })}
          {movements.length === 0 && <div className="px-5 py-8 text-center text-muted-foreground text-sm">No movements recorded yet.</div>}
        </div>
      </div>

      {/* Movement modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Movement Type</Label>
                <Select value={form.movement_type} onValueChange={v => setForm(f => ({ ...f, movement_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MOVEMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Store</Label>
                <Select value={form.store_id} onValueChange={v => setForm(f => ({ ...f, store_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Store (optional)" /></SelectTrigger>
                  <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.movement_date} onChange={e => setForm(f => ({ ...f, movement_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reference (PO/Delivery Note)</Label>
              <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. PO-2026-001" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveMovement}>Save Movement</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}