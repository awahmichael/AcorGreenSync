import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StockTransferModal({ onClose, onSaved }) {
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ from_store_id: '', to_store_id: '', notes: '' });
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Store.filter({ is_active: true }).then(setStores).catch(() => {});
    base44.entities.Product.filter({ is_active: true }).then(setProducts).catch(() => {});
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const addLineItem = () => setLineItems(prev => [...prev, { product_id: '', product_name: '', quantity: 1, unit: 'unit' }]);

  const updateLineItem = (idx, key, val) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: val };
      if (key === 'product_id') {
        const product = products.find(p => p.id === val);
        if (product) { updated.product_name = product.name; updated.unit = product.unit || 'unit'; }
      }
      return updated;
    }));
  };

  const removeLineItem = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.from_store_id || !form.to_store_id) { toast.error('Select both stores'); return; }
    if (form.from_store_id === form.to_store_id) { toast.error('Source and destination must differ'); return; }
    if (lineItems.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const fromStore = stores.find(s => s.id === form.from_store_id);
      const toStore = stores.find(s => s.id === form.to_store_id);
      await base44.entities.StockTransfer.create({
        transfer_ref: `ST-${Date.now()}`,
        from_store_id: form.from_store_id,
        from_store_name: fromStore?.name || '',
        to_store_id: form.to_store_id,
        to_store_name: toStore?.name || '',
        status: 'draft',
        items: lineItems,
        notes: form.notes,
      });
      toast.success('Stock transfer created');
      onSaved();
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From Store *</Label>
              <Select value={form.from_store_id} onValueChange={v => set('from_store_id', v)}>
                <SelectTrigger><SelectValue placeholder="Source store" /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To Store *</Label>
              <Select value={form.to_store_id} onValueChange={v => set('to_store_id', v)}>
                <SelectTrigger><SelectValue placeholder="Destination store" /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button size="sm" variant="outline" onClick={addLineItem}><Plus className="w-3.5 h-3.5 mr-1" />Add Item</Button>
            </div>
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={item.product_id} onValueChange={v => updateLineItem(idx, 'product_id', v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock_quantity || 0} in stock)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input type="number" min="1" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 0)} className="w-24 h-8" placeholder="Qty" />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeLineItem(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
            {lineItems.length === 0 && <p className="text-xs text-muted-foreground py-2">No items added yet.</p>}
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Transfer notes..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Transfer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}