import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FROM_EMAIL = 'AcorGreenSync <onboarding@resend.dev>';

async function sendEmailWithResend(to, subject, body) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      text: body,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API ${res.status}: ${errText}`);
  }
  return await res.json();
}

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
      const subject = `New Lead: ${lead.name || lead.email} — ${lead.company || 'Unknown Company'}`;
      const body = `A new lead has been captured!\n\nName: ${lead.name || 'N/A'}\nEmail: ${lead.email}\nCompany: ${lead.company || 'N/A'}\nPhone: ${lead.phone || 'N/A'}\nStore Count: ${lead.store_count || 1}\nSource: ${lead.source || 'website'}\nMessage: ${lead.message || 'N/A'}\n\nFollow up within 24 hours to maximize conversion.`;
      await sendEmailWithResend(salesEmail, subject, body);
      await base44.asServiceRole.entities.MarketingEmailLog.create({
        recipient_email: salesEmail,
        recipient_name: 'Sales Team',
        subject,
        body_preview: body.substring(0, 200),
        email_type: 'sales_notification',
        status: 'sent',
        lead_id: lead.id || null,
        lead_source: 'website',
      });
    } catch (e) {
      console.error('Failed to notify sales team:', e.message);
      await base44.asServiceRole.entities.MarketingEmailLog.create({
        recipient_email: salesEmail,
        recipient_name: 'Sales Team',
        subject: `New Lead: ${lead.name || lead.email}`,
        body_preview: '',
        email_type: 'sales_notification',
        status: 'failed',
        error_message: e.message,
        lead_id: lead.id || null,
        lead_source: 'website',
      });
    }

    // 2. Auto-send welcome email to prospect
    try {
      const subject = `Welcome to AcorGreenSync, ${lead.name?.split(' ')[0] || 'there'}!`;
      const body = `Hi ${lead.name || 'there'},\n\nThank you for your interest in AcorGreenSync — the carbon-conscious POS platform built for UK retailers.\n\nOur team will reach out within 24 hours to schedule your personalized demo.\n\nIn the meantime, feel free to explore our pricing plans at https://acorgreensync.com/#pricing\n\nBest regards,\nThe AcorGreenSync Team`;
      await sendEmailWithResend(lead.email, subject, body);
      await base44.asServiceRole.entities.MarketingEmailLog.create({
        recipient_email: lead.email,
        recipient_name: lead.name || null,
        subject,
        body_preview: body.substring(0, 200),
        email_type: 'welcome',
        status: 'sent',
        lead_id: lead.id || null,
        lead_source: 'website',
      });
    } catch (e) {
      console.error('Failed to send welcome email to lead:', e.message);
      await base44.asServiceRole.entities.MarketingEmailLog.create({
        recipient_email: lead.email,
        recipient_name: lead.name || null,
        subject: `Welcome to AcorGreenSync, ${lead.name?.split(' ')[0] || 'there'}!`,
        body_preview: '',
        email_type: 'welcome',
        status: 'failed',
        error_message: e.message,
        lead_id: lead.id || null,
        lead_source: 'website',
      });
    }

    return Response.json({ success: true, leadEmail: lead.email });
  } catch (error) {
    console.error('onLeadCreated error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});