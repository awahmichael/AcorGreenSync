import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if user already has an organization
    const existingOrgs = await base44.entities.Organization.list('-created_date', 10);
    if (existingOrgs.length > 0) {
      return Response.json({ organization: existingOrgs[0], already_existed: true });
    }

    // Create default org with 14-day Starter trial (zero payment)
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 14);

    const defaultName = user.email
      ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'My Business';

    const org = await base44.entities.Organization.create({
      name: defaultName,
      plan_type: 'Starter',
      subscription_status: 'trial',
      billing_cycle: 'monthly',
      trial_ends_at: trialEnd.toISOString(),
      subscription_started_at: now.toISOString(),
      billing_email: user.email || '',
      max_locations: 1,
      max_skus: 5000,
      default_tax_rate: 20,
      country_code: 'GB',
      is_active: true,
      onboarding_completed: false,
    });

    return Response.json({ organization: org, already_existed: false });
  } catch (error) {
    console.error('autoProvisionOrganization error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});