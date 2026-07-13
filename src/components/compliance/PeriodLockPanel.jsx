import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Lock, Unlock, Plus, AlertCircle, CheckCircle2, Shield, ShieldCheck, ShieldAlert, Loader2, Fingerprint } from 'lucide-react';
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
  const [verifying, setVerifying] = useState(null);
  const [verifyResults, setVerifyResults] = useState({});
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
    try {
      const res = await base44.functions.invoke('sealReportingPeriod', { period_id: period.id });
      toast.success(
        `Period sealed — SHA-256: ${res.data.data_hash?.slice(0, 12)}… · ${res.data.transaction_count} txns anchored`,
        { duration: 5000 }
      );
      load();
    } catch (err) {
      toast.error(`Failed to seal period: ${err.message}`);
    } finally {
      setLocking(null);
    }
  };

  const verifyPeriod = async (period) => {
    setVerifying(period.id);
    try {
      const res = await base44.functions.invoke('verifyPeriodIntegrity', { period_id: period.id });
      const result = res.data;
      setVerifyResults(prev => ({ ...prev, [period.id]: result }));
      if (result.verified) {
        toast.success(`✓ Integrity verified — data is unaltered since seal`, { duration: 5000 });
      } else {
        toast.error(`⚠ Tamper detected — data hash mismatch`, { duration: 6000 });
      }
    } catch (err) {
      toast.error(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(null);
    }
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
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Reporting Periods</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : periods.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No reporting periods defined yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {periods.map(p => {
              const vResult = verifyResults[p.id];
              return (
                <div key={p.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{p.label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          p.status === 'locked' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'
                        }`}>
                          {p.status === 'locked' ? '🔒 Sealed' : '🟢 Open'}
                        </span>
                        {vResult && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            vResult.verified
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {vResult.verified ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                            {vResult.verified ? 'Verified' : 'Tamper Detected'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.period_start} → {p.period_end}
                        {p.status === 'locked' && p.total_kg_co2e != null && (
                          <> · Snapshot: {p.total_transactions} txns · {p.total_kg_co2e.toFixed(2)} kg CO₂e · £{(p.total_revenue || 0).toFixed(0)}</>
                        )}
                        {p.locked_by && <> · Sealed by {p.locked_by}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === 'open' ? (
                        <Button size="sm" variant="outline" onClick={() => lockPeriod(p)} disabled={locking === p.id} className="text-purple-700 border-purple-300 hover:bg-purple-50">
                          {locking === p.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                          {locking === p.id ? 'Sealing...' : 'Seal & Hash'}
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => verifyPeriod(p)} disabled={verifying === p.id} className="text-blue-700 border-blue-300 hover:bg-blue-50">
                            {verifying === p.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1" />}
                            {verifying === p.id ? 'Verifying...' : 'Verify Integrity'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => unlock(p)} className="text-muted-foreground hover:text-foreground">
                            <Unlock className="w-3.5 h-3.5 mr-1" />Unlock
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* SHA-256 hash display for sealed periods */}
                  {p.status === 'locked' && p.data_hash && (
                    <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
                      <Fingerprint className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider flex-shrink-0">SHA-256</span>
                      <code className="text-[10px] text-green-400 font-mono break-all">{p.data_hash}</code>
                      {p.hash_version && (
                        <span className="text-[9px] text-slate-500 font-mono flex-shrink-0 ml-auto pl-2 border-l border-slate-700">{p.hash_version}</span>
                      )}
                    </div>
                  )}

                  {/* Verification result details */}
                  {vResult && !vResult.verified && vResult.discrepancies && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
                      <div className="font-medium mb-1">⚠ Integrity check failed — data has been modified since seal:</div>
                      <div className="text-red-600">
                        Sealed: {vResult.discrepancies.sealed_transaction_count} txns / {vResult.discrepancies.sealed_audit_log_count} logs
                        → Current: {vResult.discrepancies.current_transaction_count} txns / {vResult.discrepancies.current_audit_log_count} logs
                      </div>
                      {vResult.discrepancies.audit_logs_added_since_seal?.length > 0 && (
                        <div className="mt-1 text-red-500">
                          {vResult.discrepancies.audit_logs_added_since_seal.length} new audit log(s) added since seal
                        </div>
                      )}
                    </div>
                  )}

                  {vResult && vResult.verified && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Data integrity confirmed — all {vResult.transaction_count} transactions and {vResult.audit_log_count} audit logs match the sealed hash.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RegTech info banner */}
      <div className="bg-slate-900 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <span className="text-green-400 font-medium">RegTech Integrity Standard</span> — Every sealed period is anchored with a SHA-256 cryptographic hash
          covering all transaction data, carbon emissions, personnel metadata (cashier/store IDs), and audit trail entries.
          Auditors can independently re-run the verification at any time to mathematically prove the data is unaltered.
        </div>
      </div>
    </div>
  );
}