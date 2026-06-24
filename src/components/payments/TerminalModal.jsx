import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';

const PROVIDERS = ['Stripe', 'Adyen', 'SumUp', 'MoniePoint', 'Squad'];

function generatePairingCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function TerminalModal({ open, onClose, terminal, stores, gatewayConfigs, onSave }) {
  const [form, setForm] = useState({
    terminal_id: '',
    alias: '',
    provider: 'Stripe',
    gateway_config_id: '',
    store_id: '',
    serial_number: '',
    pairing_code: '',
    is_paired: false,
    is_active: true,
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (terminal) {
      setForm({
        terminal_id: terminal.terminal_id || '',
        alias: terminal.alias || '',
        provider: terminal.provider || 'Stripe',
        gateway_config_id: terminal.gateway_config_id || '',
        store_id: terminal.store_id || '',
        serial_number: terminal.serial_number || '',
        pairing_code: terminal.pairing_code || '',
        is_paired: terminal.is_paired || false,
        is_active: terminal.is_active !== false,
        notes: terminal.notes || ''
      });
    } else {
      setForm({
        terminal_id: '',
        alias: '',
        provider: 'Stripe',
        gateway_config_id: '',
        store_id: '',
        serial_number: '',
        pairing_code: generatePairingCode(),
        is_paired: false,
        is_active: true,
        notes: ''
      });
    }
  }, [terminal, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.terminal_id || !form.provider || !form.store_id) return;
    const store = stores?.find(s => s.id === form.store_id);
    setSaving(true);
    try {
      await onSave({
        ...form,
        store_name: store?.name || '',
        status: form.is_paired ? 'online' : 'offline'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{terminal ? 'Edit Terminal' : 'Register New Terminal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Terminal ID (Device ID from Gateway)</Label>
            <Input
              value={form.terminal_id}
              onChange={(e) => setForm({ ...form, terminal_id: e.target.value })}
              placeholder="e.g. STRIPE_READER_001 or SQD-123456"
              required
              disabled={!!terminal}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Alias</Label>
              <Input
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                placeholder="e.g. Counter 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })} disabled={!!terminal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assigned Store</Label>
            <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select a store" /></SelectTrigger>
              <SelectContent>
                {stores?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Gateway Config (optional)</Label>
            <Select value={form.gateway_config_id} onValueChange={(v) => setForm({ ...form, gateway_config_id: v })}>
              <SelectTrigger><SelectValue placeholder="Auto-match by provider" /></SelectTrigger>
              <SelectContent>
                {gatewayConfigs?.filter(c => c.provider === form.provider).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.environment})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <Input
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                placeholder="Hardware S/N"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pairing Code</Label>
              <div className="flex gap-2">
                <Input
                  value={form.pairing_code}
                  onChange={(e) => setForm({ ...form, pairing_code: e.target.value })}
                  placeholder="Auto-generated"
                  className="font-mono"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, pairing_code: generatePairingCode() })}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_paired} onCheckedChange={(v) => setForm({ ...form, is_paired: v })} />
              <Label>Paired</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Terminal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}