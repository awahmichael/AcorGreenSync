import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Tag, Percent, PoundSterling, Gift, ShoppingBag, Ticket, Edit2, Trash2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  percentage: { label: 'Percentage Off', icon: Percent, color: 'text-blue-600 bg-blue-50' },
  fixed: { label: 'Fixed £ Off', icon: PoundSterling, color: 'text-green-600 bg-green-50' },
  bogo: { label: 'Buy X Get Y', icon: Gift, color: 'text-purple-600 bg-purple-50' },
  multibuy: { label: 'Spend Threshold', icon: ShoppingBag, color: 'text-amber-600 bg-amber-50' },
  promo_code: { label: 'Promo Code', icon: Ticket, color: 'text-pink-600 bg-pink-50' },
};

const BLANK = { name: '', description: '', type: 'percentage', value: '', category_filter: '', min_spend: '', promo_code: '', start_date: new Date().toISOString().split('T')[0], end_date: '', is_active: true };

export default function Promotions() {
  const [promotions, setPromotions] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Promotion.list().then(setPromotions).finally(() => setLoading(false));
  }, []);

  const filtered = promotions.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.promo_code?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm(BLANK); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p, value: String(p.value || ''), min_spend: String(p.min_spend || ''), start_date: (p.start_date || new Date().toISOString().split('T')[0]).split('T')[0], end_date: p.end_date ? p.end_date.split('T')[0] : '' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name || !form.value) { toast.error('Name and value are required'); return; }
    const data = {
      ...form,
      value: parseFloat(form.value) || 0,
      min_spend: form.min_spend ? parseFloat(form.min_spend) : 0,
    };
    if (editing) {
      await base44.entities.Promotion.update(editing.id, data);
      toast.success('Promotion updated');
    } else {
      await base44.entities.Promotion.create(data);
      toast.success('Promotion created');
    }
    setShowModal(false);
    setPromotions(await base44.entities.Promotion.list());
  };

  const toggle = async (p) => {
    await base44.entities.Promotion.update(p.id, { is_active: !p.is_active });
    setPromotions(proms => proms.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
    toast.success(`Promotion ${!p.is_active ? 'activated' : 'deactivated'}`);
  };

  const remove = async (id) => {
    await base44.entities.Promotion.delete(id);
    setPromotions(p => p.filter(x => x.id !== id));
    toast.success('Promotion removed');
  };

  const isCurrentlyActive = (p) => {
    if (!p.is_active) return false;
    const today = new Date().toISOString().split('T')[0];
    if (p.start_date && today < p.start_date) return false;
    if (p.end_date && today > p.end_date) return false;
    return true;
  };

  const activeCount = promotions.filter(isCurrentlyActive).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promotions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Discounts, BOGO offers, spend thresholds & promo codes</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Create Promotion
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Promotions', value: promotions.length, color: 'text-primary' },
          { label: 'Active Now', value: activeCount, color: 'text-green-600' },
          { label: 'Inactive', value: promotions.length - activeCount, color: 'text-muted-foreground' },
          { label: 'Promo Codes', value: promotions.filter(p => p.type === 'promo_code').length, color: 'text-pink-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search promotions or promo codes..." className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Promotion</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Value</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Code</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Period</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.map(p => {
                const cfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.percentage;
                const CfgIcon = cfg.icon;
                const live = isCurrentlyActive(p);
                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <CfgIcon className="w-3 h-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {p.type === 'percentage' ? `${p.value}%` :
                       p.type === 'fixed' ? `£${p.value}` :
                       p.type === 'bogo' ? `Buy ${p.value}` :
                       p.type === 'multibuy' ? `£${p.value} min` :
                       p.promo_code || '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {p.promo_code ? <span className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded">{p.promo_code}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                      {p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}
                      {p.end_date ? ` → ${new Date(p.end_date).toLocaleDateString('en-GB')}` : ''}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${live ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {live ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggle(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" title={p.is_active ? 'Deactivate' : 'Activate'}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No promotions yet. Create one to get started.</div>
          )}
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Promotion Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer Sale 10% Off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  {form.type === 'percentage' ? 'Percentage (%) *' :
                   form.type === 'fixed' ? 'Amount (£) *' :
                   form.type === 'bogo' ? 'Buy Quantity *' :
                   form.type === 'multibuy' ? 'Min Spend (£) *' : 'Discount Value *'}
                </Label>
                <Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. 10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category Filter</Label>
                <Input value={form.category_filter} onChange={e => setForm(f => ({ ...f, category_filter: e.target.value }))} placeholder="e.g. Clothing (optional)" />
              </div>
              <div className="space-y-1.5">
                <Label>Min Spend (£)</Label>
                <Input type="number" value={form.min_spend} onChange={e => setForm(f => ({ ...f, min_spend: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {form.type === 'promo_code' && (
              <div className="space-y-1.5">
                <Label>Promo Code</Label>
                <Input value={form.promo_code} onChange={e => setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() }))} placeholder="e.g. SUMMER10" className="font-mono" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={save}>{editing ? 'Save Changes' : 'Create Promotion'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}