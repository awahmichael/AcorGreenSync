import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * ACORCLOUD GREEN-SYNC: Org Unmapped Products Drill-down (SaaS Admin)
 *
 * Returns paginated unmapped products for a specific organization.
 * Fetches Pending + Flagged products separately (indexed filter) and merges,
 * so we never load a tenant's entire catalog just to show their unmapped items.
 *
 * Input: { organization_id, page (default 1), page_size (default 50) }
 * Returns: { products: [...], total_count, page, page_size, has_more }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json();
    const { organization_id, page = 1, page_size = 50 } = body;
    if (!organization_id) return Response.json({ error: 'organization_id is required' }, { status: 400 });

    // 1. Fetch all unmapped products for this org (Pending + Flagged)
    //    Single org — cap at 500 per status which covers most tenants.
    const [pending, flagged] = await Promise.all([
      base44.asServiceRole.entities.Product.filter(
        { organization_id, emission_mapping_status: 'Pending' },
        '-created_date',
        500,
        0
      ),
      base44.asServiceRole.entities.Product.filter(
        { organization_id, emission_mapping_status: 'Flagged' },
        '-created_date',
        500,
        0
      ),
    ]);

    // 2. Merge and sort
    const allUnmapped = [...pending, ...flagged].sort(
      (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
    );

    // 3. Paginate
    const startIdx = (page - 1) * page_size;
    const paged = allUnmapped.slice(startIdx, startIdx + page_size);
    const total_count = allUnmapped.length;
    const has_more = startIdx + page_size < total_count;

    // 4. Return only the fields the admin UI needs
    const products = paged.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category || '—',
      sku: p.sku || '',
      upc: p.upc || '',
      emission_mapping_status: p.emission_mapping_status,
      emission_factor_source: p.emission_factor_source || 'Pending',
      created_date: p.created_date,
    }));

    return Response.json({
      products,
      total_count,
      page,
      page_size,
      has_more,
      truncated: pending.length === 500 || flagged.length === 500,
    });
  } catch (error) {
    console.error('[getOrgUnmappedProducts] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});