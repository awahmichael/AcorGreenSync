import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { organization_id, vrn } = body;

    if (!organization_id || !vrn) {
      return Response.json({ error: 'organization_id and vrn required' }, { status: 400 });
    }

    const clientId = Deno.env.get("HMRC_CLIENT_ID");
    const clientSecret = Deno.env.get("HMRC_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error('[HMRC MTD] Missing HMRC_CLIENT_ID or HMRC_CLIENT_SECRET');
      return Response.json({
        error: 'HMRC MTD platform not configured. The platform administrator needs to set HMRC_CLIENT_ID and HMRC_CLIENT_SECRET secrets.',
        needs_platform_config: true
      }, { status: 503 });
    }

    // Determine environment
    const env = Deno.env.get("HMRC_ENVIRONMENT") || "sandbox";
    const baseUrl = env === "production"
      ? "https://api.service.hmrc.gov.uk"
      : "https://test-api.service.hmrc.gov.uk";

    // Construct redirect URI from request origin
    const url = new URL(req.url);
    const redirectUri = `${url.origin}/hmrc/callback`;

    // State encodes org_id and vrn for CSRF protection
    const state = btoa(JSON.stringify({ organization_id, vrn, t: Date.now() }));

    const authUrl = `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&scope=read:vat%20write:vat&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    console.log('[HMRC MTD] OAuth URL generated for org', organization_id, 'VRN', vrn);

    return Response.json({ auth_url: authUrl, redirect_uri: redirectUri, environment: env });
  } catch (error) {
    console.error('[HMRC MTD] connectHmrcMtd error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});