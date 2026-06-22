import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

export default function PurchaseOrderModal({ onClose, onSaved }) {
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', store_id: '', expected_delivery_date: '', notes: '', shipping_cost: 0, duty_cost: 0, insurance_cost: 0 });
  const [lineItems, setLineItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchRef, setSearchRef] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Supplier.filter({ is_active: true }).then(setSuppliers).catch(() => {});
    base44.entities.Store.filter({ is_active: true }).then(setStores).catch(() => {});
    base44.entities.Product.filter({ is_active: true }).then(setProducts).catch(() => {});
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const searchResults = searchTerm.trim().length >= 2
    ? products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.upc || '').includes(searchTerm) ||
        (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 8)
    : [];

  const addProductToOrder = (product) => {
    setLineItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        // Already on the PO — increment quantity instead of duplicating
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity_ordered: i.quantity_ordered + 1, line_cost: (i.quantity_ordered + 1) * (i.unit_cost || 0) }
          : i);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        quantity_ordered: 1,
        unit_cost: product.cost_price || 0,
        line_cost: product.cost_price || 0,
      }];
    });
    setSearchTerm('');
    setShowResults(false);
    // Refocus search field for continuous scanning
    setTimeout(() => searchRef?.focus(), 0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      // If exact UPC/SKU match, add directly (barcode scanner workflow)
      const exactMatch = products.find(p => p.upc === searchTerm.trim() || (p.sku || '').toLowerCase() === searchTerm.trim().toLowerCase());
      if (exactMatch) {
        addProductToOrder(exactMatch);
        return;
      }
      // If only one search result, add it
      if (searchResults.length === 1) {
        addProductToOrder(searchResults[0]);
      }
    }
  };

  const updateLineItem = (idx, key, val) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: val };
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
            <Label>Search or Scan Items</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={setSearchRef}
                placeholder="Type product name or scan barcode/UPC, then press Enter..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowResults(true); }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                className="pl-9 pr-9"
              />
              <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => addProductToOrder(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.category} · {p.upc || p.sku || 'No code'}</div>
                        </div>
                        <div className="text-sm font-semibold text-muted-foreground">£{(p.cost_price || 0).toFixed(2)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {lineItems.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Product</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Unit Cost</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Line Cost</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <div className="text-sm font-medium text-foreground">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">In stock: {products.find(p => p.id === item.product_id)?.stock_quantity || 0}</div>
                        </td>
                        <td className="px-3 py-2 text-right"><Input type="number" min="1" value={item.quantity_ordered} onChange={e => updateLineItem(idx, 'quantity_ordered', parseInt(e.target.value) || 0)} className="w-16 h-8 text-right ml-auto" /></td>
                        <td className="px-3 py-2 text-right"><Input type="number" step="0.01" value={item.unit_cost} onChange={e => updateLineItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)} className="w-20 h-8 text-right ml-auto" /></td>
                        <td className="px-3 py-2 text-right text-sm font-medium">£{(item.line_cost || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center"><button onClick={() => removeLineItem(idx)} className="text-destructive hover:bg-destructive/10 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {lineItems.length === 0 && (
              <div className="text-center py-8 border border-dashed border-border rounded-lg">
                <ScanLine className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Search or scan items to add them to this order</p>
              </div>
            )}
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