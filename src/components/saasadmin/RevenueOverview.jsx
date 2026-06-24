import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertCircle } from 'lucide-react';

const PLAN_PRICES = { Starter: 29, Growth: 79, Enterprise: 0 };

export default function RevenueOverview() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Organization.list('-created_date', 500);
        setOrgs(data || []);
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

  const activeOrgs = orgs.filter(o => o.subscription_status === 'active');
  const trialOrgs = orgs.filter(o => o.subscription_status === 'trial');
  const churnedOrgs = orgs.filter(o => o.subscription_status === 'cancelled');
  const pastDueOrgs = orgs.filter(o => o.subscription_status === 'past_due');

  const mrr = activeOrgs.reduce((sum, o) => {
    const price = PLAN_PRICES[o.plan_type] || 0;
    return sum + (o.billing_cycle === 'annual' ? price / 12 : price);
  }, 0);

  const arr = mrr * 12;

  const orgsByPlan = {
    Starter: orgs.filter(o => o.plan_type === 'Starter').length,
    Growth: orgs.filter(o => o.plan_type === 'Growth').length,
    Enterprise: orgs.filter(o => o.plan_type === 'Enterprise').length,
  };

  const churnRate = orgs.length > 0 ? (churnedOrgs.length / orgs.length * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Monthly Recurring Revenue</span></div>
          <div className="text-2xl font-bold text-green-600">£{mrr.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{activeOrgs.length} active subscriptions</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><TrendingUp className="w-4 h-4" /><span className="text-xs font-medium">Annual Recurring Revenue</span></div>
          <div className="text-2xl font-bold">£{arr.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">Projected yearly</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="w-4 h-4" /><span className="text-xs font-medium">Total Organizations</span></div>
          <div className="text-2xl font-bold">{orgs.length}</div>
          <div className="text-xs text-muted-foreground">{trialOrgs.length} on trial · {activeOrgs.length} active</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1"><TrendingDown className="w-4 h-4" /><span className="text-xs font-medium">Churn Rate</span></div>
          <div className="text-2xl font-bold text-red-600">{churnRate}%</div>
          <div className="text-xs text-muted-foreground">{churnedOrgs.length} cancelled</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(orgsByPlan).map(([plan, count]) => (
          <div key={plan} className="bg-white border border-border rounded-lg p-4">
            <div className="text-sm font-semibold">{plan}</div>
            <div className="text-3xl font-bold mt-1">{count}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {plan === 'Enterprise' ? 'Custom pricing' : `£${PLAN_PRICES[plan]}/mo`}
            </div>
          </div>
        ))}
      </div>

      {pastDueOrgs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 font-medium mb-2"><AlertCircle className="w-4 h-4" /> Payment Issues ({pastDueOrgs.length})</div>
          <div className="space-y-1">
            {pastDueOrgs.map(o => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{o.name}</span>
                <Badge className="bg-amber-100 text-amber-700">{o.dunning_status || 'past_due'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-3 font-semibold">Organization</th><th className="px-4 py-3 font-semibold">Plan</th>
            <th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Billing</th>
            <th className="px-4 py-3 font-semibold">MRR</th><th className="px-4 py-3 font-semibold">Period End</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {orgs.map(o => (
              <tr key={o.id} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 font-medium">{o.name}</td>
                <td className="px-4 py-2.5"><Badge variant="outline">{o.plan_type}</Badge></td>
                <td className="px-4 py-2.5">
                  <Badge className={o.subscription_status === 'active' ? 'bg-green-100 text-green-700' : o.subscription_status === 'trial' ? 'bg-blue-100 text-blue-700' : o.subscription_status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                    {o.subscription_status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-xs">{o.billing_cycle || 'monthly'}</td>
                <td className="px-4 py-2.5 font-medium">£{o.subscription_status === 'active' ? ((PLAN_PRICES[o.plan_type] || 0) / (o.billing_cycle === 'annual' ? 12 : 1)).toFixed(2) : '0.00'}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{o.current_period_end ? new Date(o.current_period_end).toLocaleDateString('en-GB') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}