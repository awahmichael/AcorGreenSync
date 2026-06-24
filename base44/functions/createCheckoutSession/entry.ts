import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { organization_id, billing_cycle } = await req.json();
    if (!organization_id) return Response.json({ error: 'Organization ID required' }, { status: 400 });

    const org = await base44.asServiceRole.entities.Organization.get(organization_id);
    if (!org) return Response.json({ error: 'Organization not found' }, { status: 404 });

    const plans = await base44.asServiceRole.entities.PricingPlan.filter({ name: org.plan_type, is_active: true });
    if (plans.length === 0) return Response.json({ error: 'Plan not found or inactive' }, { status: 404 });
    const plan = plans[0];

    const priceId = billing_cycle === 'annual' ? plan.stripe_price_id_annual : plan.stripe_price_id_monthly;
    if (!priceId) return Response.json({ error: 'Stripe price not configured for this plan and billing cycle' }, { status: 400 });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), { apiVersion: '2024-12-18.acacia' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: org.billing_email || undefined,
      client_reference_id: organization_id,
      success_url: `${req.headers.get('origin') || 'https://app.base44.com'}/saas-admin?checkout=success&org=${organization_id}`,
      cancel_url: `${req.headers.get('origin') || 'https://app.base44.com'}/saas-admin?checkout=cancelled&org=${organization_id}`,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        organization_id,
        plan_name: plan.name
      }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});