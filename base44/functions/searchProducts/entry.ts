import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Simple in-memory cache — survives across warm invocations
// Key: org_id, Value: { products: [], fetched_at: number }
const cache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      organization_id,
      search = '',
      filter_status = 'all',
      page = 1,
      page_size = 100,
      is_active_only = false,
      bypass_cache = false,
    } = body;

    if (!organization_id) {
      return Response.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // --- Fetch all current-version products for this org (equality filters only = index-backed) ---
    let orgProducts = null;
    const cached = cache.get(organization_id);
    if (!bypass_cache && cached && (Date.now() - cached.fetched_at) < CACHE_TTL_MS) {
      orgProducts = cached.products;
    } else {
      orgProducts = [];
      const batchSize = 500;
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.asServiceRole.entities.Product.filter(
          { is_current_version: true, organization_id },
          '-created_date',
          batchSize,
          skip
        );
        orgProducts.push(...batch);
        skip += batchSize;
        if (batch.length < batchSize) hasMore = false;
        // Safety cap to prevent runaway queries
        if (orgProducts.length > 50000) break;
      }
      cache.set(organization_id, { products: orgProducts, fetched_at: Date.now() });
    }

    // --- Filter in JavaScript (instant, no DB regex) ---
    const q = String(search).toLowerCase().trim();
    let results = orgProducts;

    if (is_active_only) {
      results = results.filter(p => p.is_active !== false);
    }

    if (filter_status === 'unmapped') {
      results = results.filter(p => p.emission_mapping_status !== 'Mapped');
    } else if (filter_status !== 'all') {
      results = results.filter(p => p.emission_mapping_status === filter_status);
    }

    if (q) {
      results = results.filter(p =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.sku || '').toLowerCase().includes(q) ||
        String(p.upc || '').toLowerCase().includes(q) ||
        String(p.category || '').toLowerCase().includes(q)
      );
    }

    // --- Paginate ---
    const totalItems = results.length;
    const skip = (page - 1) * page_size;
    const items = results.slice(skip, skip + page_size);
    const has_more = skip + page_size < totalItems;

    return Response.json({ items, has_more, total: totalItems });
  } catch (error) {
    console.error('searchProducts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});