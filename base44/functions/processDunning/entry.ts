import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const orgs = await base44.asServiceRole.entities.Organization.filter({ subscription_status: 'past_due' });
    let dunningEmailsSent = 0;

    for (const org of orgs) {
      if (!org.billing_email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: org.billing_email,
          subject: `Action Required: Payment Failed for ${org.name}`,
          body: `Hello,\n\nA payment for your ${org.plan_type} subscription to AcorCloud has failed. Please update your payment method to avoid service disruption.\n\nCurrent Status: ${org.dunning_status}\nRetry Attempts: ${org.dunning_retry_count || 0}\n\nIf you need assistance, please contact our support team.\n\nThank you,\nAcorCloud Team`
        });
        dunningEmailsSent++;
      } catch (e) {
        console.error(`Failed to send dunning email to ${org.name}:`, e.message);
      }
    }

    const trialOrgs = await base44.asServiceRole.entities.Organization.filter({ subscription_status: 'trial' });
    let trialEmailsSent = 0;

    for (const org of trialOrgs) {
      if (!org.trial_ends_at || !org.billing_email) continue;
      const daysLeft = Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3 && daysLeft > 0) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: org.billing_email,
            subject: `Your AcorCloud trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            body: `Hello,\n\nYour ${org.plan_type} plan trial for AcorCloud expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}, on ${new Date(org.trial_ends_at).toLocaleDateString('en-GB')}.\n\nTo continue enjoying all features after your trial, please add a payment method in your account settings.\n\nThank you,\nAcorCloud Team`
          });
          trialEmailsSent++;
        } catch (e) {
          console.error(`Failed to send trial email to ${org.name}:`, e.message);
        }
      }
    }

    return Response.json({
      dunningEmailsSent,
      trialEmailsSent,
      totalProcessed: orgs.length + trialOrgs.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});