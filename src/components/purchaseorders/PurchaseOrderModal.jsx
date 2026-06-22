import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PurchaseOrderModal({ onClose, onSaved }) {
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', store_id: '', expected_delivery_date: '', notes: '', shipping_cost: 0, duty_cost: 0, insurance_cost: 0 });
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Supplier.filter({ is_active: true }).then(setSuppliers).catch(() => {});
    base44.entities.Store.filter({ is_active: true }).then(setStores).catch(() => {});
    base44.entities.Product.filter({ is_active: true }).then(setProducts).catch(() => {});
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const addLineItem = () => setLineItems(prev => [...prev, { product_id: '', product_name: '', quantity_ordered: 1, unit_cost: 0, line_cost: 0 }]);

  const updateLineItem = (idx, key, val) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: val };
      if (key === 'product_id') {
        const product = products.find(p => p.id === val);
        if (product) { updated.product_name = product.name; updated.unit_cost = product.cost_price || 0; }
      }
      updated.line_cost = (updated.quantity_ordered || 0) * (updated.unit_cost || 0);
      return updated;
    }));
  };

  const removeLineItem = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = lineItems.reduce((sum, i) => sum + (i.line_cost || 0), 0);
  const landedCost = subtotal + (parseFloat(form.shipping_cost) || 0) + (parseFloat(form.duty_cost) || 0) + (parseFloat(form.insurance_cost) || 0);

  const handleSave = async () => {
    if (!form.supplier_id) { toast.error('Please select a supplier'); return; }
    if (lineItems.length === 0) { toast.error('Add at least one line item'); return; }
    setSaving(true);
    try {
      const supplier = suppliers.find(s => s.id === form.supplier_id);
      const store = stores.find(s => s.id === form.store_id);
      await base44.entities.PurchaseOrder.create({
        po_ref: `PO-${Date.now()}`,
        supplier_id: form.supplier_id,
        supplier_name: supplier?.name || '',
        store_id: form.store_id,
        store_name: store?.name || '',
        status: 'draft',
        items: lineItems.map(i => ({ ...i, quantity_received: 0 })),
        subtotal,
        shipping_cost: parseFloat(form.shipping_cost) || 0,
        duty_cost: parseFloat(form.duty_cost) || 0,
        insurance_cost: parseFloat(form.insurance_cost) || 0,
        landed_cost_total: landedCost,
        expected_delivery_date: form.expected_delivery_date || null,
        notes: form.notes,
        order_date: new Date().toISOString(),
      });
      toast.success('Purchase order created');
      onSaved();
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => set('supplier_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={form.store_id} onValueChange={v => set('store_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Expected Delivery</Label>
              <Input type="date" value={form.expected_delivery_date} onChange={e => set('expected_delivery_date', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button size="sm" variant="outline" onClick={addLineItem}><Plus className="w-3.5 h-3.5 mr-1" />Add Item</Button>
            </div>
            {lineItems.map((item, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={item.product_id} onValueChange={v => updateLineItem(idx, 'product_id', v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input type="number" min="1" value={item.quantity_ordered} onChange={e => updateLineItem(idx, 'quantity_ordered', parseInt(e.target.value) || 0)} className="w-20 h-8" placeholder="Qty" />
                <Input type="number" step="0.01" value={item.unit_cost} onChange={e => updateLineItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)} className="w-24 h-8" placeholder="Unit Cost" />
                <div className="w-24 text-right text-sm font-medium pb-1.5">£{(item.line_cost || 0).toFixed(2)}</div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeLineItem(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
            {lineItems.length === 0 && <p className="text-xs text-muted-foreground py-2">No items added yet.</p>}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="space-y-1"><Label className="text-xs">Shipping (£)</Label><Input type="number" step="0.01" value={form.shipping_cost} onChange={e => set('shipping_cost', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Duty (£)</Label><Input type="number" step="0.01" value={form.duty_cost} onChange={e => set('duty_cost', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Insurance (£)</Label><Input type="number" step="0.01" value={form.insurance_cost} onChange={e => set('insurance_cost', e.target.value)} /></div>
          </div>
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium">Landed Cost Total</span>
            <span className="text-lg font-bold text-primary">£{landedCost.toFixed(2)}</span>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create PO'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}