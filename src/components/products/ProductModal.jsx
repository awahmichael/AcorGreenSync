import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Leaf } from 'lucide-react';

const CATEGORIES = ['Food & Beverages', 'Clothing & Textiles', 'Electronics', 'Furniture', 'Household Goods', 'Health & Beauty', 'Sports & Leisure', 'Books & Stationery', 'Automotive', 'Other'];
const UNITS = ['unit', 'kg', 'litre', 'tonne', 'm2', 'm3', 'kWh'];
const SOURCES = ['DEFRA', 'Climatiq', 'Manual'];

export default function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category: product?.category || '',
    price: product?.price || '',
    unit: product?.unit || 'unit',
    emission_factor_defra: product?.emission_factor_defra || '',
    emission_factor_climatiq: product?.emission_factor_climatiq || '',
    emission_factor_source: product?.emission_factor_source || 'DEFRA',
    commodity_code: product?.commodity_code || '',
    scope3_category: product?.scope3_category || 'Both',
    stock_quantity: product?.stock_quantity || 0,
    is_active: product?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.category || !form.price) {
      toast.error('Name, category and price are required');
      return;
    }
    setSaving(true);
    const hasEmission = form.emission_factor_defra || form.emission_factor_climatiq;
    const data = {
      ...form,
      price: parseFloat(form.price) || 0,
      emission_factor_defra: parseFloat(form.emission_factor_defra) || null,
      emission_factor_climatiq: parseFloat(form.emission_factor_climatiq) || null,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      emission_mapping_status: hasEmission ? 'Mapped' : 'Pending',
    };

    if (product?.id) {
      await base44.entities.Product.update(product.id, data);
      toast.success('Product updated');
    } else {
      await base44.entities.Product.create(data);
      toast.success('Product added');
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Product Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Organic Cotton T-Shirt" />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="SKU-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Price (£) *</Label>
              <Input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={v => set('unit', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Leaf className="w-4 h-4" />
              Emission Factor Mapping
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">DEFRA Factor (kg CO₂e/unit)</Label>
                <Input type="number" step="0.0001" value={form.emission_factor_defra} onChange={e => set('emission_factor_defra', e.target.value)} placeholder="0.0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Climatiq Factor (kg CO₂e/unit)</Label>
                <Input type="number" step="0.0001" value={form.emission_factor_climatiq} onChange={e => set('emission_factor_climatiq', e.target.value)} placeholder="0.0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Primary Source</Label>
                <Select value={form.emission_factor_source} onValueChange={v => set('emission_factor_source', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">UK Commodity Code</Label>
                <Input value={form.commodity_code} onChange={e => set('commodity_code', e.target.value)} placeholder="e.g. 6205" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scope 3 Category</Label>
              <Select value={form.scope3_category} onValueChange={v => set('scope3_category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Category_1_Purchased_Goods">Category 1 — Purchased Goods (Upstream)</SelectItem>
                  <SelectItem value="Category_11_Use_of_Sold_Products">Category 11 — Use of Sold Products (Downstream)</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
              {saving ? 'Saving...' : 'Save Product'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}