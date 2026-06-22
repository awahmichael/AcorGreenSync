import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, AlertCircle, CheckCircle2, Lock, Unlock, Clock, FileText, Leaf, Users, BarChart2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmissionAuditPanel from '@/components/compliance/EmissionAuditPanel';
import SupplierDisclosurePanel from '@/components/compliance/SupplierDisclosurePanel';
import PeriodLockPanel from '@/components/compliance/PeriodLockPanel';
import AuditLogPanel from '@/components/compliance/AuditLogPanel';
import PendingEmissionsPanel from '@/components/compliance/PendingEmissionsPanel';
import RestatementCalculator from '@/components/compliance/RestatementCalculator';

const TABS = [
  { id: 'audit', label: 'Emission Audit', icon: Leaf },
  { id: 'suppliers', label: 'Supplier Disclosure', icon: Users },
  { id: 'periods', label: 'Period Lock', icon: Lock },
  { id: 'pending', label: 'Pending Emissions', icon: Clock },
  { id: 'restatement', label: 'Restatement', icon: Calculator },
  { id: 'log', label: 'Audit Log', icon: FileText },
];

export default function Compliance() {
  const [tab, setTab] = useState('audit');
  const [summary, setSummary] = useState({ unmapped: 0, suppliers: 0, pending_txn: 0, open_periods: 0 });

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list(),
      base44.entities.Supplier.list(),
      base44.entities.Transaction.filter({ sync_status: 'pending_emission_calc' }),
      base44.entities.ReportingPeriod.filter({ status: 'open' }),
    ]).then(([products, suppliers, pendingTxns, openPeriods]) => {
      setSummary({
        unmapped: products.filter(p => p.emission_mapping_status !== 'Mapped').length,
        suppliers: suppliers.filter(s => s.carbon_disclosure_status === 'Not Disclosed' || !s.carbon_disclosure_status).length,
        pending_txn: pendingTxns.length,
        open_periods: openPeriods.length,
      });
    });
  }, []);

  const alerts = [
    summary.unmapped > 0 && { level: 'error', msg: `${summary.unmapped} product(s) have no emission factor — Scope 3 data is incomplete` },
    summary.pending_txn > 0 && { level: 'error', msg: `${summary.pending_txn} transaction(s) have unresolved pending emission calculations` },
    summary.suppliers > 0 && { level: 'warn', msg: `${summary.suppliers} supplier(s) have not disclosed carbon data` },
  ].filter(Boolean);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Data Integrity & Compliance
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">UK Scope 3 compliance readiness — DEFRA / GHG Protocol</p>
      </div>

      {/* Compliance alerts */}
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
              a.level === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-green-50 border-green-200 text-green-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          All compliance checks passed — data is ready for Scope 3 reporting.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'audit' && <EmissionAuditPanel />}
      {tab === 'suppliers' && <SupplierDisclosurePanel />}
      {tab === 'periods' && <PeriodLockPanel />}
      {tab === 'pending' && <PendingEmissionsPanel />}
      {tab === 'restatement' && <RestatementCalculator />}
      {tab === 'log' && <AuditLogPanel />}
    </div>
  );
}