import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, PlayCircle, StopCircle, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-green-600 bg-green-50' },
  closed: { label: 'Closed', color: 'text-amber-600 bg-amber-50' },
  reconciled: { label: 'Reconciled', color: 'text-blue-600 bg-blue-50' },
};

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [closingShift, setClosingShift] = useState(null);
  const [openForm, setOpenForm] = useState({ store_id: '', cashier_name: '', opening_float: '200' });
  const [closeForm, setCloseForm] = useState({ closing_cash: '', notes: '' });

  const load = () => Promise.all([
    base44.entities.Shift.list('-shift_start', 50),
    base44.entities.Store.list(),
  ]).then(([s, st]) => { setShifts(s); setStores(st); }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openShift = async () => {
    if (!openForm.cashier_name) { toast.error('Cashier name required'); return; }
    const store = stores.find(s => s.id === openForm.store_id);
    await base44.entities.Shift.create({
      store_id: openForm.store_id,
      store_name: store?.name || 'Unknown Store',
      cashier_name: openForm.cashier_name,
      opening_float: parseFloat(openForm.opening_float) || 0,
      shift_start: new Date().toISOString(),
      status: 'open',
      total_transactions: 0,
      total_revenue: 0,
      total_kg_co2e: 0,
    });
    toast.success('Shift opened');
    setShowOpen(false);
    setOpenForm({ store_id: '', cashier_name: '', opening_float: '200' });
    load();
  };

  const closeShift = async () => {
    await base44.entities.Shift.update(closingShift.id, {
      shift_end: new Date().toISOString(),
      closing_cash: parseFloat(closeForm.closing_cash) || 0,
      notes: closeForm.notes,
      status: 'closed',
    });
    toast.success('Shift closed');
    setShowClose(false);
    setClosingShift(null);
    setCloseForm({ closing_cash: '', notes: '' });
    load();
  };

  const reconcile = async (shift) => {
    await base44.entities.Shift.update(shift.id, { status: 'reconciled' });
    toast.success('Shift reconciled');
    load();
  };

  const openShifts = shifts.filter(s => s.status === 'open');
  const totalRevenueToday = shifts
    .filter(s => new Date(s.shift_start).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + (s.total_revenue || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shift Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Open, close and reconcile till shifts</p>
        </div>
        <Button onClick={() => setShowOpen(true)}>
          <PlayCircle className="w-4 h-4 mr-2" /> Open Shift
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open Shifts', value: openShifts.length, color: 'text-green-600' },
          { label: 'Shifts Today', value: shifts.filter(s => new Date(s.shift_start).toDateString() === new Date().toDateString()).length, color: 'text-foreground' },
          { label: "Today's Revenue", value: `£${totalRevenueToday.toFixed(2)}`, color: 'text-foreground' },
          { label: 'Pending Reconciliation', value: shifts.filter(s => s.status === 'closed').length, color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Open shifts alert */}
      {openShifts.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-green-800 mb-2">Currently Open Shifts</div>
          <div className="space-y-2">
            {openShifts.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-green-100">
                <div>
                  <span className="font-medium text-sm">{s.cashier_name}</span>
                  <span className="text-muted-foreground text-xs ml-2">@ {s.store_name} · Since {new Date(s.shift_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setClosingShift(s); setShowClose(true); }}>
                  <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Close
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shifts table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Shift History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Cashier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Store</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">CO₂e</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : shifts.map(s => {
                const cfg = STATUS_CONFIG[s.status];
                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.cashier_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.store_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(s.shift_start).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 text-right">£{(s.total_revenue || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-primary font-medium">{(s.total_kg_co2e || 0).toFixed(2)} kg</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'closed' && (
                        <button onClick={() => reconcile(s)} className="text-xs text-primary hover:underline">Reconcile</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && shifts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No shifts recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open shift modal */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Open New Shift</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Cashier Name *</Label>
              <Input value={openForm.cashier_name} onChange={e => setOpenForm(f => ({ ...f, cashier_name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={openForm.store_id} onValueChange={v => setOpenForm(f => ({ ...f, store_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select store..." /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Opening Float (£)</Label>
              <Input type="number" value={openForm.opening_float} onChange={e => setOpenForm(f => ({ ...f, opening_float: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={openShift}>Open Shift</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close shift modal */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Close Shift — {closingShift?.cashier_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Closing Cash Count (£)</Label>
              <Input type="number" value={closeForm.closing_cash} onChange={e => setCloseForm(f => ({ ...f, closing_cash: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={closeForm.notes} onChange={e => setCloseForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any discrepancies or comments..." />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowClose(false)}>Cancel</Button>
              <Button className="flex-1" onClick={closeShift}>Close Shift</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}