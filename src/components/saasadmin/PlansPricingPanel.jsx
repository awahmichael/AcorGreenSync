import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import PricingPlanModal from '@/components/saasadmin/PricingPlanModal';

const COLOR_MAP = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  purple: 'bg-purple-50 border-purple-200',
  gray: 'bg-gray-50 border-gray-200'
};

const getColor = (sort_order) => {
  const colors = ['blue', 'green', 'purple', 'gray'];
  return colors[sort_order % colors.length];
};

export default function PlansPricingPanel() {
  const [plans, setPlans] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [planData, orgData] = await Promise.all([
        base44.entities.PricingPlan.list('sort_order', 500),
        base44.entities.Organization.list('-created_date', 500)
      ]);
      setPlans(planData || []);
      setOrgs(orgData || []);
    } catch (err) {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getOrgCount = (planName) => orgs.filter(o => o.plan_type === planName).length;
  const getActiveCount = (planName) => orgs.filter(o => o.plan_type === planName && o.subscription_status === 'active').length;
  const getMrr = (plan) => {
    if (!plan.price_monthly) return 0;
    return orgs.filter(o => o.plan_type === plan.name && o.subscription_status === 'active')
      .reduce((sum, o) => {
        const monthly = plan.price_monthly;
        const annual = plan.price_annual || (monthly * 12);
        return sum + (o.billing_cycle === 'annual' ? annual / 12 : monthly);
      }, 0);
  };

  const handleDelete = async (plan) => {
    const orgCount = getOrgCount(plan.name);
    if (orgCount > 0) { toast.error(`Cannot delete: ${orgCount} organization(s) are on this plan`); return; }
    setDeletingId(plan.id);
    try {
      await base44.entities.PricingPlan.delete(plan.id);
      toast.success('Plan deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{plans.length} plans configured</p>
        <Button onClick={() => { setEditingPlan(null); setShowModal(true); }}><Plus className="w-4 h-4" /> New Plan</Button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
          <Star className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">No pricing plans yet.</p>
          <Button onClick={() => { setEditingPlan(null); setShowModal(true); }}><Plus className="w-4 h-4" /> Create First Plan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => {
            const colorClass = COLOR_MAP[getColor(plan.sort_order)] || COLOR_MAP.gray;
            const orgCount = getOrgCount(plan.name);
            const activeCount = getActiveCount(plan.name);
            const mrr = getMrr(plan);

            return (
              <div key={plan.id} className={`relative bg-white border-2 ${plan.is_popular ? 'border-primary' : 'border-border'} rounded-xl p-6 ${plan.is_popular ? 'ring-2 ring-primary/20' : ''}`}>
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">Most Popular</Badge>
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    {!plan.is_active && <Badge variant="outline" className="text-gray-500 mt-1">Inactive</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingPlan(plan); setShowModal(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" disabled={deletingId === plan.id} onClick={() => handleDelete(plan)}>
                      {deletingId === plan.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.description || 'No description'}</p>
                <div className="flex items-baseline gap-1 mb-4">
                  {plan.price_monthly > 0 ? (
                    <><span className="text-3xl font-bold">£{plan.price_monthly}</span><span className="text-sm text-muted-foreground">/month</span>
                      {plan.price_annual > 0 && <span className="text-xs text-muted-foreground ml-2">or £{plan.price_annual}/yr</span>}
                    </>
                  ) : <span className="text-3xl font-bold">Custom</span>}
                </div>
                <div className={`grid grid-cols-3 gap-2 mb-4 ${colorClass} rounded-lg p-3`}>
                  <div className="text-center"><div className="text-lg font-bold">{orgCount}</div><div className="text-xs text-muted-foreground">Total</div></div>
                  <div className="text-center"><div className="text-lg font-bold text-green-600">{activeCount}</div><div className="text-xs text-muted-foreground">Active</div></div>
                  <div className="text-center"><div className="text-lg font-bold">£{mrr.toFixed(0)}</div><div className="text-xs text-muted-foreground">MRR</div></div>
                </div>
                <ul className="space-y-2">
                  {(plan.features || []).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600 flex-shrink-0" /><span>{feature}</span></li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                  <div>Max Locations: <span className="font-medium text-foreground">{plan.max_locations >= 999 ? 'Unlimited' : plan.max_locations}</span></div>
                  <div>Max SKUs: <span className="font-medium text-foreground">{plan.max_skus >= 999999 ? 'Unlimited' : (plan.max_skus || 0).toLocaleString()}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <PricingPlanModal plan={editingPlan} onClose={() => setShowModal(false)} onSaved={loadData} />}
    </div>
  );
}