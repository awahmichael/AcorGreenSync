import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, RefreshCw, Pause, Play, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const DUNNING_COLORS = {
  none: 'bg-green-100 text-green-700',
  retry_1: 'bg-amber-100 text-amber-700',
  retry_2: 'bg-orange-100 text-orange-700',
  grace_period: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-100 text-gray-700'
};

const DUNNING_FLOW = ['none', 'retry_1', 'retry_2', 'grace_period', 'suspended'];

export default function DunningPanel() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Organization.list('-created_date', 500);
      setOrgs(data || []);
    } catch (err) {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const dunningOrgs = orgs.filter(o => o.dunning_status && o.dunning_status !== 'none');
  const pastDueOrgs = orgs.filter(o => o.subscription_status === 'past_due');
  const allProblemOrgs = [...new Set([...dunningOrgs, ...pastDueOrgs])];

  const advanceDunning = async (org) => {
    setActioningId(org.id);
    const currentIndex = DUNNING_FLOW.indexOf(org.dunning_status || 'none');
    const nextStatus = DUNNING_FLOW[Math.min(currentIndex + 1, DUNNING_FLOW.length - 1)];
    try {
      const updates = {
        dunning_status: nextStatus,
        dunning_retry_count: (org.dunning_retry_count || 0) + 1
      };
      if (nextStatus === 'suspended') {
        updates.subscription_status = 'suspended';
        updates.is_active = false;
      }
      await base44.entities.Organization.update(org.id, updates);
      toast.success(`Dunning advanced to ${nextStatus} for ${org.name}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update dunning status');
    } finally {
      setActioningId(null);
    }
  };

  const resolveDunning = async (org) => {
    setActioningId(org.id);
    try {
      await base44.entities.Organization.update(org.id, {
        dunning_status: 'none',
        dunning_retry_count: 0,
        subscription_status: 'active',
        is_active: true
      });
      toast.success(`Payment resolved for ${org.name} — subscription reactivated`);
      loadData();
    } catch (err) {
      toast.error('Failed to resolve dunning');
    } finally {
      setActioningId(null);
    }
  };

  const sendReminder = async (org) => {
    if (!org.billing_email) { toast.error('No billing email set for this organization'); return; }
    setActioningId(org.id);
    try {
      await base44.integrations.Core.SendEmail({
        to: org.billing_email,
        subject: `Action Required: Payment Failed for ${org.name}`,
        body: `Hello,\n\nA recent payment for your ${org.plan_type} subscription to AcorCloud has failed. Please update your payment method to avoid service disruption.\n\nCurrent Status: ${org.dunning_status || 'past_due'}\nRetry Attempts: ${org.dunning_retry_count || 0}\n\nIf you need assistance, please contact our support team.\n\nThank you,\nAcorCloud Team`
      });
      toast.success(`Payment reminder sent to ${org.name}`);
    } catch (err) {
      toast.error('Failed to send email reminder');
    } finally {
      setActioningId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-medium">In Dunning</span></div>
          <div className="text-2xl font-bold text-amber-700">{dunningOrgs.length}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-700 mb-1"><RefreshCw className="w-4 h-4" /><span className="text-xs font-medium">Retry 1</span></div>
          <div className="text-2xl font-bold text-orange-700">{dunningOrgs.filter(o => o.dunning_status === 'retry_1').length}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 mb-1"><Pause className="w-4 h-4" /><span className="text-xs font-medium">Grace / Suspended</span></div>
          <div className="text-2xl font-bold text-red-700">{dunningOrgs.filter(o => ['grace_period', 'suspended'].includes(o.dunning_status)).length}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-1"><Clock className="w-4 h-4" /><span className="text-xs font-medium">Past Due</span></div>
          <div className="text-2xl font-bold text-blue-700">{pastDueOrgs.length}</div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Dunning Workflow:</strong> Payment fails → Retry 1 (3 days) → Retry 2 (7 days) → Grace Period (14 days) → Suspend. Use "Advance" to move an org to the next stage, or "Resolve" when payment is recovered.
      </div>

      {allProblemOrgs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
          <AlertTriangle className="w-12 h-12 mx-auto text-green-500 mb-3" />
          <p className="text-muted-foreground">All organizations are in good standing. No dunning issues.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Organization</th><th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Dunning Status</th><th className="px-4 py-3 font-semibold">Sub Status</th>
              <th className="px-4 py-3 font-semibold text-center">Retries</th><th className="px-4 py-3 font-semibold">Billing Email</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {allProblemOrgs.map(o => (
                <tr key={o.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{o.name}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{o.plan_type}</Badge></td>
                  <td className="px-4 py-3"><Badge className={DUNNING_COLORS[o.dunning_status] || 'bg-gray-100'}>{o.dunning_status || 'none'}</Badge></td>
                  <td className="px-4 py-3"><Badge className={o.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>{o.subscription_status}</Badge></td>
                  <td className="px-4 py-3 text-center font-medium">{o.dunning_retry_count || 0}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{o.billing_email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" disabled={actioningId === o.id} onClick={() => sendReminder(o)} className="h-8"><Mail className="w-3.5 h-3.5" /> Remind</Button>
                      {o.dunning_status !== 'suspended' ? (
                        <Button variant="ghost" size="sm" disabled={actioningId === o.id} onClick={() => advanceDunning(o)} className="h-8 text-amber-600"><RefreshCw className="w-3.5 h-3.5" /> Advance</Button>
                      ) : null}
                      <Button variant="ghost" size="sm" disabled={actioningId === o.id} onClick={() => resolveDunning(o)} className="h-8 text-green-600"><Play className="w-3.5 h-3.5" /> Resolve</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}