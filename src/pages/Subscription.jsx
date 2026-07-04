import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useOrganization } from '@/hooks/useOrganization.jsx';
import { Check, Crown, Zap, Building2, Loader2, CreditCard, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const PLAN_ICONS = { Starter: Zap, Growth: Crown, Enterprise: Building2 };

export default function Subscription() {
  const { currentOrg, organizationId, refreshCurrentOrg } = useOrganization();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => {
    base44.entities.PricingPlan.filter({ is_active: true })
      .then(data => setPlans(data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))))
      .catch(() => toast.error('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  const startCheckout = async (planName) => {
    if (window.self !== window.top) {
      toast.error('Checkout requires a published app. Please open in a new tab.');
      return;
    }
    setCheckoutPlan(planName);
    try {
      const response = await base44.functions.invoke('createCheckoutSession', {
        organization_id: organizationId,
        billing_cycle: billingCycle,
        plan_name: planName,
      });
      const { url, error } = response.data || {};
      if (error) { toast.error(error); setCheckoutPlan(null); return; }
      if (url) window.location.href = url;
    } catch (err) {
      toast.error('Failed to start checkout');
      setCheckoutPlan(null);
    }
  };

  const trialEndsAt = currentOrg?.trial_ends_at ? new Date(currentOrg.trial_ends_at) : null;
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const isTrial = currentOrg?.subscription_status === 'trial';
  const isExpired = isTrial && daysLeft <= 0;
  const isActive = currentOrg?.subscription_status === 'active';

  const trialProgress = Math.max(0, Math.min(100, ((14 - daysLeft) / 14) * 100));

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscription & Billing</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your plan, trial, and payment method</p>
      </div>

      {/* Current Status Card */}
      <div className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10">
              {currentOrg?.plan_type === 'Enterprise' ? <Building2 className="w-5 h-5 text-primary" /> :
               currentOrg?.plan_type === 'Growth' ? <Crown className="w-5 h-5 text-primary" /> :
               <Zap className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current Plan</div>
              <div className="text-lg font-bold text-foreground">{currentOrg?.plan_type || '—'} Plan</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isTrial ? 'bg-blue-50 text-blue-700' :
                  isActive ? 'bg-green-50 text-green-700' :
                  isExpired ? 'bg-red-50 text-red-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {currentOrg?.subscription_status?.replace('_', ' ') || '—'}
                </span>
                {isTrial && daysLeft > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Locations</div>
              <div className="font-semibold text-foreground">{currentOrg?.max_locations || 1}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">SKU Limit</div>
              <div className="font-semibold text-foreground">{(currentOrg?.max_skus || 5000).toLocaleString()}</div>
            </div>
            {currentOrg?.billing_cycle && (
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Billing</div>
                <div className="font-semibold text-foreground capitalize">{currentOrg.billing_cycle}</div>
              </div>
            )}
          </div>
        </div>

        {/* Trial progress bar */}
        {isTrial && trialEndsAt && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Trial Period</span>
              <span>{isExpired ? 'Trial expired' : `${daysLeft} of 14 days remaining`}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isExpired ? 'bg-red-500' : daysLeft <= 3 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${trialProgress}%` }}
              />
            </div>
            {isExpired && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Your trial has expired. Select a plan below to continue using AcorCloud.
              </div>
            )}
            {daysLeft > 0 && daysLeft <= 3 && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Your trial ends soon — select a plan to avoid interruption.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground border border-border'}`}
        >Monthly</button>
        <button
          onClick={() => setBillingCycle('annual')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${billingCycle === 'annual' ? 'bg-primary text-primary-foreground' : 'bg-white text-muted-foreground border border-border'}`}
        >Annual <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Save ~17%</span></button>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map(plan => {
            const Icon = PLAN_ICONS[plan.name] || Zap;
            const isCurrent = currentOrg?.plan_type === plan.name;
            const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;
            const interval = billingCycle === 'annual' ? '/year' : '/month';

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl border-2 p-6 flex flex-col ${plan.is_popular ? 'border-primary' : 'border-border'}`}
              >
                {plan.is_popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wide">Popular</span>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${plan.is_popular ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`w-5 h-5 ${plan.is_popular ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-foreground">£{price}</span>
                  <span className="text-sm text-muted-foreground">{interval}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button disabled className="w-full py-2.5 rounded-lg text-sm font-semibold bg-muted text-muted-foreground cursor-default">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => startCheckout(plan.name)}
                    disabled={checkoutPlan === plan.name}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${plan.is_popular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border text-foreground hover:bg-accent'}`}
                  >
                    {checkoutPlan === plan.name
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                      : <><CreditCard className="w-4 h-4" /> Choose {plan.name}</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Current period info */}
      {currentOrg?.current_period_end && (
        <div className="bg-muted/40 rounded-xl p-4 flex items-center gap-3 text-sm">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Current billing period ends: <span className="font-medium text-foreground">{new Date(currentOrg.current_period_end).toLocaleDateString('en-GB')}</span>
          </span>
        </div>
      )}
    </div>
  );
}