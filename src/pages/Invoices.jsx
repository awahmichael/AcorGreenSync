import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, FileText, Download, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = { draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700', viewed: 'bg-purple-100 text-purple-700', partially_paid: 'bg-amber-100 text-amber-700', paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-600' };

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const load = async () => { setLoading(true); try { setInvoices(await base44.entities.Invoice.list('-issue_date', 100)); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => i.status === statusFilter);
  const sendInvoice = async (inv) => { try { await base44.entities.Invoice.update(inv.id, { status: 'sent' }); toast.success('Invoice sent'); load(); } catch (e) { toast.error(e.message); } };
  const markPaid = async (inv) => { try { await base44.entities.Invoice.update(inv.id, { status: 'paid', amount_paid: inv.total_amount, balance_due: 0, paid_date: new Date().toISOString().split('T')[0] }); toast.success('Invoice marked as paid'); load(); } catch (e) { toast.error(e.message); } };

  const totals = invoices.reduce((acc, i) => { acc.total += i.total_amount || 0; acc.outstanding += i.balance_due || 0; return acc; }, { total: 0, outstanding: 0 });

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">B2B Invoices</h1><p className="text-sm text-muted-foreground mt-0.5">Create and track invoices with VAT and payment status</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Invoice</Button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-border rounded-xl p-4"><div className="text-xs text-muted-foreground">Total Invoiced</div><div className="text-xl font-bold">£{totals.total.toFixed(2)}</div></div>
        <div className="bg-white border border-border rounded-xl p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-xl font-bold text-amber-600">£{totals.outstanding.toFixed(2)}</div></div>
        <div className="bg-white border border-border rounded-xl p-4"><div className="text-xs text-muted-foreground">Total Invoices</div><div className="text-xl font-bold">{invoices.length}</div></div>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>{s.replace(/_/g, ' ')}</button>
        ))}
      </div>
      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Invoice #</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Customer</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Issue Date</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Due Date</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Balance</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/30"><td className="px-4 py-3 text-sm font-mono">{inv.invoice_ref}</td><td className="px-4 py-3 text-sm font-medium">{inv.customer_name}</td><td className="px-4 py-3 text-sm text-muted-foreground">{inv.issue_date}</td><td className="px-4 py-3 text-sm text-muted-foreground">{inv.due_date}</td><td className="px-4 py-3 text-sm font-semibold text-right">£{(inv.total_amount || 0).toFixed(2)}</td><td className="px-4 py-3 text-sm text-right text-amber-600">£{(inv.balance_due || 0).toFixed(2)}</td><td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[inv.status]}`}>{inv.status.replace(/_/g, ' ')}</span></td><td className="px-4 py-3"><div className="flex items-center justify-end gap-1">{inv.status === 'draft' && <button onClick={() => sendInvoice(inv)} className="p-1.5 hover:bg-muted rounded text-blue-600" title="Send"><Send className="w-3.5 h-3.5" /></button>}{inv.status !== 'paid' && inv.status !== 'cancelled' && <button onClick={() => markPaid(inv)} className="p-1.5 hover:bg-muted rounded text-green-600" title="Mark Paid"><CheckCircle2 className="w-3.5 h-3.5" /></button>}</div></td></tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No invoices found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <InvoiceModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function InvoiceModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ customer_name: '', customer_email: '', customer_address: '', issue_date: new Date().toISOString().split('T')[0], due_date: '', tax_rate: 20, notes: '', items_text: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const items = form.items_text.split('\n').filter(l => l.trim()).map(l => { const [desc, qty, price] = l.split(',').map(s => s.trim()); const q = parseFloat(qty) || 1; const p = parseFloat(price) || 0; return { description: desc || '', quantity: q, unit_price: p, line_total: q * p }; });
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const taxAmount = subtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const total = subtotal + taxAmount;

  const handleSave = async () => {
    if (!form.customer_name) { toast.error('Customer name required'); return; }
    if (items.length === 0) { toast.error('Add at least one line item'); return; }
    setSaving(true);
    try { await base44.entities.Invoice.create({ invoice_ref: `INV-${Date.now()}`, customer_name: form.customer_name, customer_email: form.customer_email, customer_address: form.customer_address, items, subtotal, tax_rate: parseFloat(form.tax_rate) || 20, tax_amount: taxAmount, total_amount: total, amount_paid: 0, balance_due: total, status: 'draft', issue_date: form.issue_date, due_date: form.due_date, notes: form.notes }); toast.success('Invoice created'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New B2B Invoice</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Customer Name *</Label><Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} /></div><div className="space-y-1.5"><Label>Email</Label><Input value={form.customer_email} onChange={e => set('customer_email', e.target.value)} /></div></div>
        <div className="space-y-1.5"><Label>Address</Label><Input value={form.customer_address} onChange={e => set('customer_address', e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-3"><div className="space-y-1.5"><Label>Issue Date</Label><Input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} /></div><div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div><div className="space-y-1.5"><Label>VAT %</Label><Input type="number" value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} /></div></div>
        <div className="space-y-1.5"><Label>Line Items (one per line: description, qty, unit price)</Label><textarea className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring" rows={4} value={form.items_text} onChange={e => set('items_text', e.target.value)} placeholder="Consulting services, 10, 150.00&#10;Software license, 1, 500.00" /></div>
        <div className="space-y-1.5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>£{subtotal.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">VAT ({form.tax_rate}%)</span><span>£{taxAmount.toFixed(2)}</span></div><div className="flex justify-between border-t border-border pt-1.5 font-bold"><span>Total</span><span className="text-primary">£{total.toFixed(2)}</span></div></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Invoice'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}