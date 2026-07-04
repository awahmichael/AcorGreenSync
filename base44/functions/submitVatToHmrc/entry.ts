import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { organization_id, period_start, period_end, box1, box2, box3, box4, box5, box6, box7, box8, box9, finalised } = body;

    if (!organization_id) {
      return Response.json({ error: 'organization_id required' }, { status: 400 });
    }

    if (!period_start || !period_end) {
      return Response.json({ error: 'period_start and period_end required (YYYY-MM-DD)' }, { status: 400 });
    }

    // Fetch the tenant's HMRC MTD config
    const configs = await base44.asServiceRole.entities.HmrcMtdConfig.filter({ organization_id });
    if (!configs || configs.length === 0) {
      return Response.json({ error: 'HMRC MTD not connected. Connect in Settings → HMRC MTD first.' }, { status: 403 });
    }

    const config = configs[0];
    if (!config.is_connected) {
      return Response.json({ error: 'HMRC MTD not connected. Reconnect in Settings.' }, { status: 403 });
    }

    const baseUrl = config.environment === 'production'
      ? "https://api.service.hmrc.gov.uk"
      : "https://test-api.service.hmrc.gov.uk";

    let accessToken = config.access_token;
    const tokenExpiresAt = config.token_expires_at ? new Date(config.token_expires_at) : null;
    const now = new Date();

    // Check if token needs refresh (5-minute buffer)
    if (!tokenExpiresAt || tokenExpiresAt.getTime() - now.getTime() < 300000) {
      const clientId = Deno.env.get("HMRC_CLIENT_ID");
      const clientSecret = Deno.env.get("HMRC_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        return Response.json({ error: 'Cannot refresh token: HMRC platform credentials missing' }, { status: 503 });
      }

      console.log('[HMRC MTD] Refreshing access token for org', organization_id);

      const refreshResp = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: config.refresh_token,
        }),
      });

      const refreshData = await refreshResp.json();

      if (!refreshResp.ok) {
        console.error('[HMRC MTD] Token refresh failed:', JSON.stringify(refreshData));
        // Mark as disconnected
        await base44.asServiceRole.entities.HmrcMtdConfig.update(config.id, { is_connected: false });
        return Response.json({ error: 'HMRC token expired and refresh failed. Please reconnect HMRC MTD in Settings.' }, { status: 401 });
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();
      await base44.asServiceRole.entities.HmrcMtdConfig.update(config.id, {
        access_token: accessToken,
        refresh_token: refreshData.refresh_token || config.refresh_token,
        token_expires_at: newExpiresAt,
      });
    }

    // Submit VAT return to HMRC
    const endpoint = `${baseUrl}/organisations/vat/${config.vrn}/returns`;

    const vatReturn = {
      periodKey: `${period_start.replace(/-/g, '')}_${period_end.replace(/-/g, '')}`,
      vatDueSales: Number((box1 || 0).toFixed(2)),
      vatDueAcquisitions: Number((box2 || 0).toFixed(2)),
      totalVatDue: Number((box3 || 0).toFixed(2)),
      vatReclaimedOnInputs: Number((box4 || 0).toFixed(2)),
      netVatToPay: Number((box5 || 0).toFixed(2)),
      totalValueSalesExVAT: Math.round(Number(box6 || 0)),
      totalValuePurchasesExVAT: Math.round(Number(box7 || 0)),
      totalValueGoodsSuppliedExVAT: Math.round(Number(box8 || 0)),
      totalAcquisitionsExVAT: Math.round(Number(box9 || 0)),
      finalised: finalised !== false,
    };

    console.log('[HMRC MTD] Submitting VAT return for VRN', config.vrn, 'period', period_start, 'to', period_end);

    const hmrcResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.hmrc.1.0+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vatReturn),
    });

    const hmrcData = await hmrcResp.json();

    if (!hmrcResp.ok) {
      console.error('[HMRC MTD] API error:', JSON.stringify(hmrcData));
      return Response.json({
        error: hmrcData?.message || 'HMRC submission failed',
        status_code: hmrcResp.status,
        details: hmrcData,
      }, { status: 502 });
    }

    console.log('[HMRC MTD] VAT return accepted for VRN', config.vrn, 'processing date:', hmrcData?.processingDate);

    return Response.json({
      success: true,
      processing_date: hmrcData?.processingDate,
      payment_indicator: hmrcData?.paymentIndicator,
      form_number: hmrcData?.formBundleNumber,
      charge_ref: hmrcData?.chargeRefNumber,
    });
  } catch (error) {
    console.error('[HMRC MTD] submitVatToHmrc error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});