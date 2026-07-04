import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { period_start, period_end, box1, box2, box3, box4, box5, box6, box7, box8, box9, finalised } = body;

    if (!period_start || !period_end) {
      return Response.json({ error: 'period_start and period_end required (YYYY-MM-DD)' }, { status: 400 });
    }

    const accessToken = Deno.env.get("HMRC_ACCESS_TOKEN");
    const vrn = Deno.env.get("HMRC_VRN");

    if (!accessToken || !vrn) {
      console.error('[HMRC MTD] Missing HMRC_ACCESS_TOKEN or HMRC_VRN');
      return Response.json({ error: 'HMRC MTD not configured. Set HMRC_ACCESS_TOKEN and HMRC_VRN secrets.' }, { status: 503 });
    }

    // HMRC MTD VAT API endpoint
    // Sandbox: https://test-api.service.hmrc.gov.uk
    // Production: https://api.service.hmrc.gov.uk
    const baseUrl = 'https://api.service.hmrc.gov.uk';
    const endpoint = `${baseUrl}/organisations/vat/${vrn}/returns`;

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

    console.log('[HMRC MTD] Submitting VAT return for VRN', vrn, 'period', period_start, 'to', period_end);

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

    console.log('[HMRC MTD] VAT return accepted, processing date:', hmrcData?.processingDate);
    return Response.json({
      success: true,
      processing_date: hmrcData?.processingDate,
      payment_indicator: hmrcData?.paymentIndicator,
      form_number: hmrcData?.formBundleNumber,
      charge_ref: hmrcData?.chargeRefNumber,
    });
  } catch (error) {
    console.error('[HMRC MTD] Function error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});