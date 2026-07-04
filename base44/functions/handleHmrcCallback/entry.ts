import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { code, state } = body;

    if (!code || !state) {
      return Response.json({ error: 'Authorization code and state required' }, { status: 400 });
    }

    // Decode state to get org_id and vrn
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return Response.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    const { organization_id, vrn } = stateData;
    if (!organization_id || !vrn) {
      return Response.json({ error: 'Invalid state: missing organization_id or vrn' }, { status: 400 });
    }

    const clientId = Deno.env.get("HMRC_CLIENT_ID");
    const clientSecret = Deno.env.get("HMRC_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return Response.json({ error: 'HMRC MTD platform not configured' }, { status: 503 });
    }

    const env = Deno.env.get("HMRC_ENVIRONMENT") || "sandbox";
    const baseUrl = env === "production"
      ? "https://api.service.hmrc.gov.uk"
      : "https://test-api.service.hmrc.gov.uk";

    const url = new URL(req.url);
    const redirectUri = `${url.origin}/hmrc/callback`;

    // Exchange authorization code for access token
    const tokenResp = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResp.json();

    if (!tokenResp.ok) {
      console.error('[HMRC MTD] Token exchange failed:', JSON.stringify(tokenData));
      return Response.json({
        error: tokenData?.error_description || tokenData?.error || 'Token exchange failed'
      }, { status: 502 });
    }

    // Calculate token expiry (HMRC tokens expire in 4 hours / 14400 seconds)
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Check if config already exists for this org
    const existing = await base44.asServiceRole.entities.HmrcMtdConfig.filter({ organization_id });

    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.HmrcMtdConfig.update(existing[0].id, {
        vrn,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        is_connected: true,
        environment: env,
        connected_date: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.HmrcMtdConfig.create({
        organization_id,
        vrn,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        is_connected: true,
        environment: env,
        connected_date: new Date().toISOString(),
      });
    }

    console.log('[HMRC MTD] OAuth successful for org', organization_id, 'VRN', vrn);

    return Response.json({ success: true, vrn, organization_id });
  } catch (error) {
    console.error('[HMRC MTD] handleHmrcCallback error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});