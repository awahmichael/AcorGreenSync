import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff } from 'lucide-react';

const PROVIDERS = [
  { value: 'Stripe', label: 'Stripe', merchantLabel: 'Merchant Account ID (optional)' },
  { value: 'Adyen', label: 'Adyen', merchantLabel: 'Merchant Account Reference' },
  { value: 'SumUp', label: 'SumUp', merchantLabel: 'Merchant Code' },
  { value: 'MoniePoint', label: 'MoniePoint', merchantLabel: 'Business ID (optional)' },
  { value: 'Squad', label: 'Squad (GTBank)', merchantLabel: 'Merchant ID (optional)' }
];

export default function GatewayConfigModal({ open, onClose, config, onSave }) {
  const [form, setForm] = useState({
    name: '',
    provider: 'Stripe',
    environment: 'sandbox',
    api_key: '',
    secret_key: '',
    merchant_code: '',
    webhook_secret: '',
    is_active: true,
    notes: ''
  });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        name: config.name || '',
        provider: config.provider || 'Stripe',
        environment: config.environment || 'sandbox',
        api_key: config.api_key || '',
        secret_key: config.secret_key || '',
        merchant_code: config.merchant_code || '',
        webhook_secret: config.webhook_secret || '',
        is_active: config.is_active !== false,
        notes: config.notes || ''
      });
    } else {
      setForm({
        name: '',
        provider: 'Stripe',
        environment: 'sandbox',
        api_key: '',
        secret_key: '',
        merchant_code: '',
        webhook_secret: '',
        is_active: true,
        notes: ''
      });
    }
  }, [config, open]);

  const selectedProvider = PROVIDERS.find(p => p.value === form.provider) || PROVIDERS[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.provider || !form.secret_key) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{config ? 'Edit Gateway Configuration' : 'Add Gateway Configuration'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Config Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. London Store Stripe"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Environment</Label>
            <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Test)</SelectItem>
                <SelectItem value="live">Live (Production)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{selectedProvider.merchantLabel}</Label>
            <Input
              value={form.merchant_code}
              onChange={(e) => setForm({ ...form, merchant_code: e.target.value })}
              placeholder="Enter merchant code / account"
            />
          </div>

          <div className="space-y-1.5">
            <Label>API Key (Publishable)</Label>
            <Input
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="pk_... or publishable key"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Secret Key</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={form.secret_key}
                onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
                placeholder="sk_... or secret key"
                required
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Webhook Signing Secret</Label>
            <Input
              type="password"
              value={form.webhook_secret}
              onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
              placeholder="whsec_... (for signature verification)"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}