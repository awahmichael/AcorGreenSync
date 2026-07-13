import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Leaf, AlertTriangle } from 'lucide-react';

const PAGE_SIZE = 50;

export default function UnmappedProductsModal({ org, onClose }) {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

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