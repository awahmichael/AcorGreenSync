import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), { apiVersion: '2024-12-18.acacia' });
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    const base44 = createClientFromRequest(req);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerEmail = session.customer_email || session.metadata?.prospect_email;
        const planName = session.metadata?.plan_name || 'Starter';
        const billingCycle = session.metadata?.billing_cycle || 'monthly';
        const leadId = session.metadata?.lead_id;

        // Check if org already exists for this Stripe customer
        let orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: session.customer });

        if (orgs.length === 0 && customerEmail) {
          // Also check by billing_email in case they registered but weren't linked yet
          orgs = await base44.asServiceRole.entities.Organization.filter({ billing_email: customerEmail });
        }

        // Derive billing period end from billing cycle as a fallback
        // (customer.subscription.updated will overwrite with Stripe's exact date when it fires)
        const periodEndFallback = billingCycle === 'annual'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        if (orgs.length > 0) {
          // Existing org choosing a plan — activate immediately with a real billing period
          await base44.asServiceRole.entities.Organization.update(orgs[0].id, {
            stripe_customer_id: session.customer,
            subscription_status: 'active',
            plan_type: planName,
            billing_cycle: billingCycle,
            subscription_started_at: new Date().toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: periodEndFallback,
            is_active: true,
            onboarding_completed: orgs[0].onboarding_completed ?? false,
          });
          console.log(`Activated existing org ${orgs[0].id} for customer ${session.customer}`);
        } else {
          // Auto-provision new organization from public checkout
          const maxLoc = planName === 'Growth' ? 5 : planName === 'Enterprise' ? 999 : 1;
          const maxSkus = planName === 'Growth' ? 25000 : planName === 'Enterprise' ? 999999 : 5000;

          await base44.asServiceRole.entities.Organization.create({
            name: session.metadata?.company_name || customerEmail.split('@')[0],
            plan_type: planName,
            subscription_status: 'active',
            billing_cycle: billingCycle,
            stripe_customer_id: session.customer,
            billing_email: customerEmail,
            subscription_started_at: new Date().toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: periodEndFallback,
            max_locations: maxLoc,
            max_skus: maxSkus,
            onboarding_completed: false,
            is_active: true,
          });
          console.log(`Auto-provisioned new org for ${customerEmail} (${planName})`);
        }

        // Mark the lead as converted if we have a lead_id
        if (leadId) {
          try {
            await base44.asServiceRole.entities.Lead.update(leadId, { status: 'converted' });
          } catch (e) {
            console.error('Failed to update lead status:', e.message);
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: sub.customer });
        if (orgs.length > 0) {
          const org = orgs[0];

          // Determine billing period end — use Stripe's value if available,
          // otherwise derive from billing cycle as a fallback
          let periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;

          if (!periodEnd && sub.status === 'active') {
            const cycle = org.billing_cycle || 'monthly';
            periodEnd = cycle === 'annual'
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }

          await base44.asServiceRole.entities.Organization.update(org.id, {
            subscription_status: sub.status === 'active' ? 'active' : sub.status === 'trialing' ? 'trial' : sub.status,
            current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : (org.current_period_start || new Date().toISOString()),
            current_period_end: periodEnd,
            dunning_status: 'none',
            dunning_retry_count: 0,
            is_active: sub.status !== 'canceled',
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: sub.customer });
        if (orgs.length > 0) {
          await base44.asServiceRole.entities.Organization.update(orgs[0].id, {
            subscription_status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            is_active: false,
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: invoice.customer });
        if (orgs.length > 0) {
          await base44.asServiceRole.entities.Organization.update(orgs[0].id, {
            subscription_status: 'active',
            dunning_status: 'none',
            dunning_retry_count: 0,
            current_period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            current_period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: invoice.customer });
        if (orgs.length > 0) {
          const org = orgs[0];
          const dunningFlow = ['none', 'retry_1', 'retry_2', 'grace_period', 'suspended'];
          const currentIdx = dunningFlow.indexOf(org.dunning_status || 'none');
          const nextStatus = dunningFlow[Math.min(currentIdx + 1, dunningFlow.length - 1)];
          await base44.asServiceRole.entities.Organization.update(org.id, {
            subscription_status: 'past_due',
            dunning_status: nextStatus,
            dunning_retry_count: (org.dunning_retry_count || 0) + 1,
          });
        }
        break;
      }
    }

    return Response.json({ received: true, type: event.type });
  } catch (error) {
    console.error('handleSubscriptionWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});