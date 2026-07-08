import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Leaf, CheckCircle2, AlertCircle, Search, Loader2, Star, Scale } from 'lucide-react';
import { useRmlEngine } from '@/hooks/useRmlEngine';
import RmlMatchBadge from '@/components/products/RmlMatchBadge';

const CATEGORIES = ['Food & Beverages', 'Clothing & Textiles', 'Electronics', 'Furniture', 'Household Goods', 'Health & Beauty', 'Sports & Leisure', 'Books & Stationery', 'Automotive', 'Other'];
const UNITS = ['unit', 'kg', 'litre', 'tonne', 'm2', 'm3', 'kWh'];
const SELL_UNITS = ['g', 'kg', 'ml', 'litre', 'unit'];
const BUY_UNITS = ['kg', 'litre', 'crate', 'box', 'unit'];
const SOURCES = ['DEFRA', 'Climatiq', 'Manual'];
const ALLERGENS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];
const AGE_TYPES = ['none', 'alcohol', 'tobacco', 'knives', 'solvents', 'fireworks', 'lottery', 'other'];

export default function ProductModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    upc: product?.upc || '',
    category: product?.category || '',
    price: product?.price || '',
    cost_price: product?.cost_price || '',
    unit: product?.unit || 'unit',
    is_weighted_item: product?.is_weighted_item || false,
    sell_unit: product?.sell_unit || 'kg',
    buy_unit: product?.buy_unit || 'kg',
    unit_conversion_factor: product?.unit_conversion_factor || 1,
    emission_factor_defra: product?.emission_factor_defra || '',
    emission_factor_climatiq: product?.emission_factor_climatiq || '',
    emission_factor_source: product?.emission_factor_source || 'Pending',
    commodity_code: product?.commodity_code || '',
    scope3_category: product?.scope3_category || 'Both',
    stock_quantity: product?.stock_quantity || 0,
    reorder_point: product?.reorder_point || 0,
    supplier_id: product?.supplier_id || '',
    is_active: product?.is_active !== false,
    image_url: product?.image_url || '',
    age_restricted: product?.age_restricted || false,
    age_restriction_type: product?.age_restriction_type || 'none',
    min_age: product?.min_age || 0,
    allergens: product?.allergens || [],
    is_favourite: product?.is_favourite || false,
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
      cost_price: parseFloat(form.cost_price) || 0,
      emission_factor_defra: parseFloat(form.emission_factor_defra) || null,
      emission_factor_climatiq: parseFloat(form.emission_factor_climatiq) || null,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      reorder_point: parseInt(form.reorder_point) || 0,
      image_url: form.image_url || null,
      age_restricted: form.age_restricted || false,
      age_restriction_type: form.age_restricted ? form.age_restriction_type : 'none',
      min_age: form.age_restricted ? parseInt(form.min_age) || 18 : 0,
      allergens: form.allergens || [],
      is_favourite: form.is_favourite || false,
      is_weighted_item: form.is_weighted_item || false,
      sell_unit: form.is_weighted_item ? form.sell_unit : 'kg',
      buy_unit: form.is_weighted_item ? form.buy_unit : 'kg',
      unit_conversion_factor: form.is_weighted_item ? (parseFloat(form.unit_conversion_factor) || 1) : 1,
      emission_mapping_status: hasEmission ? 'Mapped' : 'Pending',
      defra_factor_id: rmlResult?.factor?.id || product?.defra_factor_id || null,
      defra_factor_version: rmlResult?.factor?.version || product?.defra_factor_version || null,
      supplier_id: form.supplier_id || null,
      // SCD Type 2 versioning — set on creation, preserved on edits
      version: product?.version || 1,
      is_current_version: product?.is_current_version !== false,
      valid_from: product?.valid_from || new Date().toISOString(),
      valid_to: product?.valid_to || null,
      base_product_id: product?.base_product_id || crypto.randomUUID(),
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
              <Input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Price (£)</Label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} placeholder="0.00" />
              {form.price && form.cost_price && (
                <p className="text-xs text-primary">
                  Margin: {(((parseFloat(form.price) - parseFloat(form.cost_price)) / parseFloat(form.price)) * 100).toFixed(1)}%
                  {' · '}£{(parseFloat(form.price) - parseFloat(form.cost_price)).toFixed(2)}/unit
                </p>
              )}
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

          {/* Weighted Item Toggle */}
          <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-500" />
                Sell by Weight
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">POS activates scale listener for this item</p>
            </div>
            <button
              onClick={() => set('is_weighted_item', !form.is_weighted_item)}
              className={`w-10 h-5 rounded-full transition-colors ${form.is_weighted_item ? 'bg-blue-500' : 'bg-muted'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${form.is_weighted_item ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Conditional weight fields */}
          {form.is_weighted_item && (
            <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sell Unit</Label>
                <Select value={form.sell_unit} onValueChange={v => set('sell_unit', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SELL_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Buy Unit</Label>
                <Select value={form.buy_unit} onValueChange={v => set('buy_unit', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conversion Factor</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.unit_conversion_factor}
                  onChange={e => set('unit_conversion_factor', e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>
              <div className="col-span-3 text-xs text-muted-foreground">
                1 {form.buy_unit} = {form.unit_conversion_factor || 1} {form.sell_unit}
              </div>
            </div>
          )}

          {/* Image URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">Product Image URL</Label>
            <Input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://images.unsplash.com/..." />
            {form.image_url && <img src={form.image_url} alt="" className="w-16 h-16 rounded-lg object-cover mt-1" />}
          </div>

          {/* Stock & Reorder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Stock Quantity</Label>
              <Input type="number" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reorder Point (auto-alert)</Label>
              <Input type="number" value={form.reorder_point} onChange={e => set('reorder_point', e.target.value)} placeholder="e.g. 10" />
            </div>
          </div>

          {/* Age Restriction */}
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Age Restricted Product (Challenge 25)
              </Label>
              <button
                onClick={() => set('age_restricted', !form.age_restricted)}
                className={`w-10 h-5 rounded-full transition-colors ${form.age_restricted ? 'bg-red-500' : 'bg-muted'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${form.age_restricted ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {form.age_restricted && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Restriction Type</Label>
                  <Select value={form.age_restriction_type} onValueChange={v => set('age_restriction_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AGE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Minimum Age</Label>
                  <Input type="number" value={form.min_age} onChange={e => set('min_age', e.target.value)} placeholder="18" />
                </div>
              </div>
            )}
          </div>

          {/* Allergens (Natasha's Law) */}
          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 space-y-2">
            <Label className="text-sm font-medium">Allergens (UK Natasha's Law)</Label>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map(a => {
                const selected = form.allergens.includes(a);
                return (
                  <button
                    key={a}
                    onClick={() => set('allergens', selected ? form.allergens.filter(x => x !== a) : [...form.allergens, a])}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize transition-all ${
                      selected ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-muted-foreground border-border hover:border-amber-300'
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Key / Favourite */}
          <div className="flex items-center justify-between bg-amber-50/30 border border-amber-100 rounded-xl px-4 py-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Pin to Quick Keys
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Show on POS quick-access bar for one-tap adding</p>
            </div>
            <button
              onClick={() => set('is_favourite', !form.is_favourite)}
              className={`w-10 h-5 rounded-full transition-colors ${form.is_favourite ? 'bg-amber-500' : 'bg-muted'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${form.is_favourite ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
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
                <Input type="number" step="0.0001" value={form.emission_factor_defra || ''} readOnly placeholder="Auto-resolved from DEFRA" className="bg-muted text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Climatiq Factor (kg CO₂e/unit)</Label>
                <Input type="number" step="0.0001" value={form.emission_factor_climatiq || ''} readOnly placeholder="Auto-resolved from Climatiq" className="bg-muted text-muted-foreground cursor-not-allowed" />
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