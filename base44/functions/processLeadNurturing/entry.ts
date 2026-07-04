import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const leads = await base44.asServiceRole.entities.Lead.filter({});
    let nurtured = 0;

    for (const lead of leads) {
      // Skip leads that are already converted or lost
      if (['converted', 'lost'].includes(lead.status)) continue;

      const createdDate = new Date(lead.created_date);
      const daysSinceCreated = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      // Day 1 follow-up (if still "new" after 1 day)
      if (lead.status === 'new' && daysSinceCreated >= 1 && daysSinceCreated < 3) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: lead.email,
            subject: `Quick question, ${lead.name?.split(' ')[0] || 'there'}?`,
            body: `Hi ${lead.name || 'there'},\n\nI noticed you requested a demo of AcorGreenSync but we haven't connected yet.\n\nWould you have 15 minutes this week for a quick walkthrough? You can also reply directly to this email.\n\nBest,\nThe AcorGreenSync Team`,
          });
          await base44.asServiceRole.entities.Lead.update(lead.id, { status: 'contacted' });
          nurtured++;
        } catch (e) {
          console.error(`Nurture day-1 failed for ${lead.email}:`, e.message);
        }
      }

      // Day 4 case study follow-up (if "contacted" and 4+ days old)
      else if (lead.status === 'contacted' && daysSinceCreated >= 4 && daysSinceCreated < 7) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: lead.email,
            subject: `How a UK retailer cut compliance time by 80%`,
            body: `Hi ${lead.name || 'there'},\n\nI wanted to share a quick case study of how a UK retailer used AcorGreenSync to automate their SECR carbon reporting while streamlining their POS operations.\n\nKey results:\n• 80% reduction in compliance preparation time\n• Full DEFRA emission factor mapping in under 2 hours\n• Real-time carbon tracking at checkout\n\nWould you like to see how this could work for your stores? Book a demo: https://acorgreensync.com/#lead-form\n\nBest,\nThe AcorGreenSync Team`,
          });
          nurtured++;
        } catch (e) {
          console.error(`Nurture day-4 failed for ${lead.email}:`, e.message);
        }
      }

      // Day 10 — final attempt + escalate to sales for manual outreach
      else if (lead.status === 'contacted' && daysSinceCreated >= 10) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: lead.email,
            subject: `Last check-in from AcorGreenSync`,
            body: `Hi ${lead.name || 'there'},\n\nThis will be my last email for now. If the timing isn't right, no worries — you can always reach out when you're ready.\n\nIf you have any questions about carbon compliance, POS systems, or retail sustainability, I'm always happy to chat.\n\nVisit us anytime: https://acorgreensync.com\n\nBest,\nThe AcorGreenSync Team`,
          });
          await base44.asServiceRole.entities.Lead.update(lead.id, { status: 'lost' });

          // Escalate to sales team
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: 'sales@acorgreensync.com',
            subject: `Cold Lead Escalation: ${lead.name || lead.email}`,
            body: `A lead has gone cold after 10 days without conversion.\n\nName: ${lead.name || 'N/A'}\nEmail: ${lead.email}\nCompany: ${lead.company || 'N/A'}\nStore Count: ${lead.store_count || 1}\n\nConsider a personal phone call if the store count warrants it.`,
          });
          nurtured++;
        } catch (e) {
          console.error(`Nurture day-10 failed for ${lead.email}:`, e.message);
        }
      }
    }

    return Response.json({ nurtured, totalLeads: leads.length });
  } catch (error) {
    console.error('processLeadNurturing error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});