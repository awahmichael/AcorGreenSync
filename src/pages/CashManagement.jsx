import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from 'lucide-react';
import ZReport from '@/components/pos/ZReport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors = { open: 'bg-green-100 text-green-700', counted: 'bg-amber-100 text-amber-700', reconciled: 'bg-blue-100 text-blue-700', closed: 'bg-gray-100 text-gray-700' };

export default function CashManagement() {
  const [drawers, setDrawers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [payoutDrawer, setPayoutDrawer] = useState(null);
  const [reconcileDrawer, setReconcileDrawer] = useState(null);

  const load = async () => { setLoading(true); try { const [d, s] = await Promise.all([base44.entities.CashDrawer.list('-opened_at', 100), base44.entities.Store.list()]); setDrawers(d); setStores(s); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Cash Management</h1><p className="text-sm text-muted-foreground mt-0.5">Drawer sessions, payouts, drops, and reconciliation</p></div>
        <div className="flex items-center gap-2">
          <ZReport />
          <Button onClick={() => setShowOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />Open Drawer</Button>
        </div>
      </div>
      {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Drawer Ref</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Cashier</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Store</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Float</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Payouts</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Drops</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {drawers.map(d => {
                const totalPayouts = (d.payouts || []).reduce((s, p) => s + (p.amount || 0), 0);
                const totalDrops = (d.drops || []).reduce((s, dr) => s + (dr.amount || 0), 0);
                return (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-mono">{d.drawer_ref}</td>
                    <td className="px-4 py-3 text-sm font-medium">{d.cashier_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{d.store_name}</td>
                    <td className="px-4 py-3 text-sm text-right">£{(d.opening_float || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">-£{totalPayouts.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-blue-600">-£{totalDrops.toFixed(2)}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[d.status]}`}>{d.status}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">{d.status === 'open' && <><button onClick={() => setPayoutDrawer(d)} className="p-1.5 hover:bg-muted rounded text-amber-600" title="Payout"><ArrowUpCircle className="w-3.5 h-3.5" /></button><button onClick={() => setReconcileDrawer(d)} className="p-1.5 hover:bg-muted rounded text-blue-600" title="Reconcile & Close"><Lock className="w-3.5 h-3.5" /></button></>}</div></td>
                  </tr>
                );
              })}
              {drawers.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No drawer sessions. Open one to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showOpen && <OpenDrawerModal stores={stores} onClose={() => setShowOpen(false)} onSaved={() => { setShowOpen(false); load(); }} />}
      {payoutDrawer && <PayoutModal drawer={payoutDrawer} onClose={() => setPayoutDrawer(null)} onSaved={() => { setPayoutDrawer(null); load(); }} />}
      {reconcileDrawer && <ReconcileModal drawer={reconcileDrawer} onClose={() => setReconcileDrawer(null)} onSaved={() => { setReconcileDrawer(null); load(); }} />}
    </div>
  );
}

function OpenDrawerModal({ stores, onClose, onSaved }) {
  const [form, setForm] = useState({ cashier_name: '', store_id: '', opening_float: 100 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.cashier_name) { toast.error('Enter cashier name'); return; }
    setSaving(true);
    try { const store = stores.find(s => s.id === form.store_id); await base44.entities.CashDrawer.create({ drawer_ref: `DRW-${Date.now()}`, store_id: form.store_id, store_name: store?.name || '', cashier_name: form.cashier_name, opening_float: parseFloat(form.opening_float) || 0, cash_sales: 0, cash_refunds: 0, payouts: [], drops: [], status: 'open', opened_at: new Date().toISOString() }); toast.success('Drawer opened'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Open Cash Drawer</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Cashier Name *</Label><Input value={form.cashier_name} onChange={e => set('cashier_name', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Store</Label><Select value={form.store_id} onValueChange={v => set('store_id', v)}><SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger><SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Opening Float (£)</Label><Input type="number" step="0.01" value={form.opening_float} onChange={e => set('opening_float', e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}><Unlock className="w-3.5 h-3.5 mr-1.5" />{saving ? 'Opening...' : 'Open Drawer'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function PayoutModal({ drawer, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    setSaving(true);
    try { const payouts = [...(drawer.payouts || []), { amount: amt, reason, authorized_by: drawer.cashier_name, timestamp: new Date().toISOString() }]; await base44.entities.CashDrawer.update(drawer.id, { payouts }); toast.success(`Payout of £${amt.toFixed(2)} recorded`); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Cash Payout</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">Drawer: <span className="font-mono font-medium text-foreground">{drawer.drawer_ref}</span></div>
        <div className="space-y-1.5"><Label>Amount (£)</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></div>
        <div className="space-y-1.5"><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Petty cash, supplies, etc." /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}><ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" />{saving ? 'Recording...' : 'Record Payout'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function ReconcileModal({ drawer, onClose, onSaved }) {
  const [countedCash, setCountedCash] = useState('');
  const [saving, setSaving] = useState(false);
  const totalPayouts = (drawer.payouts || []).reduce((s, p) => s + (p.amount || 0), 0);
  const totalDrops = (drawer.drops || []).reduce((s, d) => s + (d.amount || 0), 0);
  const expectedCash = (drawer.opening_float || 0) + (drawer.cash_sales || 0) - (drawer.cash_refunds || 0) - totalPayouts - totalDrops;

  const handleSave = async () => {
    const counted = parseFloat(countedCash);
    if (isNaN(counted)) { toast.error('Enter counted cash amount'); return; }
    setSaving(true);
    try { const variance = counted - expectedCash; await base44.entities.CashDrawer.update(drawer.id, { counted_cash: counted, expected_cash: expectedCash, variance, status: 'reconciled', closed_at: new Date().toISOString() }); toast.success(`Drawer reconciled — variance: £${variance.toFixed(2)}`); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Reconcile & Close Drawer</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1 text-sm border border-border rounded-lg p-3 bg-muted/30">
          <div className="flex justify-between"><span className="text-muted-foreground">Opening Float</span><span>£{(drawer.opening_float || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Cash Sales</span><span>+£{(drawer.cash_sales || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Cash Refunds</span><span className="text-red-600">-£{(drawer.cash_refunds || 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Payouts</span><span className="text-red-600">-£{totalPayouts.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Drops</span><span className="text-blue-600">-£{totalDrops.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold border-t border-border pt-1 mt-1"><span>Expected Cash</span><span className="text-primary">£{expectedCash.toFixed(2)}</span></div>
        </div>
        <div className="space-y-1.5"><Label>Counted Cash (£)</Label><Input type="number" step="0.01" value={countedCash} onChange={e => setCountedCash(e.target.value)} placeholder={expectedCash.toFixed(2)} autoFocus /></div>
        {countedCash && <div className={`text-sm font-medium p-2 rounded-lg ${parseFloat(countedCash) - expectedCash === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>Variance: £{(parseFloat(countedCash) - expectedCash).toFixed(2)}</div>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}><Lock className="w-3.5 h-3.5 mr-1.5" />{saving ? 'Closing...' : 'Reconcile & Close'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}