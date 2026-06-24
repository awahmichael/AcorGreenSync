import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, RefreshCw, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function MerchantHealth() {
  const [orgs, setOrgs] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [orgData, logData] = await Promise.all([
          base44.entities.Organization.list('-created_date', 500),
          base44.entities.SyncLog.list('-created_date', 100)
        ]);
        setOrgs(orgData || []);
        setSyncLogs(logData || []);
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

  const dunningOrgs = orgs.filter(o => o.dunning_status && o.dunning_status !== 'none');
  const trialEndingSoon = orgs.filter(o => {
    if (o.subscription_status !== 'trial' || !o.trial_ends_at) return false;
    const daysLeft = (new Date(o.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24);
    return daysLeft <= 3 && daysLeft >= 0;
  });
  const failedSyncs = syncLogs.filter(l => l.status === 'failed' || l.status === 'error');
  const healthyOrgs = orgs.filter(o => o.subscription_status === 'active' && (!o.dunning_status || o.dunning_status === 'none'));

  const sendDunningEmail = async (org) => {
    try {
      await base44.integrations.Core.SendEmail({
        to: org.billing_email || '',
        subject: 'Action Required: Payment Failed for ' + org.name,
        body: `Hello,\n\nA recent payment for your ${org.plan_type} subscription to AcorCloud has failed. Please update your payment method to avoid service disruption.\n\nYour current status: ${org.dunning_status}\n\nThank you,\nAcorCloud Team`
      });
      toast.success(`Dunning email sent to ${org.name}`);
    } catch (err) {
      toast.error('Failed to send email — check billing email is set');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 mb-1"><CheckCircle className="w-4 h-4" /><span className="text-xs font-medium">Healthy Orgs</span></div>
          <div className="text-2xl font-bold text-green-700">{healthyOrgs.length}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-medium">In Dunning</span></div>
          <div className="text-2xl font-bold text-amber-700">{dunningOrgs.length}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-1"><RefreshCw className="w-4 h-4" /><span className="text-xs font-medium">Trial Ending</span></div>
          <div className="text-2xl font-bold text-blue-700">{trialEndingSoon.length}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 mb-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-medium">Sync Failures</span></div>
          <div className="text-2xl font-bold text-red-700">{failedSyncs.length}</div>
        </div>
      </div>

      {dunningOrgs.length > 0 && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 font-semibold border-b border-border flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Dunning Management</h3>
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Organization</th><th className="px-4 py-2 font-semibold">Plan</th>
              <th className="px-4 py-2 font-semibold">Dunning Status</th><th className="px-4 py-2 font-semibold">Retries</th>
              <th className="px-4 py-2 font-semibold text-right">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {dunningOrgs.map(o => (
                <tr key={o.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{o.name}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline">{o.plan_type}</Badge></td>
                  <td className="px-4 py-2.5"><Badge className="bg-amber-100 text-amber-700">{o.dunning_status}</Badge></td>
                  <td className="px-4 py-2.5">{o.dunning_retry_count || 0}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => sendDunningEmail(o)} className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto">
                      <Mail className="w-3 h-3" /> Send Reminder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {trialEndingSoon.length > 0 && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 font-semibold border-b border-border flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-600" /> Trials Ending Soon</h3>
          <div className="divide-y divide-border">
            {trialEndingSoon.map(o => (
              <div key={o.id} className="flex items-center justify-between px-4 py-3">
                <div><div className="font-medium text-sm">{o.name}</div><div className="text-xs text-muted-foreground">Trial ends: {new Date(o.trial_ends_at).toLocaleDateString('en-GB')}</div></div>
                <Badge className="bg-blue-100 text-blue-700">Trial</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {failedSyncs.length > 0 && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 font-semibold border-b border-border flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /> Recent Sync Failures</h3>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {failedSyncs.slice(0, 20).map(log => (
              <div key={log.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div><div className="font-medium">{log.entity_name || 'Entity'}</div><div className="text-xs text-muted-foreground">{log.error_message || 'Sync error'}</div></div>
                <div className="text-xs text-muted-foreground">{log.created_date ? new Date(log.created_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}