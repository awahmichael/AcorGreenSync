import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Leaf, CheckCircle2, AlertCircle, Search, Loader2 } from 'lucide-react';
import { useRmlEngine } from '@/hooks/useRmlEngine';
import RmlMatchBadge from '@/components/products/RmlMatchBadge';

const CATEGORIES = ['Food & Beverages', 'Clothing & Textiles', 'Electronics', 'Furniture', 'Household Goods', 'Health & Beauty', 'Sports & Leisure', 'Books & Stationery', 'Automotive', 'Other'];
const UNITS = ['unit', 'kg', 'litre', 'tonne', 'm2', 'm3', 'kWh'];
const SOURCES = ['DEFRA', 'Climatiq', 'Manual'];

export default function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    upc: product?.upc || '',
    category: product?.category || '',
    price: product?.price || '',
    unit: product?.unit || 'unit',
    emission_factor_defra: product?.emission_factor_defra || '',
    emission_factor_climatiq: product?.emission_factor_climatiq || '',
    emission_factor_source: product?.emission_factor_source || 'Pending',
    commodity_code: product?.commodity_code || '',
    scope3_category: product?.scope3_category || 'Both',
    stock_quantity: product?.stock_quantity || 0,
    supplier_id: product?.supplier_id || '',
    is_active: product?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [rmlResult, setRmlResult] = useState(null); // { factor, matchType } or null
  const [suppliers, setSuppliers] = useState([]);

  const { resolve, factors, loading: rmlLoading } = useRmlEngine();

  // Load suppliers for dropdown
  useEffect(() => {
    base44.entities.Supplier.filter({ is_active: true }).then(setSuppliers);
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // RML auto-resolve when commodity_code or category changes
  useEffect(() => {
    if (rmlLoading) return;
    const result = resolve(form.commodity_code, form.category);
    setRmlResult(result);
  }, [form.commodity_code, form.category, resolve, rmlLoading]);

  const applyRmlMatch = () => {
    if (!rmlResult) return;
    const f = rmlResult.factor;
    setForm(prev => ({
      ...prev,
      emission_factor_defra: f.kg_co2e_per_unit,
      emission_factor_source: 'DEFRA',
      unit: f.unit || prev.unit,
    }));
    toast.success(`DEFRA factor applied: ${f.kg_co2e_per_unit} kg CO₂e/${f.unit || 'unit'}`);
  };

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
      defra_factor_id: rmlResult?.factor?.id || product?.defra_factor_id || null,
      defra_factor_version: rmlResult?.factor?.version || product?.defra_factor_version || null,
      supplier_id: form.supplier_id || null,
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
              <Label>UPC / EAN Barcode</Label>
              <Input value={form.upc} onChange={e => set('upc', e.target.value)} placeholder="e.g. 5000112637922" className="font-mono" />
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

          {/* Supplier link */}
          <div className="space-y-1.5">
            <Label className="text-xs">Supplier (for transport emissions)</Label>
            <Select value={form.supplier_id} onValueChange={v => set('supplier_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.distance_km ? `(${s.distance_km} km)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* RML Emission Factor Mapping */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Leaf className="w-4 h-4" />
                RML Emission Factor Mapping
              </div>
              {rmlLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            {/* Commodity code with auto-lookup */}
            <div className="space-y-1.5">
              <Label className="text-xs">DEFRA Commodity Code (RML Key)</Label>
              <div className="flex gap-2">
                <Input
                  value={form.commodity_code}
                  onChange={e => set('commodity_code', e.target.value)}
                  placeholder="e.g. DAIRY-LIQ-01"
                  className="flex-1"
                />
                {rmlResult && (
                  <Button type="button" size="sm" variant="outline" onClick={applyRmlMatch} className="shrink-0 text-xs border-green-300 text-green-700 hover:bg-green-100">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Apply
                  </Button>
                )}
              </div>
              <RmlMatchBadge result={rmlResult} loading={rmlLoading} />
            </div>

            {/* Browse DEFRA factors dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs">Or browse DEFRA factors</Label>
              <Select
                value=""
                onValueChange={(factorId) => {
                  const f = factors.find(ef => ef.id === factorId);
                  if (f) {
                    setForm(prev => ({
                      ...prev,
                      commodity_code: f.commodity_code || prev.commodity_code,
                      emission_factor_defra: f.kg_co2e_per_unit,
                      emission_factor_source: 'DEFRA',
                      unit: f.unit || prev.unit,
                    }));
                    setRmlResult({ factor: f, matchType: 'manual_select' });
                    toast.success(`Applied: ${f.name}`);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Browse DEFRA factors..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {factors.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} — {f.kg_co2e_per_unit} kg CO₂e/{f.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label className="text-xs">Scope 3 Category</Label>
                <Select value={form.scope3_category} onValueChange={v => set('scope3_category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Category_1_Purchased_Goods">Cat 1 — Purchased Goods</SelectItem>
                    <SelectItem value="Category_11_Use_of_Sold_Products">Cat 11 — Sold Products</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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