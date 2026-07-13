import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Loader2,
  Lock,
  Calendar,
  FileText,
  Receipt,
  Users,
  PoundSterling,
  Leaf,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';

export default function VerifyIntegrity() {
  const { period_id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!period_id) { setError('No period ID provided in URL.'); setLoading(false); return; }
    base44.functions.invoke('publicVerifyIntegrity', { period_id })
      .then(res => setResult(res.data))
      .catch(err => setError(err.message || 'Verification failed.'))
      .finally(() => setLoading(false));
  }, [period_id]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4 font-body">
      {/* Header */}
      <div className="w-full max-w-3xl mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Integrity Verification Portal</h1>
            <p className="text-xs text-slate-500 font-mono">AcorCloud Green-Sync · RegTech Public Ledger</p>
          </div>
        </div>
        <div className="h-px bg-slate-200 mt-4" />
      </div>

      {/* Content */}
      <div className="w-full max-w-3xl">
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            <p className="text-sm text-slate-500 font-mono">Recalculating SHA-256 hash...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center gap-4">
            <XCircle className="w-10 h-10 text-red-500" />
            <h2 className="text-base font-semibold text-slate-900">Verification Error</h2>
            <p className="text-sm text-slate-500 text-center">{error}</p>
          </div>
        )}

        {result && !loading && !error && (
          <div className="space-y-4">
            {/* Status banner */}
            {result.verified ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-green-900">Data Integrity Confirmed</h2>
                  <p className="text-sm text-green-700">
                    The recalculated hash matches the sealed hash. This reporting period's data is
                    mathematically proven unaltered since the seal date.
                  </p>
                </div>
              </div>
            ) : result.reason ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Lock className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-amber-900">Period Not Sealed</h2>
                  <p className="text-sm text-amber-700">{result.reason}</p>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-900">Tamper Detected</h2>
                  <p className="text-sm text-red-700">
                    The recalculated hash does not match the sealed hash. Data has been modified
                    since this period was sealed.
                  </p>
                </div>
              </div>
            )}

            {/* Period summary card */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reporting Period</h3>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 text-xs">Label</span>
                  <span className="font-medium text-slate-900 ml-auto">{result.label || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 text-xs">Period</span>
                  <span className="font-medium text-slate-900 ml-auto font-mono text-xs">
                    {result.period_start} → {result.period_end}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 text-xs">Transactions</span>
                  <span className="font-medium text-slate-900 ml-auto font-mono">
                    {(result.total_transactions ?? result.current_transaction_count ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 text-xs">Audit Logs</span>
                  <span className="font-medium text-slate-900 ml-auto font-mono">
                    {(result.audit_log_count ?? 0).toLocaleString()}
                  </span>
                </div>
                {result.total_kg_co2e != null && (
                  <div className="flex items-center gap-2">
                    <Leaf className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-slate-500 text-xs">Scope 3 Total</span>
                    <span className="font-medium text-slate-900 ml-auto font-mono">
                      {result.total_kg_co2e.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg CO₂e
                    </span>
                  </div>
                )}
                {result.total_revenue != null && (
                  <div className="flex items-center gap-2">
                    <PoundSterling className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500 text-xs">Revenue</span>
                    <span className="font-medium text-slate-900 ml-auto font-mono">
                      £{result.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {result.locked_by && (
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500 text-xs">Sealed By</span>
                    <span className="font-medium text-slate-900 ml-auto">{result.locked_by}</span>
                  </div>
                )}
                {result.locked_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500 text-xs">Sealed At</span>
                    <span className="font-medium text-slate-900 ml-auto font-mono text-xs">
                      {new Date(result.locked_at).toLocaleString('en-GB')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Hash comparison */}
            {result.stored_hash && result.recalculated_hash && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Fingerprint className="w-3.5 h-3.5 text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SHA-256 Cryptographic Hash</h3>
                  {result.hash_version && (
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">{result.hash_version}</span>
                  )}
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sealed Hash (at lock time)</span>
                      {result.verified && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    </div>
                    <code className="block text-[11px] text-slate-700 font-mono break-all bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      {result.stored_hash}
                    </code>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Recalculated Hash (live)</span>
                      {result.verified
                        ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                        : <XCircle className="w-3 h-3 text-red-500" />}
                    </div>
                    <code className={`block text-[11px] font-mono break-all rounded-lg px-3 py-2 border ${
                      result.verified
                        ? 'text-green-700 bg-green-50 border-green-100'
                        : 'text-red-700 bg-red-50 border-red-100'
                    }`}>
                      {result.recalculated_hash}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                    <CheckCircle2 className={`w-3 h-3 ${result.verified ? 'text-green-500' : 'text-red-500'}`} />
                    <span>Verification performed at {new Date(result.verified_at).toLocaleString('en-GB')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Discrepancy details */}
            {result.discrepancies && (
              <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-red-100 bg-red-50 flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider">Integrity Discrepancies</h3>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Transactions</div>
                      <div className="font-mono text-xs text-slate-700">
                        Sealed: {result.discrepancies.sealed_transaction_count} → Current: {result.discrepancies.current_transaction_count}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Audit Logs</div>
                      <div className="font-mono text-xs text-slate-700">
                        Sealed: {result.discrepancies.sealed_audit_log_count} → Current: {result.discrepancies.current_audit_log_count}
                      </div>
                    </div>
                  </div>
                  {result.discrepancies.audit_logs_added_since_seal?.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-red-600 mb-1.5">
                        {result.discrepancies.audit_logs_added_since_seal.length} audit log(s) added since seal:
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {result.discrepancies.audit_logs_added_since_seal.slice(0, 10).map((log, i) => (
                          <div key={i} className="text-xs font-mono text-slate-600 bg-red-50/50 rounded px-2 py-1 border border-red-100">
                            {log.performed_at} · {log.action} · {log.user_name || 'Unknown'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-4">
              <p className="text-[11px] text-slate-400">
                This verification is performed live using the same deterministic SHA-256 algorithm applied at seal time.
                No login or authentication is required — the hash is the proof.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}