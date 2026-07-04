import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'Not a create event' });
    }

    const lead = data;
    if (!lead?.email) {
      return Response.json({ skipped: true, reason: 'No lead email' });
    }

    const salesEmail = 'sales@acorgreensync.com';

    // 1. Notify sales team
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: salesEmail,
        subject: `New Lead: ${lead.name || lead.email} — ${lead.company || 'Unknown Company'}`,
        body: `A new lead has been captured!\n\nName: ${lead.name || 'N/A'}\nEmail: ${lead.email}\nCompany: ${lead.company || 'N/A'}\nPhone: ${lead.phone || 'N/A'}\nStore Count: ${lead.store_count || 1}\nSource: ${lead.source || 'website'}\nMessage: ${lead.message || 'N/A'}\n\nFollow up within 24 hours to maximize conversion.\n\nView in SaaS Admin → Leads tab.`,
      });
    } catch (e) {
      console.error('Failed to notify sales team:', e.message);
    }

    // 2. Auto-send welcome email to prospect
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: lead.email,
        subject: `Welcome to AcorGreenSync, ${lead.name?.split(' ')[0] || 'there'}!`,
        body: `Hi ${lead.name || 'there'},\n\nThank you for your interest in AcorGreenSync — the carbon-conscious POS platform built for UK retailers.\n\nOur team will reach out within 24 hours to schedule your personalized demo.\n\nIn the meantime, feel free to explore our pricing plans at https://acorgreensync.com/#pricing\n\nBest regards,\nThe AcorGreenSync Team`,
      });
    } catch (e) {
      console.error('Failed to send welcome email to lead:', e.message);
    }

    return Response.json({ success: true, leadEmail: lead.email });
  } catch (error) {
    console.error('onLeadCreated error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});