import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function PricingPlanModal({ plan, onClose, onSaved }) {
  const isEdit = !!plan;
  const [saving, setSaving] = useState(false);
  const [featuresText, setFeaturesText] = useState('');
  const [form, setForm] = useState({
    name: '',
    price_monthly: 0,
    price_annual: 0,
    description: '',
    max_locations: 1,
    max_skus: 5000,
    is_active: true,
    is_popular: false,
    stripe_price_id_monthly: '',
    stripe_price_id_annual: '',
    sort_order: 0
  });

  useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name || '',
        price_monthly: plan.price_monthly ?? 0,
        price_annual: plan.price_annual ?? 0,
        description: plan.description || '',
        max_locations: plan.max_locations ?? 1,
        max_skus: plan.max_skus ?? 5000,
        is_active: plan.is_active ?? true,
        is_popular: plan.is_popular ?? false,
        stripe_price_id_monthly: plan.stripe_price_id_monthly || '',
        stripe_price_id_annual: plan.stripe_price_id_annual || '',
        sort_order: plan.sort_order ?? 0
      });
      setFeaturesText((plan.features || []).join('\n'));
    }
  }, [plan]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Plan name is required'); return; }
    setSaving(true);
    try {
      const features = featuresText.split('\n').map(f => f.trim()).filter(Boolean);
      const payload = {
        name: form.name.trim(),
        price_monthly: Number(form.price_monthly),
        price_annual: Number(form.price_annual),
        description: form.description.trim(),
        features,
        max_locations: Number(form.max_locations),
        max_skus: Number(form.max_skus),
        is_active: form.is_active,
        is_popular: form.is_popular,
        stripe_price_id_monthly: form.stripe_price_id_monthly.trim(),
        stripe_price_id_annual: form.stripe_price_id_annual.trim(),
        sort_order: Number(form.sort_order)
      };
      const { base44 } = await import('@/api/base44Client');
      if (isEdit) {
        await base44.entities.PricingPlan.update(plan.id, payload);
        toast.success('Plan updated');
      } else {
        await base44.entities.PricingPlan.create(payload);
        toast.success('Plan created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Plan' : 'Create New Plan'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Plan Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Starter, Growth, Enterprise..." /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Who is this plan for?" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Monthly Price (£) *</Label><Input type="number" value={form.price_monthly} onChange={e => set('price_monthly', e.target.value)} placeholder="29" /><p className="text-xs text-muted-foreground mt-1">Use 0 for Custom pricing</p></div>
            <div><Label>Annual Price (£/yr)</Label><Input type="number" value={form.price_annual} onChange={e => set('price_annual', e.target.value)} placeholder="290" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Max Locations</Label><Input type="number" value={form.max_locations} onChange={e => set('max_locations', e.target.value)} /></div>
            <div><Label>Max SKUs</Label><Input type="number" value={form.max_skus} onChange={e => set('max_skus', e.target.value)} /></div>
          </div>
          <div><Label>Features (one per line)</Label><Textarea value={featuresText} onChange={e => setFeaturesText(e.target.value)} rows={6} placeholder={"1 store location\nUp to 5,000 SKUs\nCore POS & Inventory"} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Stripe Price ID (Monthly)</Label><Input value={form.stripe_price_id_monthly} onChange={e => set('stripe_price_id_monthly', e.target.value)} placeholder="price_..." /></div>
            <div><Label>Stripe Price ID (Annual)</Label><Input value={form.stripe_price_id_annual} onChange={e => set('stripe_price_id_annual', e.target.value)} placeholder="price_..." /></div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} /><Label className="cursor-pointer">Active</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_popular} onCheckedChange={v => set('is_popular', v)} /><Label className="cursor-pointer">Mark as Popular</Label></div>
          </div>
          <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} /><p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Plan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}