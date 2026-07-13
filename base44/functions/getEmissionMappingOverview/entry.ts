import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * ACORCLOUD GREEN-SYNC: Emission Mapping Overview (SaaS Admin)
 *
 * Aggregates unmapped emission product counts across ALL tenant organizations.
 * Instead of loading every product's full record, we fetch only unmapped ones
 * (Pending + Flagged) and group by organization_id — keeping the payload small
 * even with 100+ tenants.
 *
 * Returns: [{ org_id, org_name, plan_type, unmapped_count, pending_count, flagged_count, top_categories }]
 * Sorted by unmapped_count descending.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    // 1. Fetch all organizations (service role for cross-tenant access)
    const orgs = await base44.asServiceRole.entities.Organization.list('-created_date', 500);
    const orgMap = new Map((orgs || []).map(o => [o.id, o]));

    // 2. Fetch unmapped products (Pending + Flagged) in batches
    //    Only extract fields needed for aggregation to keep memory low.
    const BATCH_SIZE = 500;
    const MAX_PAGES = 40; // cap at ~20k unmapped products to prevent runaway scans

    const aggregateCounts = new Map(); // org_id -> { pending, flagged, categories }

    for (const status of ['Pending', 'Flagged']) {
      let offset = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await base44.asServiceRole.entities.Product.filter(
          { emission_mapping_status: status },
          '-created_date',
          BATCH_SIZE,
          offset
        );

        for (const p of batch) {
          const orgId = p.organization_id || '_unassigned';
          if (!aggregateCounts.has(orgId)) {
            aggregateCounts.set(orgId, { pending: 0, flagged: 0, categories: {} });
          }
          const entry = aggregateCounts.get(orgId);
          if (status === 'Pending') entry.pending++;
          else entry.flagged++;

          const cat = p.category || 'Uncategorized';
          entry.categories[cat] = (entry.categories[cat] || 0) + 1;
        }

        if (batch.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
      }
    }

    // 3. Build the result array
    const results = [];
    for (const [orgId, counts] of aggregateCounts) {
      const org = orgMap.get(orgId);
      const topCategories = Object.entries(counts.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

      results.push({
        org_id: orgId,
        org_name: org?.name || (orgId === '_unassigned' ? 'Unassigned Products' : 'Unknown Organization'),
        plan_type: org?.plan_type || '—',
        subscription_status: org?.subscription_status || '—',
        unmapped_count: counts.pending + counts.flagged,
        pending_count: counts.pending,
        flagged_count: counts.flagged,
        top_categories: topCategories,
      });
    }

    // Sort by unmapped count descending
    results.sort((a, b) => b.unmapped_count - a.unmapped_count);

    // 4. Platform-wide summary
    const summary = {
      total_orgs_with_unmapped: results.length,
      total_unmapped: results.reduce((s, r) => s + r.unmapped_count, 0),
      total_pending: results.reduce((s, r) => s + r.pending_count, 0),
      total_flagged: results.reduce((s, r) => s + r.flagged_count, 0),
      avg_unmapped_per_org: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.unmapped_count, 0) / results.length)
        : 0,
    };

    return Response.json({ summary, organizations: results });
  } catch (error) {
    console.error('[getEmissionMappingOverview] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});