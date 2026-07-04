import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone, transaction_ref, total_amount, business_name, items, total_kg_co2e, receipt_url, organization_id } = body;

    if (!phone) return Response.json({ error: 'Phone number required' }, { status: 400 });
    if (!organization_id) return Response.json({ error: 'organization_id required' }, { status: 400 });

    // Fetch the tenant's WhatsApp config
    const configs = await base44.asServiceRole.entities.WhatsAppConfig.filter({ organization_id, is_active: true });
    if (!configs || configs.length === 0) {
      return Response.json({ error: 'WhatsApp Business API not configured for this organization. Set up in Settings → WhatsApp.' }, { status: 503 });
    }

    const config = configs[0];
    const phoneNumberId = config.phone_number_id;
    const apiToken = config.api_token;

    // Format phone number (strip non-digits, ensure country code)
    const cleanPhone = phone.replace(/\D/g, '');

    // Build receipt message body
    const itemLines = (items || []).slice(0, 10).map(i =>
      `${i.product_name} x${i.quantity} — £${((i.unit_price || 0) * (i.quantity || 1)).toFixed(2)}`
    ).join('\n');

    const moreItems = items?.length > 10 ? `\n...and ${items.length - 10} more items` : '';

    const messageBody = `🧾 *${config.display_name || business_name || 'AcorCloud'}*\n\nTransaction: ${transaction_ref}\n\n${itemLines}${moreItems}\n\nTotal: £${(total_amount || 0).toFixed(2)}\n🌱 Carbon: ${(total_kg_co2e || 0).toFixed(3)} kg CO₂e${receipt_url ? `\n\nView receipt: ${receipt_url}` : ''}\n\nThank you for shopping sustainably!`;

    // Send via WhatsApp Cloud API using the tenant's credentials
    const waResp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { body: messageBody },
      }),
    });

    const waData = await waResp.json();

    if (!waResp.ok) {
      console.error('[WhatsApp] API error for org', organization_id, ':', JSON.stringify(waData));
      return Response.json({ error: waData?.error?.message || 'WhatsApp send failed' }, { status: 502 });
    }

    console.log('[WhatsApp] Receipt sent to', cleanPhone, 'for org', organization_id, 'message_id:', waData?.messages?.[0]?.id);
    return Response.json({ success: true, message_id: waData?.messages?.[0]?.id });
  } catch (error) {
    console.error('[WhatsApp] Function error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});