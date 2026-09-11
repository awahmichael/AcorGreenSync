import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Simple in-memory cache — survives across warm invocations (cached search path only)
// Key: org_id, Value: { products: [], fetched_at: number }
const cache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

// Status values that can be served by the fast server-side paging path
// (they map to indexed DB equality filters on emission_mapping_status).
// 'unmapped' (a negation) is NOT here — it falls back to the cached path.
const FAST_STATUSES = new Set(['all', 'Mapped', 'Pending', 'Flagged']);

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

    const q = String(search).toLowerCase().trim();
    const skip = (page - 1) * page_size;

    // ── FAST PATH: no text search + equality-filterable status ──
    // A single indexed Product.filter() call — instant even for 10k+ catalogs,
    // replacing the old bulk-load-all-then-slice approach that hung the page.
    if (!q && FAST_STATUSES.has(filter_status)) {
      const dbFilter = { is_current_version: true, organization_id };
      if (is_active_only) dbFilter.is_active = true;
      if (filter_status !== 'all') dbFilter.emission_mapping_status = filter_status;

      // Fetch one extra record to detect has_more without a second count query
      const batch = await base44.asServiceRole.entities.Product.filter(
        dbFilter,
        '-created_date',
        page_size + 1,
        skip
      );
      const has_more = batch.length > page_size;
      const items = has_more ? batch.slice(0, page_size) : batch;
      const total = has_more ? skip + page_size + 1 : skip + items.length;

      return Response.json({ items, has_more, total });
    }

    // ── CACHED SEARCH PATH: text search or non-equality status ('unmapped') ──
    // Loads the full org catalog (paginated in batches) once, caches it for 60s,
    // then filters in JavaScript (DB regex text search caused full collection
    // scans + timeouts, so text search must stay client-side).
    let orgProducts = null;
    const cached = cache.get(organization_id);
    if (!bypass_cache && cached && (Date.now() - cached.fetched_at) < CACHE_TTL_MS) {
      orgProducts = cached.products;
    } else {
      orgProducts = [];
      const batchSize = 500;
      let s = 0;
      let more = true;
      while (more) {
        const batch = await base44.asServiceRole.entities.Product.filter(
          { is_current_version: true, organization_id },
          '-created_date',
          batchSize,
          s
        );
        orgProducts.push(...batch);
        s += batchSize;
        if (batch.length < batchSize) more = false;
        // Safety cap to prevent runaway queries
        if (orgProducts.length > 50000) break;
      }
      cache.set(organization_id, { products: orgProducts, fetched_at: Date.now() });
    }

    // --- Filter in JavaScript (instant, no DB regex) ---
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
    const items = results.slice(skip, skip + page_size);
    const has_more = skip + page_size < totalItems;

    return Response.json({ items, has_more, total: totalItems });
  } catch (error) {
    console.error('searchProducts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});