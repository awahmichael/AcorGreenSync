import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Rocket, Zap } from 'lucide-react';

const PLAN_CONFIG = [
  {
    name: 'Starter',
    price: 29,
    icon: Rocket,
    color: 'blue',
    description: 'Perfect for single-location shops getting started with digital POS',
    features: ['1 store location', 'Up to 5,000 SKUs', 'Core POS & Inventory', 'Standard reports', 'Email support'],
    limits: { max_locations: 1, max_skus: 5000 }
  },
  {
    name: 'Growth',
    price: 79,
    icon: Zap,
    color: 'green',
    description: 'For growing retail chains with multiple locations and advanced needs',
    features: ['Up to 5 store locations', 'Up to 50,000 SKUs', 'Multi-store dashboard', 'Carbon reporting', 'Priority support', 'Advanced analytics'],
    limits: { max_locations: 5, max_skus: 50000 },
    popular: true
  },
  {
    name: 'Enterprise',
    price: null,
    icon: Crown,
    color: 'purple',
    description: 'White-label solution for large retail networks with custom requirements',
    features: ['Unlimited locations', 'Unlimited SKUs', 'Custom integrations', 'White-labeling', 'Dedicated account manager', 'SLA & 24/7 support', 'BI & API access'],
    limits: { max_locations: 999, max_skus: 999999 }
  }
];

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'bg-green-100 text-green-700', badge: 'bg-green-100 text-green-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'bg-purple-100 text-purple-700', badge: 'bg-purple-100 text-purple-700' }
};

export default function PlansPricingPanel() {
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

  const getOrgCount = (planName) => orgs.filter(o => o.plan_type === planName).length;
  const getActiveCount = (planName) => orgs.filter(o => o.plan_type === planName && o.subscription_status === 'active').length;
  const getMrr = (planName) => {
    const plan = PLAN_CONFIG.find(p => p.name === planName);
    if (!plan || !plan.price) return 0;
    return orgs.filter(o => o.plan_type === planName && o.subscription_status === 'active')
      .reduce((sum, o) => sum + (plan.price / (o.billing_cycle === 'annual' ? 12 : 1)), 0);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_CONFIG.map(plan => {
          const colors = COLOR_MAP[plan.color];
          const Icon = plan.icon;
          const orgCount = getOrgCount(plan.name);
          const activeCount = getActiveCount(plan.name);
          const mrr = getMrr(plan.name);

          return (
            <div key={plan.name} className={`relative bg-white border-2 ${plan.popular ? 'border-primary' : 'border-border'} rounded-xl p-6 ${plan.popular ? 'ring-2 ring-primary/20' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">Most Popular</Badge>
                </div>
              )}
              <div className={`w-12 h-12 ${colors.icon} rounded-lg flex items-center justify-center mb-4`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.description}</p>
              <div className="flex items-baseline gap-1 mb-4">
                {plan.price ? (<><span className="text-3xl font-bold">£{plan.price}</span><span className="text-sm text-muted-foreground">/month</span></>) :
                  <span className="text-3xl font-bold">Custom</span>}
              </div>

              <div className={`grid grid-cols-3 gap-2 mb-4 ${colors.bg} rounded-lg p-3`}>
                <div className="text-center"><div className="text-lg font-bold">{orgCount}</div><div className="text-xs text-muted-foreground">Total</div></div>
                <div className="text-center"><div className="text-lg font-bold text-green-600">{activeCount}</div><div className="text-xs text-muted-foreground">Active</div></div>
                <div className="text-center"><div className="text-lg font-bold">£{mrr.toFixed(0)}</div><div className="text-xs text-muted-foreground">MRR</div></div>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                <div>Max Locations: <span className="font-medium text-foreground">{plan.limits.max_locations === 999 ? 'Unlimited' : plan.limits.max_locations}</span></div>
                <div>Max SKUs: <span className="font-medium text-foreground">{plan.limits.max_skus === 999999 ? 'Unlimited' : plan.limits.max_skus.toLocaleString()}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Pricing Model Notes</h3>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>• <strong>Per Subscription</strong> model: Growth plan includes up to 5 locations for a single flat fee.</li>
          <li>• <strong>Product Catalog Size (SKUs)</strong> is the primary technical constraint for scaling pricing tiers.</li>
          <li>• No transaction volume limits — businesses are not penalized for success.</li>
          <li>• Enterprise tier is fully customizable with white-labeling, BI access, and dedicated support.</li>
          <li>• Annual billing offers cost optimization for committed customers.</li>
        </ul>
      </div>
    </div>
  );
}