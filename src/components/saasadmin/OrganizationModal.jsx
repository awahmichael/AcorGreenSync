import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const PLAN_DEFAULTS = {
  Starter: { max_locations: 1, max_skus: 5000, price: 29 },
  Growth: { max_locations: 5, max_skus: 50000, price: 79 },
  Enterprise: { max_locations: 999, max_skus: 999999, price: 0 }
};

export default function OrganizationModal({ org, onClose, onSaved }) {
  const isEdit = !!org;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    plan_type: 'Starter',
    subscription_status: 'trial',
    billing_cycle: 'monthly',
    billing_email: '',
    vat_number: '',
    country_code: 'GB',
    default_tax_rate: 20,
    max_locations: 1,
    max_skus: 5000,
    stock_count_cycle: 'monthly',
    trial_ends_at: '',
    billing_period_start: '',
    billing_period_end: '',
    stripe_customer_id: '',
    notes: ''
  });

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name || '',
        plan_type: org.plan_type || 'Starter',
        subscription_status: org.subscription_status || 'trial',
        billing_cycle: org.billing_cycle || 'monthly',
        billing_email: org.billing_email || '',
        vat_number: org.vat_number || '',
        country_code: org.country_code || 'GB',
        default_tax_rate: org.default_tax_rate ?? 20,
        max_locations: org.max_locations ?? 1,
        max_skus: org.max_skus ?? 5000,
        stock_count_cycle: org.stock_count_cycle || 'monthly',
        trial_ends_at: org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : '',
        billing_period_start: org.current_period_start ? org.current_period_start.slice(0, 10) : '',
        billing_period_end: org.current_period_end ? org.current_period_end.slice(0, 10) : '',
        stripe_customer_id: org.stripe_customer_id || '',
        notes: org.notes || ''
      });
    }
  }, [org]);

  const handlePlanChange = (plan) => {
    const defaults = PLAN_DEFAULTS[plan];
    setForm(prev => ({ ...prev, plan_type: plan, max_locations: defaults.max_locations, max_skus: defaults.max_skus }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Organization name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        plan_type: form.plan_type,
        subscription_status: form.subscription_status,
        billing_cycle: form.billing_cycle,
        billing_email: form.billing_email.trim(),
        vat_number: form.vat_number.trim(),
        country_code: form.country_code,
        default_tax_rate: Number(form.default_tax_rate),
        max_locations: Number(form.max_locations),
        max_skus: Number(form.max_skus),
        stock_count_cycle: form.stock_count_cycle,
        trial_ends_at: form.trial_ends_at ? new Date(form.trial_ends_at).toISOString() : null,
        current_period_start: form.billing_period_start ? new Date(form.billing_period_start).toISOString() : null,
        current_period_end: form.billing_period_end ? new Date(form.billing_period_end).toISOString() : null,
        stripe_customer_id: form.stripe_customer_id.trim(),
        notes: form.notes.trim(),
        subscription_started_at: isEdit ? undefined : new Date().toISOString(),
        onboarding_completed: false
      };

      if (isEdit) {
        await base44.entities.Organization.update(org.id, payload);
        toast.success('Organization updated');
      } else {
        await base44.entities.Organization.create(payload);
        toast.success('Organization created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Organization' : 'Create New Organization'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Organization Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Acme Retail Ltd" /></div>
            <div><Label>Billing Email</Label><Input type="email" value={form.billing_email} onChange={e => setForm({ ...form, billing_email: e.target.value })} placeholder="finance@acme.com" /></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Subscription Plan</Label>
              <Select value={form.plan_type} onValueChange={handlePlanChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Starter">Starter (£29/mo)</SelectItem>
                  <SelectItem value="Growth">Growth (£79/mo)</SelectItem>
                  <SelectItem value="Enterprise">Enterprise (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subscription Status</Label>
              <Select value={form.subscription_status} onValueChange={v => setForm({ ...form, subscription_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Billing Cycle</Label>
              <Select value={form.billing_cycle} onValueChange={v => setForm({ ...form, billing_cycle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Max Locations</Label><Input type="number" value={form.max_locations} onChange={e => setForm({ ...form, max_locations: e.target.value })} /></div>
            <div><Label>Max SKUs</Label><Input type="number" value={form.max_skus} onChange={e => setForm({ ...form, max_skus: e.target.value })} /></div>
            <div><Label>Default VAT Rate (%)</Label><Input type="number" value={form.default_tax_rate} onChange={e => setForm({ ...form, default_tax_rate: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><Label>VAT Number</Label><Input value={form.vat_number} onChange={e => setForm({ ...form, vat_number: e.target.value })} placeholder="GB123456789" /></div>
            <div>
              <Label>Country Code</Label>
              <Select value={form.country_code} onValueChange={v => setForm({ ...form, country_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                  <SelectItem value="IE">Ireland (IE)</SelectItem>
                  <SelectItem value="US">United States (US)</SelectItem>
                  <SelectItem value="DE">Germany (DE)</SelectItem>
                  <SelectItem value="FR">France (FR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stock Count Cycle</Label>
              <Select value={form.stock_count_cycle} onValueChange={v => setForm({ ...form, stock_count_cycle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="ad_hoc">Ad Hoc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><Label>Trial Ends At</Label><Input type="date" value={form.trial_ends_at} onChange={e => setForm({ ...form, trial_ends_at: e.target.value })} /></div>
            <div><Label>Billing Period Start</Label><Input type="date" value={form.billing_period_start} onChange={e => setForm({ ...form, billing_period_start: e.target.value })} /></div>
            <div><Label>Billing Period End</Label><Input type="date" value={form.billing_period_end} onChange={e => setForm({ ...form, billing_period_end: e.target.value })} /></div>
          </div>

          <div><Label>Stripe Customer ID</Label><Input value={form.stripe_customer_id} onChange={e => setForm({ ...form, stripe_customer_id: e.target.value })} placeholder="cus_XXXXX" /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Internal notes about this organization..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isEdit ? 'Save Changes' : 'Create Organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}