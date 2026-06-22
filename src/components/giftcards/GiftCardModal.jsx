import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'GC-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function GiftCardModal({ customers, onClose, onSaved }) {
  const [form, setForm] = useState({ initial_balance: '', customer_id: '', expiry_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    const balance = parseFloat(form.initial_balance);
    if (!balance || balance <= 0) { toast.error('Enter a valid balance'); return; }
    setSaving(true);
    try {
      const customer = customers.find(c => c.id === form.customer_id);
      const code = generateCode();
      await base44.entities.GiftCard.create({
        code,
        initial_balance: balance,
        balance,
        status: 'active',
        customer_id: form.customer_id || null,
        customer_name: customer?.name || '',
        issued_date: new Date().toISOString(),
        expiry_date: form.expiry_date || null,
        transactions: [{ date: new Date().toISOString(), amount: balance, type: 'issue', reference: 'Initial issue' }],
        notes: form.notes,
      });
      toast.success(`Gift card ${code} issued`);
      onSaved();
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Issue Gift Card</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Initial Balance (£) *</Label>
            <Input type="number" step="0.01" min="0.01" value={form.initial_balance} onChange={e => set('initial_balance', e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Link to Customer (optional)</Label>
            <Select value={form.customer_id} onValueChange={v => set('customer_id', v)}>
              <SelectTrigger><SelectValue placeholder="No customer" /></SelectTrigger>
              <SelectContent>
                {(customers || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry Date (optional)</Label>
            <Input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Issuing...' : 'Issue Gift Card'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}