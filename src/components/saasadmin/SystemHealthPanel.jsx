import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, RefreshCw, CreditCard, Activity, Wifi, WifiOff, Clock } from 'lucide-react';

const STATUS_COLORS = {
  idle: 'bg-gray-100 text-gray-700',
  online: 'bg-green-100 text-green-700',
  offline: 'bg-gray-100 text-gray-500',
  busy: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700'
};

export default function SystemHealthPanel() {
  const [terminals, setTerminals] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [termData, logData, orgData] = await Promise.all([
          base44.entities.PaymentTerminal.list('-updated_date', 500),
          base44.entities.SyncLog.list('-created_date', 100),
          base44.entities.Organization.list('-created_date', 500)
        ]);
        setTerminals(termData || []);
        setSyncLogs(logData || []);
        setOrgs(orgData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const onlineTerminals = terminals.filter(t => t.status === 'online').length;
  const offlineTerminals = terminals.filter(t => t.status === 'offline').length;
  const errorTerminals = terminals.filter(t => t.status === 'error').length;
  const failedSyncs = syncLogs.filter(l => l.status === 'failed');
  const trialEndingSoon = orgs.filter(o => {
    if (o.subscription_status !== 'trial' || !o.trial_ends_at) return false;
    const daysLeft = (new Date(o.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24);
    return daysLeft <= 3 && daysLeft >= 0;
  });
  const suspendedOrgs = orgs.filter(o => o.subscription_status === 'suspended' || !o.is_active);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 mb-1"><Wifi className="w-4 h-4" /><span className="text-xs font-medium">Online Terminals</span></div>
          <div className="text-2xl font-bold text-green-700">{onlineTerminals}</div>
          <div className="text-xs text-green-600">of {terminals.length} total</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 mb-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-medium">Error Terminals</span></div>
          <div className="text-2xl font-bold text-red-700">{errorTerminals}</div>
          <div className="text-xs text-red-600">{offlineTerminals} offline</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-1"><RefreshCw className="w-4 h-4" /><span className="text-xs font-medium">Sync Failures</span></div>
          <div className="text-2xl font-bold text-amber-700">{failedSyncs.length}</div>
          <div className="text-xs text-amber-600">recent failures</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-1"><Clock className="w-4 h-4" /><span className="text-xs font-medium">Trials Ending</span></div>
          <div className="text-2xl font-bold text-blue-700">{trialEndingSoon.length}</div>
          <div className="text-xs text-blue-600">within 3 days</div>
        </div>
      </div>

      {suspendedOrgs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2"><AlertTriangle className="w-4 h-4" /> Suspended Organizations ({suspendedOrgs.length})</div>
          <div className="flex flex-wrap gap-2">
            {suspendedOrgs.map(o => <Badge key={o.id} className="bg-red-100 text-red-700">{o.name}</Badge>)}
          </div>
        </div>
      )}

      {trialEndingSoon.length > 0 && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 font-semibold border-b border-border flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Trials Ending Soon</h3>
          <div className="divide-y divide-border">
            {trialEndingSoon.map(o => {
              const daysLeft = Math.ceil((new Date(o.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
              return (
                <div key={o.id} className="flex items-center justify-between px-4 py-3">
                  <div><div className="font-medium text-sm">{o.name}</div><div className="text-xs text-muted-foreground">{o.plan_type} plan · Trial ends: {new Date(o.trial_ends_at).toLocaleDateString('en-GB')}</div></div>
                  <Badge className={daysLeft <= 1 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {failedSyncs.length > 0 && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 font-semibold border-b border-border flex items-center gap-2"><RefreshCw className="w-4 h-4 text-amber-600" /> Recent Sync Failures</h3>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {failedSyncs.slice(0, 20).map(log => (
              <div key={log.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div><div className="font-medium">{log.sync_type || 'Sync'}</div><div className="text-xs text-muted-foreground">{log.details || 'Sync error'}</div></div>
                <div className="text-xs text-muted-foreground">{log.synced_at ? new Date(log.synced_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <h3 className="px-4 py-3 font-semibold border-b border-border flex items-center gap-2"><CreditCard className="w-4 h-4" /> Terminal Health ({terminals.length})</h3>
        {terminals.length === 0 ? (
          <p className="px-4 py-8 text-center text-muted-foreground text-sm">No terminals registered.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Terminal</th><th className="px-4 py-2 font-semibold">Store</th>
              <th className="px-4 py-2 font-semibold">Provider</th><th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Active</th><th className="px-4 py-2 font-semibold">Last Heartbeat</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {terminals.slice(0, 50).map(t => (
                <tr key={t.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5"><div className="font-medium">{t.alias || t.terminal_id}</div><div className="text-xs text-muted-foreground font-mono">{t.terminal_id}</div></td>
                  <td className="px-4 py-2.5 text-xs">{t.store_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{t.provider}</td>
                  <td className="px-4 py-2.5"><Badge className={STATUS_COLORS[t.status] || STATUS_COLORS.offline}>{t.status}</Badge></td>
                  <td className="px-4 py-2.5">{t.is_active ? <CheckCircle className="w-4 h-4 text-green-600" /> : <WifiOff className="w-4 h-4 text-red-500" />}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.last_heartbeat ? new Date(t.last_heartbeat).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {terminals.length > 50 && <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">Showing 50 of {terminals.length} terminals.</div>}
      </div>
    </div>
  );
}