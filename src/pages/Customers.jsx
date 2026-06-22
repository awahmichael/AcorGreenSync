import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Users, Mail, Phone, Leaf, Edit2, Trash2, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TIER_STYLE = {
  Bronze: 'bg-amber-50 text-amber-700 border-amber-200',
  Silver: 'bg-gray-50 text-gray-600 border-gray-200',
  Gold: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Platinum: 'bg-purple-50 text-purple-700 border-purple-200',
};

const BLANK = { name: '', email: '', phone: '', tier: 'Bronze', notes: '' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Customer.list(),
      base44.entities.Transaction.list('-transaction_date', 500),
    ]).then(([c, t]) => { setCustomers(c); setTransactions(t); }).finally(() => setLoading(false));
  }, []);

  // Enrich customers with transaction-derived stats
  const enriched = customers.map(c => {
    const custTxns = transactions.filter(t =>
      t.cashier_name === c.name || (c.email && t.notes?.includes(c.email))
    );
    return {
      ...c,
      derived_spend: c.total_spend || custTxns.reduce((s, t) => s + (t.total_amount || 0), 0),
      derived_co2e: c.total_kg_co2e || custTxns.reduce((s, t) => s + (t.total_kg_co2e || 0), 0),
      derived_count: c.transaction_count || custTxns.length,
    };
  });

  const filtered = enriched.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const openAdd = () => { setEditing(null); setForm(BLANK); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, email: c.email || '', phone: c.phone || '', tier: c.tier || 'Bronze', notes: c.notes || '' }); setShowModal(true); };

  const save = async () => {
    if (!form.name) { toast.error('Customer name is required'); return; }
    const data = { ...form, is_active: true };
    if (editing) {
      await base44.entities.Customer.update(editing.id, data);
      toast.success('Customer updated');
    } else {
      await base44.entities.Customer.create({ ...data, loyalty_points: 0, total_spend: 0, total_kg_co2e: 0, transaction_count: 0 });
      toast.success('Customer added');
    }
    setShowModal(false);
    const updated = await base44.entities.Customer.list();
    setCustomers(updated);
  };

  const remove = async (id) => {
    await base44.entities.Customer.delete(id);
    setCustomers(c => c.filter(x => x.id !== id));
    toast.success('Customer removed');
  };

  const totalCO2e = enriched.reduce((s, c) => s + (c.derived_co2e || 0), 0);
  const totalSpend = enriched.reduce((s, c) => s + (c.derived_spend || 0), 0);
  const totalPoints = enriched.reduce((s, c) => s + (c.loyalty_points || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">CRM — purchase history, loyalty tiers & carbon footprint</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: customers.length, icon: Users, color: 'text-primary' },
          { label: 'Lifetime Spend', value: `£${totalSpend.toFixed(0)}`, icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Loyalty Points', value: totalPoints.toLocaleString(), icon: Award, color: 'text-amber-500' },
          { label: 'Customer CO₂e', value: `${totalCO2e.toFixed(1)} kg`, icon: Leaf, color: 'text-green-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone..." className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Contact</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Tier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Points</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Spend</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">CO₂e</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.email && <div className="flex items-center gap-1 text-xs"><Mail className="w-3 h-3" />{c.email}</div>}
                    {c.phone && <div className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" />{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TIER_STYLE[c.tier] || TIER_STYLE.Bronze}`}>{c.tier}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">{(c.loyalty_points || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">£{(c.derived_spend || 0).toFixed(0)}</td>
                  <td className="px-4 py-3 text-right text-primary font-medium">{(c.derived_co2e || 0).toFixed(1)} kg</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No customers found.</div>
          )}
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07123 456789" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Loyalty Tier</Label>
              <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Bronze', 'Silver', 'Gold', 'Platinum'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Preferences, dietary requirements, etc." />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={save}>{editing ? 'Save Changes' : 'Add Customer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}