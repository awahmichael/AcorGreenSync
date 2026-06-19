import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Lock, Unlock, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const BLANK = { label: '', period_start: '', period_end: '', notes: '' };

export default function PeriodLockPanel() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [locking, setLocking] = useState(null);
  const { user } = useAuth();

  const load = () => {
    setLoading(true);
    base44.entities.ReportingPeriod.list('-period_start').then(setPeriods).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.label || !form.period_start || !form.period_end) { toast.error('Label and dates are required'); return; }
    await base44.entities.ReportingPeriod.create({ ...form, status: 'open' });
    toast.success('Reporting period created');
    setForm(BLANK);
    setShowForm(false);
    load();
  };

  const lockPeriod = async (period) => {
    setLocking(period.id);
    // Snapshot carbon totals for this period
    const txns = await base44.entities.Transaction.list('-transaction_date', 1000);
    const inPeriod = txns.filter(t => {
      const d = t.transaction_date?.split('T')[0];
      return d >= period.period_start && d <= period.period_end;
    });
    const total_kg_co2e = inPeriod.reduce((s, t) => s + (t.total_kg_co2e || 0), 0);
    const total_revenue = inPeriod.reduce((s, t) => s + (t.total_amount || 0), 0);

    await base44.entities.ReportingPeriod.update(period.id, {
      status: 'locked',
      locked_by: user?.full_name || user?.email || 'Unknown',
      locked_at: new Date().toISOString(),
      total_kg_co2e,
      total_revenue,
      total_transactions: inPeriod.length,
    });

    // Write audit log
    await base44.entities.AuditLog.create({
      action: 'period_lock',
      entity_type: 'ReportingPeriod',
      entity_id: period.id,
      entity_ref: period.label,
      user_id: user?.id || '',
      user_name: user?.full_name || user?.email || 'Unknown',
      notes: `Locked with ${inPeriod.length} transactions, ${total_kg_co2e.toFixed(2)} kg CO₂e`,
      performed_at: new Date().toISOString(),
    });

    toast.success(`Period "${period.label}" locked`);
    setLocking(null);
    load();
  };

  const unlock = async (period) => {
    await base44.entities.ReportingPeriod.update(period.id, { status: 'open', locked_by: null, locked_at: null });
    await base44.entities.AuditLog.create({
      action: 'period_lock',
      entity_type: 'ReportingPeriod',
      entity_id: period.id,
      entity_ref: period.label,
      user_id: user?.id || '',
      user_name: user?.full_name || user?.email || 'Unknown',
      notes: `Period unlocked`,
      performed_at: new Date().toISOString(),
    });
    toast.success(`Period "${period.label}" unlocked`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Lock a reporting period to prevent retroactive data changes and snapshot carbon totals.</div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(s => !s)}>
          <Plus className="w-3.5 h-3.5 mr-1" />{showForm ? 'Cancel' : 'New Period'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Period Label *</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. FY2026 Q1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date *</Label>
              <Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date *</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <Button size="sm" onClick={create}>Create Period</Button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-sm">Reporting Periods</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : periods.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No reporting periods defined yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {periods.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{p.label}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      p.status === 'locked' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {p.status === 'locked' ? '🔒 Locked' : '🟢 Open'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.period_start} → {p.period_end}
                    {p.status === 'locked' && p.total_kg_co2e != null && (
                      <> · Snapshot: {p.total_transactions} txns · {p.total_kg_co2e.toFixed(2)} kg CO₂e · £{(p.total_revenue || 0).toFixed(0)}</>
                    )}
                    {p.locked_by && <> · Locked by {p.locked_by}</>}
                  </div>
                </div>
                <div>
                  {p.status === 'open' ? (
                    <Button size="sm" variant="outline" onClick={() => lockPeriod(p)} disabled={locking === p.id} className="text-purple-700 border-purple-300 hover:bg-purple-50">
                      <Lock className="w-3.5 h-3.5 mr-1" />{locking === p.id ? 'Locking...' : 'Lock Period'}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => unlock(p)} className="text-muted-foreground hover:text-foreground">
                      <Unlock className="w-3.5 h-3.5 mr-1" />Unlock
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}