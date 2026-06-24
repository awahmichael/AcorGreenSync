import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'stock_purchased', label: 'Stock / Goods Purchased' },
  { value: 'freight_in', label: 'Freight In (Import / Delivery of Stock)' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'delivery_to_customers', label: 'Delivery to Customers' },
  { value: 'platform_fees', label: 'Platform / Transaction Fees' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'office_admin', label: 'Office & Admin' },
  { value: 'other', label: 'Other Expenses' }
];

export default function ExpenseModal({ expense, onClose, onSaved }) {
  const isEdit = !!expense;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: '',
    category: 'delivery_to_customers',
    amount: 0,
    vat_amount: 0,
    is_vat_reclaimable: true,
    date: new Date().toISOString().slice(0, 10),
    supplier: '',
    notes: ''
  });

  useEffect(() => {
    if (expense) {
      setForm({
        description: expense.description || '',
        category: expense.category || 'delivery_to_customers',
        amount: expense.amount ?? 0,
        vat_amount: expense.vat_amount ?? 0,
        is_vat_reclaimable: expense.is_vat_reclaimable ?? true,
        date: expense.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        supplier: expense.supplier || '',
        notes: expense.notes || ''
      });
    }
  }, [expense]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        category: form.category,
        amount: Number(form.amount),
        vat_amount: Number(form.vat_amount),
        is_vat_reclaimable: form.is_vat_reclaimable,
        date: form.date,
        supplier: form.supplier.trim(),
        notes: form.notes.trim()
      };
      if (isEdit) {
        await base44.entities.Expense.update(expense.id, payload);
        toast.success('Expense updated');
      } else {
        await base44.entities.Expense.create(payload);
        toast.success('Expense created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Description *</Label><Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Royal Mail tracked delivery" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Amount (£) *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" /></div>
            <div><Label>VAT Amount (£)</Label><Input type="number" step="0.01" value={form.vat_amount} onChange={e => set('vat_amount', e.target.value)} placeholder="0.00" /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={form.is_vat_reclaimable} onCheckedChange={v => set('is_vat_reclaimable', v)} /><Label className="cursor-pointer">VAT is reclaimable</Label></div>
          <div><Label>Supplier</Label><Input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="e.g. Royal Mail" /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional notes..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.description.trim()}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Expense'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}