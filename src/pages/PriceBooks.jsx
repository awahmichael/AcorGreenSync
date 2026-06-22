import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Tag, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const tierColors = { retail: 'bg-gray-100 text-gray-700', trade: 'bg-blue-100 text-blue-700', wholesale: 'bg-purple-100 text-purple-700', vip: 'bg-amber-100 text-amber-700', staff: 'bg-green-100 text-green-700', custom: 'bg-pink-100 text-pink-700' };

export default function PriceBooks() {
  const [books, setBooks] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = async () => { setLoading(true); try { const [b, p] = await Promise.all([base44.entities.PriceBook.list('-created_date', 100), base44.entities.Product.list()]); setBooks(b); setProducts(p); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Price Books</h1><p className="text-sm text-muted-foreground mt-0.5">Multiple pricing tiers — retail, trade, wholesale, VIP, and staff</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Price Book</Button>
      </div>
      {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="space-y-3">
          {books.map(book => (
            <div key={book.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(expanded === book.id ? null : book.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tierColors[book.tier_type] || 'bg-gray-100'}`}><Tag className="w-4 h-4" /></div>
                  <div className="text-left"><div className="font-semibold text-foreground">{book.name}</div><div className="text-xs text-muted-foreground capitalize">{book.tier_type} · {book.default_discount_pct || 0}% off retail · {(book.product_overrides || []).length} overrides</div></div>
                </div>
                {expanded === book.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expanded === book.id && (
                <div className="border-t border-border p-4">
                  {(book.product_overrides || []).length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Product</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Retail Price</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Tier Price</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Discount</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {book.product_overrides.map((o, i) => { const product = products.find(p => p.id === o.product_id); const retail = product?.price || 0; return (
                          <tr key={i}><td className="px-3 py-2 font-medium">{o.product_name}</td><td className="px-3 py-2 text-right text-muted-foreground">£{retail.toFixed(2)}</td><td className="px-3 py-2 text-right font-medium">£{(o.custom_price || 0).toFixed(2)}</td><td className="px-3 py-2 text-right text-green-600">{retail > 0 ? Math.round((1 - o.custom_price / retail) * 100) : 0}%</td></tr>
                        ); })}
                      </tbody>
                    </table>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">No product-specific overrides. Default discount: {book.default_discount_pct || 0}% off retail.</p>}
                  <div className="flex justify-end mt-3">
                    <Button size="sm" variant="ghost" className="text-destructive h-7 text-xs" onClick={async () => { await base44.entities.PriceBook.delete(book.id); toast.success('Price book deleted'); load(); }}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {books.length === 0 && <div className="text-center py-16 text-muted-foreground"><Tag className="w-12 h-12 mx-auto opacity-30 mb-3" /><p>No price books created yet.</p></div>}
        </div>
      )}
      {showModal && <PriceBookModal products={products} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function PriceBookModal({ products, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', tier_type: 'retail', default_discount_pct: 0, min_quantity: 1, notes: '' });
  const [overrides, setOverrides] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const addOverride = () => setOverrides(prev => [...prev, { product_id: '', product_name: '', custom_price: 0 }]);
  const updateOverride = (idx, key, val) => setOverrides(prev => prev.map((o, i) => { if (i !== idx) return o; const upd = { ...o, [key]: val }; if (key === 'product_id') { const p = products.find(x => x.id === val); upd.product_name = p?.name || ''; upd.custom_price = p?.price || 0; } return upd; }));
  const removeOverride = (idx) => setOverrides(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.name) { toast.error('Enter a name'); return; }
    setSaving(true);
    try { await base44.entities.PriceBook.create({ ...form, default_discount_pct: parseFloat(form.default_discount_pct) || 0, min_quantity: parseInt(form.min_quantity) || 1, product_overrides: overrides, is_active: true }); toast.success('Price book created'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Price Book</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Trade Pricing" /></div><div className="space-y-1.5"><Label>Tier Type</Label><Select value={form.tier_type} onValueChange={v => set('tier_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="retail">Retail</SelectItem><SelectItem value="trade">Trade</SelectItem><SelectItem value="wholesale">Wholesale</SelectItem><SelectItem value="vip">VIP</SelectItem><SelectItem value="staff">Staff</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Default Discount %</Label><Input type="number" step="0.1" value={form.default_discount_pct} onChange={e => set('default_discount_pct', e.target.value)} /></div><div className="space-y-1.5"><Label>Min Quantity</Label><Input type="number" min="1" value={form.min_quantity} onChange={e => set('min_quantity', e.target.value)} /></div></div>
        <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Product Overrides</Label><Button size="sm" variant="outline" onClick={addOverride}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button></div>
          {overrides.map((o, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1"><Select value={o.product_id} onValueChange={v => updateOverride(idx, 'product_id', v)}><SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <Input type="number" step="0.01" value={o.custom_price} onChange={e => updateOverride(idx, 'custom_price', parseFloat(e.target.value) || 0)} className="w-24 h-8" placeholder="Price" />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOverride(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Price Book'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}