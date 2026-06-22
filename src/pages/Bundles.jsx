import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Package, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';

const typeColors = { kit: 'bg-blue-100 text-blue-700', bundle: 'bg-purple-100 text-purple-700', assembly: 'bg-amber-100 text-amber-700', multipack: 'bg-green-100 text-green-700' };

export default function Bundles() {
  const [bundles, setBundles] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => { setLoading(true); try { const [b, p] = await Promise.all([base44.entities.ProductBundle.list('-created_date', 100), base44.entities.Product.list()]); setBundles(b); setProducts(p); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Kits & Bundles</h1><p className="text-sm text-muted-foreground mt-0.5">Assembled product sets — track component costs and bundle margins</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Bundle</Button>
      </div>
      {loading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map(b => (
            <div key={b.id} className="bg-white border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Layers className="w-4 h-4 text-primary" /></div><div><div className="font-semibold text-foreground">{b.name}</div><div className="text-xs text-muted-foreground">{b.sku || 'No SKU'}</div></div></div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${typeColors[b.bundle_type] || 'bg-gray-100'}`}>{b.bundle_type}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{b.description || `${(b.components || []).length} components`}</p>
              <div className="space-y-1.5 text-sm border-t border-border pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Bundle Price</span><span className="font-bold text-primary">£{(b.bundle_price || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Component Cost</span><span>£{(b.component_cost_total || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margin</span><span className="font-medium text-green-600">£{(b.margin_amount || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">In Stock</span><span>{b.stock_quantity || 0} assembled</span></div>
              </div>
              <div className="flex justify-end mt-3"><Button size="sm" variant="ghost" className="text-destructive h-7 text-xs" onClick={async () => { await base44.entities.ProductBundle.delete(b.id); load(); }}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button></div>
            </div>
          ))}
          {bundles.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground"><Layers className="w-12 h-12 mx-auto opacity-30 mb-3" /><p>No bundles created yet.</p></div>}
        </div>
      )}
      {showModal && <BundleModal products={products} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function BundleModal({ products, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', bundle_type: 'bundle', bundle_price: 0, sku: '', upc: '', category: '' });
  const [components, setComponents] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const addComp = () => setComponents(prev => [...prev, { product_id: '', product_name: '', quantity: 1, unit_cost: 0 }]);
  const updateComp = (idx, key, val) => setComponents(prev => prev.map((c, i) => { if (i !== idx) return c; const upd = { ...c, [key]: val }; if (key === 'product_id') { const p = products.find(x => x.id === val); upd.product_name = p?.name || ''; upd.unit_cost = p?.cost_price || 0; } return upd; }));
  const removeComp = (idx) => setComponents(prev => prev.filter((_, i) => i !== idx));
  const componentCost = components.reduce((s, c) => s + (c.unit_cost || 0) * (c.quantity || 0), 0);
  const margin = (parseFloat(form.bundle_price) || 0) - componentCost;

  const handleSave = async () => {
    if (!form.name || components.length === 0) { toast.error('Name and at least one component required'); return; }
    setSaving(true);
    try { await base44.entities.ProductBundle.create({ ...form, bundle_price: parseFloat(form.bundle_price) || 0, components, component_cost_total: componentCost, margin_amount: margin, stock_quantity: 0, is_active: true }); toast.success('Bundle created'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Kit / Bundle</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Bundle Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div><div className="space-y-1.5"><Label>Type</Label><Select value={form.bundle_type} onValueChange={v => set('bundle_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kit">Kit</SelectItem><SelectItem value="bundle">Bundle</SelectItem><SelectItem value="assembly">Assembly</SelectItem><SelectItem value="multipack">Multipack</SelectItem></SelectContent></Select></div></div>
        <div className="grid grid-cols-3 gap-3"><div className="space-y-1.5"><Label>SKU</Label><Input value={form.sku} onChange={e => set('sku', e.target.value)} /></div><div className="space-y-1.5"><Label>UPC</Label><Input value={form.upc} onChange={e => set('upc', e.target.value)} /></div><div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={e => set('category', e.target.value)} /></div></div>
        <div className="space-y-1.5"><Label>Bundle Price (£) *</Label><Input type="number" step="0.01" value={form.bundle_price} onChange={e => set('bundle_price', e.target.value)} /></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Components</Label><Button size="sm" variant="outline" onClick={addComp}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button></div>
          {components.map((c, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1"><Select value={c.product_id} onValueChange={v => updateComp(idx, 'product_id', v)}><SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <Input type="number" min="1" value={c.quantity} onChange={e => updateComp(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-16 h-8" placeholder="Qty" />
              <div className="w-24 text-right text-sm font-medium pb-1.5">£{((c.unit_cost || 0) * (c.quantity || 0)).toFixed(2)}</div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeComp(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 text-sm border-t border-border pt-2"><div className="flex justify-between"><span className="text-muted-foreground">Component Cost</span><span>£{componentCost.toFixed(2)}</span></div><div className="flex justify-between font-bold"><span>Margin</span><span className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>£{margin.toFixed(2)}</span></div></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Bundle'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}