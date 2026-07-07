import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    } = body;

    if (!organization_id) {
      return Response.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Build MongoDB query — service-role SDK supports $or + $regex
    const query = {
      is_current_version: true,
      organization_id,
      ...(is_active_only ? { is_active: true } : {}),
      ...(filter_status !== 'all' ? { emission_mapping_status: filter_status } : {}),
    };

    // Smart search strategy: short/numeric queries (barcodes, SKU prefixes) are
    // extremely expensive as unanchored regexes — they match nearly every record.
    // For short queries, anchor to ^ and only search identifier fields (sku, upc)
    // which is the realistic use case (barcode scan / SKU lookup). For longer
    // queries, search all text fields with a contains-match.
    const q = String(search).trim();
    if (q) {
      if (q.length <= 3) {
        // Short query — anchored prefix match on identifier fields only
        const anchored = { $regex: `^${q}`, $options: 'i' };
        query.$or = [
          { sku: anchored },
          { upc: anchored },
          { name: anchored },
        ];
      } else {
        // Longer query — contains match across all text fields
        const regex = { $regex: q, $options: 'i' };
        query.$or = [
          { name: regex },
          { sku: regex },
          { upc: regex },
          { category: regex },
        ];
      }
    }

    const skip = (page - 1) * page_size;
    // Fetch one extra to determine has_more
    const items = await base44.asServiceRole.entities.Product.filter(
      query,
      '-created_date',
      page_size + 1,
      skip
    );

    const has_more = items.length > page_size;

    return Response.json({
      items: items.slice(0, page_size),
      has_more,
    });
  } catch (error) {
    console.error('searchProducts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});