import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), { apiVersion: '2024-12-18.acacia' });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !webhookSecret) {
      return Response.json({ error: "Missing signature or webhook secret" }, { status: 400 });
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    const base44 = createClientFromRequest(req);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: sub.customer });
        if (orgs.length > 0) {
          const org = orgs[0];
          await base44.asServiceRole.entities.Organization.update(org.id, {
            subscription_status: sub.status === 'active' ? 'active' : sub.status === 'trialing' ? 'trial' : sub.status,
            current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            dunning_status: 'none',
            dunning_retry_count: 0,
            is_active: sub.status !== 'canceled'
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
            is_active: false
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
            current_period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null
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
            dunning_retry_count: (org.dunning_retry_count || 0) + 1
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