import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { organization_id, dry_run } = await req.json();

    if (!organization_id) {
      return Response.json({ error: 'organization_id is required' }, { status: 400 });
    }

    console.log(`[clearProductCatalog] org=${organization_id} dry_run=${!!dry_run} user=${user.id}`);

    // 1. Fetch all current-version products for this org (paginated, up to 10k)
    const allProducts = [];
    let skip = 0;
    const batchSize = 500;
    let hasMore = true;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Product.filter(
        { organization_id, is_current_version: true },
        '-created_date',
        batchSize,
        skip
      );
      allProducts.push(...batch);
      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        skip += batchSize;
      }
    }

    console.log(`[clearProductCatalog] Found ${allProducts.length} products for org`);

    // 2. Fetch all transactions for this org and extract sold product IDs
    const allTransactions = [];
    skip = 0;
    hasMore = true;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Transaction.filter(
        { organization_id },
        '-created_date',
        batchSize,
        skip
      );
      allTransactions.push(...batch);
      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        skip += batchSize;
      }
    }

    console.log(`[clearProductCatalog] Found ${allTransactions.length} transactions for org`);

    // Build a Set of product_ids that have appeared in at least one transaction
    const soldProductIds = new Set();
    for (const txn of allTransactions) {
      if (!txn.items) continue;
      for (const item of txn.items) {
        if (item.product_id) soldProductIds.add(item.product_id);
        if (item.base_product_id) soldProductIds.add(item.base_product_id);
      }
    }

    console.log(`[clearProductCatalog] ${soldProductIds.size} unique products have been sold`);

    // 3. Partition products into deletable vs protected
    const deletable = [];
    const protectedProducts = [];
    for (const product of allProducts) {
      if (soldProductIds.has(product.id) || soldProductIds.has(product.base_product_id)) {
        protectedProducts.push({
          id: product.id,
          name: product.name,
          reason: 'Has transaction history',
        });
      } else {
        deletable.push(product.id);
      }
    }

    console.log(`[clearProductCatalog] deletable=${deletable.length} protected=${protectedProducts.length}`);

    // 4. If dry_run, return preview without deleting
    if (dry_run) {
      return Response.json({
        status: 'success',
        dry_run: true,
        total_products: allProducts.length,
        deletable_count: deletable.length,
        protected_count: protectedProducts.length,
        protected_preview: protectedProducts.slice(0, 20),
      });
    }

    // 5. Delete in batches (deleteMany with specific IDs)
    let deletedCount = 0;
    for (let i = 0; i < deletable.length; i += batchSize) {
      const idsBatch = deletable.slice(i, i + batchSize);
      await base44.asServiceRole.entities.Product.deleteMany({
        _id: { $in: idsBatch },
      });
      deletedCount += idsBatch.length;
      console.log(`[clearProductCatalog] Deleted batch: +${idsBatch.length} (total: ${deletedCount})`);
    }

    return Response.json({
      status: 'success',
      total_products: allProducts.length,
      deleted_count: deletedCount,
      protected_count: protectedProducts.length,
      protected_preview: protectedProducts.slice(0, 20),
    });
  } catch (error) {
    console.error('[clearProductCatalog] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});