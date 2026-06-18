import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Truck, Plus, Search, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const DISCLOSURE_CONFIG = {
  Disclosed: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Disclosed' },
  Partial: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Partial' },
  Requested: { icon: Clock, color: 'text-blue-600 bg-blue-50', label: 'Requested' },
  'Not Disclosed': { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Not Disclosed' },
};

const BLANK = { name: '', contact_name: '', email: '', phone: '', address: '', postcode: '', country: 'United Kingdom', category: '', declared_scope3_kg_co2e: '', carbon_disclosure_status: 'Not Disclosed', notes: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Supplier.list().then(setSuppliers).finally(() => setLoading(false));
  }, []);

  const openAdd = () => { setEditing(null); setForm(BLANK); setShowModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s, declared_scope3_kg_co2e: s.declared_scope3_kg_co2e || '' }); setShowModal(true); };

  const save = async () => {
    if (!form.name) { toast.error('Supplier name required'); return; }
    const data = { ...form, declared_scope3_kg_co2e: form.declared_scope3_kg_co2e ? parseFloat(form.declared_scope3_kg_co2e) : null, is_active: true };
    if (editing) {
      await base44.entities.Supplier.update(editing.id, data);
      toast.success('Supplier updated');
    } else {
      await base44.entities.Supplier.create(data);
      toast.success('Supplier added');
    }
    setShowModal(false);
    base44.entities.Supplier.list().then(setSuppliers);
  };

  const remove = async (id) => {
    await base44.entities.Supplier.delete(id);
    setSuppliers(s => s.filter(x => x.id !== id));
    toast.success('Supplier removed');
  };

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const disclosed = suppliers.filter(s => s.carbon_disclosure_status === 'Disclosed').length;
  const totalDeclared = suppliers.reduce((sum, s) => sum + (s.declared_scope3_kg_co2e || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Scope 3 upstream carbon disclosure tracking</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Supplier</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Suppliers', value: suppliers.length },
          { label: 'Carbon Disclosed', value: `${disclosed} / ${suppliers.length}` },
          { label: 'Disclosure Rate', value: suppliers.length ? `${Math.round((disclosed / suppliers.length) * 100)}%` : '0%' },
          { label: 'Declared CO₂e', value: `${totalDeclared.toFixed(0)} kg` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className="text-xl font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Contact</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Declared CO₂e</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Disclosure</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.map(s => {
                const cfg = DISCLOSURE_CONFIG[s.carbon_disclosure_status] || DISCLOSURE_CONFIG['Not Disclosed'];
                const CfgIcon = cfg.icon;
                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.postcode || s.country}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.category || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {s.declared_scope3_kg_co2e ? `${s.declared_scope3_kg_co2e.toFixed(0)} kg` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <CfgIcon className="w-3 h-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(s)} className="text-xs text-primary hover:underline mr-3">Edit</button>
                      <button onClick={() => remove(s.id)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No suppliers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Supplier Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Clothing & Textiles" />
              </div>
              <div className="space-y-1.5">
                <Label>Postcode</Label>
                <Input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label>Carbon Disclosure Status</Label>
                <Select value={form.carbon_disclosure_status} onValueChange={v => setForm(f => ({ ...f, carbon_disclosure_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(DISCLOSURE_CONFIG).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Declared Scope 3 (kg CO₂e / yr)</Label>
                <Input type="number" value={form.declared_scope3_kg_co2e} onChange={e => setForm(f => ({ ...f, declared_scope3_kg_co2e: e.target.value }))} placeholder="Annual total" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={save}>{editing ? 'Save Changes' : 'Add Supplier'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}