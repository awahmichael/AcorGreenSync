import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const { plan_name, billing_cycle, email, lead_id } = await req.json();
    if (!plan_name || !email) {
      return Response.json({ error: 'plan_name and email are required' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), { apiVersion: '2024-12-18.acacia' });

    // Find existing Stripe customer by email, or create one
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({ email, metadata: { base44_app_id: Deno.env.get('BASE44_APP_ID'), plan_name } });
    }

    // Look up the Stripe price ID from PricingPlan records
    const base44 = createClientFromRequest(req);
    const plans = await base44.asServiceRole.entities.PricingPlan.filter({ name: plan_name, is_active: true });
    if (plans.length === 0) {
      return Response.json({ error: `Plan "${plan_name}" not found or inactive` }, { status: 404 });
    }
    const plan = plans[0];

    const priceId = billing_cycle === 'annual' ? plan.stripe_price_id_annual : plan.stripe_price_id_monthly;
    if (!priceId) {
      return Response.json({ error: `Stripe price not configured for ${plan_name} (${billing_cycle || 'monthly'})` }, { status: 400 });
    }

    const origin = req.headers.get('origin') || 'https://acorgreensync.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        plan_name,
        billing_cycle: billing_cycle || 'monthly',
        lead_id: lead_id || '',
        prospect_email: email,
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
          plan_name,
          prospect_email: email,
        },
      },
    });

    console.log(`Created public checkout session for ${email} → ${plan_name} (${billing_cycle || 'monthly'})`);

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createPublicCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});