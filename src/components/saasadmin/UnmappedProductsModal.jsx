import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Leaf, AlertTriangle, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 50;

export default function UnmappedProductsModal({ org, onClose }) {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);

  const load = async (targetPage) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getOrgUnmappedProducts', {
        organization_id: org.org_id,
        page: targetPage,
        page_size: PAGE_SIZE,
      });
      setProducts(res.data.products);
      setTotalCount(res.data.total_count);
      setHasMore(res.data.has_more);
      setPage(targetPage);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [org.org_id]);

  const handleMapUnmapped = async () => {
    setMapping(true);
    try {
      // Fetch all unmapped products for this org
      const allUnmapped = [];
      let p = 1;
      let more = true;
      while (more) {
        const res = await base44.functions.invoke('searchProducts', {
          organization_id: org.org_id,
          filter_status: 'unmapped',
          page: p,
          page_size: 500,
          bypass_cache: true,
        });
        allUnmapped.push(...(res.data.items || []));
        more = res.data.has_more;
        p++;
        if (allUnmapped.length > 10000) break;
      }

      if (allUnmapped.length === 0) {
        toast.info('No unmapped products to process.');
        setMapping(false);
        return;
      }

      const productsPayload = allUnmapped.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category || null,
        upc: item.upc || null,
        commodity_code: item.commodity_code || null,
        unit: item.unit || 'unit',
      }));

      toast.info(`Mapping ${productsPayload.length} product(s) in batches…`);

      const MAP_BATCH_SIZE = 25;
      let totalMapped = 0;
      let totalPending = 0;
      let totalErrors = 0;
      let totalProcessed = 0;

      for (let i = 0; i < productsPayload.length; i += MAP_BATCH_SIZE) {
        const batch = productsPayload.slice(i, i + MAP_BATCH_SIZE);
        const result = await base44.functions.invoke('mapProductEmissions', { products: batch });
        const r = result.data;
        totalMapped += (r.mapped_upc || 0) + (r.mapped_commodity || 0) + (r.mapped_climatiq || 0) + (r.mapped_ai || 0);
        totalPending += r.pending_manual_review || 0;
        totalErrors += r.errors || 0;
        totalProcessed += r.total_processed || 0;
      }

      if (totalMapped > 0) {
        toast.success(`Mapped ${totalMapped} of ${totalProcessed}. ${totalPending} pending, ${totalErrors} errors.`);
      } else if (totalErrors > 0) {
        toast.error(`${totalErrors} product(s) failed. Check function logs.`);
      } else {
        toast.info(`Processed ${totalProcessed} product(s). All remain pending.`);
      }

      load(1);
    } catch (err) {
      console.error('Map unmapped error:', err);
      toast.error(`Mapping failed: ${err.message || 'Unknown error'}`);
    } finally {
      setMapping(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            Unmapped Products — {org.org_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} product(s) require emission factor mapping
          </p>
        </DialogHeader>

        {totalCount > 0 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 gap-3">
            <span className="text-sm text-amber-800">Run the automated 4-tier mapping pipeline for this tenant</span>
            <Button size="sm" onClick={handleMapUnmapped} disabled={mapping} className="bg-primary hover:bg-primary/90">
              {mapping ? <><RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />Mapping…</> : <><Zap className="w-3.5 h-3.5 mr-1" />Map Unmapped Emissions</>}
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-green-700 text-sm flex flex-col items-center gap-2">
              <Leaf className="w-8 h-8 text-green-500" />
              No unmapped products for this tenant.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">SKU / UPC</th>
                  <th className="px-3 py-2 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium text-foreground">{p.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.category}</td>
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{p.sku || p.upc || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge className={p.emission_mapping_status === 'Flagged'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'}>
                        {p.emission_mapping_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {totalCount.toLocaleString()} total
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 1 || loading} onClick={() => load(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={!hasMore || loading} onClick={() => load(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}