import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check — admin only when called from UI; scheduled runs have no user
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* scheduled automation */ }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 1. FETCH SCOUT CONFIG
    const configs = await base44.asServiceRole.entities.ScoutConfig.list('', 1);
    if (!configs || configs.length === 0) {
      return Response.json({ error: 'ScoutConfig not found. Create a config record first.' }, { status: 404 });
    }
    const config = configs[0];

    // 2. KILL-SWITCH — dormant by default
    if (!config.is_enabled) {
      return Response.json({ message: 'Scout is DORMANT (is_enabled = false). No leads ingested.', ingested: 0 });
    }

    // 3. RESET DAILY COUNTER ON NEW DAY
    const today = new Date().toISOString().split('T')[0];
    if (config.last_ingested_date !== today) {
      await base44.asServiceRole.entities.ScoutConfig.update(config.id, {
        leads_ingested_today: 0,
        last_ingested_date: today
      });
      config.leads_ingested_today = 0;
    }

    // 4. CHECK DAILY QUOTA
    if (config.leads_ingested_today >= config.daily_lead_limit) {
      return Response.json({ message: 'Daily quota reached', ingested: 0, total_today: config.leads_ingested_today });
    }

    // 5. QUERY COMPANIES HOUSE API
    const apiKey = Deno.env.get("COMPANIES_HOUSE_API_KEY");
    if (!apiKey) {
      return Response.json({ error: 'COMPANIES_HOUSE_API_KEY secret not set' }, { status: 500 });
    }

    const cities = config.target_cities || [];
    const sicCodes = config.target_sic_codes || [];
    let totalIngested = 0;
    let totalSkipped = 0;

    for (const city of cities) {
      if (config.leads_ingested_today + totalIngested >= config.daily_lead_limit) break;

      const remaining = config.daily_lead_limit - config.leads_ingested_today - totalIngested;
      const size = Math.min(remaining, 100);

      const params = new URLSearchParams({
        company_status: 'active',
        size: String(size),
        start_index: '0'
      });
      if (city) params.set('location', city);
      if (sicCodes.length > 0) params.set('sic_codes', sicCodes.join(','));

      const apiUrl = `https://api.company-information.service.gov.uk/advanced-search/companies?${params}`;
      const authHeader = 'Basic ' + btoa(apiKey + ':');

      const response = await fetch(apiUrl, {
        headers: { 'Authorization': authHeader }
      });

      if (!response.ok) {
        console.error(`Companies House API error for city ${city}: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const companies = data.items || [];

      for (const company of companies) {
        if (config.leads_ingested_today + totalIngested >= config.daily_lead_limit) break;

        // DEDUPLICATION — check by company_number
        const existing = await base44.asServiceRole.entities.Lead_Scout.filter({
          company_number: company.company_number
        }, '', 1);

        if (existing && existing.length > 0) {
          totalSkipped++;
          continue;
        }

        // CREATE STAGING LEAD
        const address = company.registered_office_address || {};
        const fullAddress = [
          address.address_line_1,
          address.address_line_2,
          address.locality,
          address.postal_code
        ].filter(Boolean).join(', ');

        await base44.asServiceRole.entities.Lead_Scout.create({
          company_name: company.company_name,
          company_number: company.company_number,
          registered_address: fullAddress,
          city: address.locality || city,
          postal_code: address.postal_code || '',
          sic_codes: company.sic_codes || [],
          company_status: company.company_status || 'active',
          incorporation_date: company.date_of_creation || '',
          enrichment_status: 'pending',
          status: 'new',
          source: 'companies_house',
          scout_city: city
        });

        totalIngested++;
      }
    }

    // 6. PERSIST UPDATED COUNTER
    await base44.asServiceRole.entities.ScoutConfig.update(config.id, {
      leads_ingested_today: config.leads_ingested_today + totalIngested,
      last_ingested_date: today
    });

    return Response.json({
      message: 'Scout run complete',
      ingested: totalIngested,
      skipped_duplicates: totalSkipped,
      total_today: config.leads_ingested_today + totalIngested,
      daily_limit: config.daily_lead_limit
    });
  } catch (error) {
    console.error('Scout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});