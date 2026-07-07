import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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

    // Add search across name, sku, upc, category
    const q = String(search).trim();
    if (q) {
      const regex = { $regex: q, $options: 'i' };
      query.$or = [
        { name: regex },
        { sku: regex },
        { upc: regex },
        { category: regex },
      ];
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