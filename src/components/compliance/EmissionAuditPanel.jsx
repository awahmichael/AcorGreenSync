import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle2, Flag, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';
import { useDebounce } from '@/hooks/useDebounce';
import Pagination from '@/components/products/Pagination';

export default function EmissionAuditPanel() {
  const { organizationId } = useOrganization();
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [unmappedTotal, setUnmappedTotal] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [unmappedRes, allRes] = await Promise.all([
        base44.functions.invoke('searchProducts', {
          organization_id: organizationId,
          filter_status: 'unmapped',
          search: debouncedSearch,
          page: currentPage,
          page_size: pageSize,
        }),
        base44.functions.invoke('searchProducts', {
          organization_id: organizationId,
          filter_status: 'all',
          page: 1,
          page_size: 1,
        }),
      ]);
      setItems(unmappedRes.data.items || []);
      setHasMore(unmappedRes.data.has_more);
      setUnmappedTotal(unmappedRes.data.total);
      setAllTotal(allRes.data.total);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load emission audit data');
    } finally {
      setLoading(false);
    }
  }, [organizationId, debouncedSearch, currentPage, pageSize]);

  useEffect(() => { load(); }, [load]);

  const mappedCount = allTotal - unmappedTotal;
  const completeness = allTotal > 0 ? Math.round((mappedCount / allTotal) * 100) : 0;
  const pendingOnPage = items.filter(p => p.emission_mapping_status === 'Pending');
  const noOrg = !organizationId;

  const bulkFlag = async () => {
    if (pendingOnPage.length === 0) return;
    setFlagging(true);
    await Promise.allSettled(pendingOnPage.map(p => base44.entities.Product.update(p.id, { emission_mapping_status: 'Flagged' })));
    toast.success(`${pendingOnPage.length} products on this page flagged for review`);
    setFlagging(false);
    load();
  };

  const resolve = async (product) => {
    await base44.entities.Product.update(product.id, { emission_mapping_status: 'Flagged' });
    toast.success(`${product.name} flagged for manual review`);
    load();
  };

  if (noOrg) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="font-semibold text-foreground">No Tenant Organization Selected</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You're logged in as a platform admin without a tenant organization. To view cross-tenant emission mapping,
            use <strong>SaaS Admin → Emission Health</strong> tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: allTotal, color: 'text-foreground' },
          { label: 'Mapped', value: mappedCount, color: 'text-green-600' },
          { label: 'Unmapped / Flagged', value: unmappedTotal, color: unmappedTotal > 0 ? 'text-red-600' : 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completeness bar */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Emission Factor Completeness</span>
          <span className={`font-bold ${completeness === 100 ? 'text-green-600' : completeness >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{completeness}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${completeness === 100 ? 'bg-green-500' : completeness >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">100% mapping required for full Scope 3 GHG Protocol compliance</p>
      </div>

      {/* Actions */}
      {unmappedTotal > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 gap-3">
          <span className="text-sm text-amber-800">{pendingOnPage.length} pending product(s) on this page — flag for review?</span>
          <Button size="sm" variant="outline" onClick={bulkFlag} disabled={flagging || pendingOnPage.length === 0} className="border-amber-300 text-amber-700 hover:bg-amber-100">
            {flagging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Flag className="w-3.5 h-3.5 mr-1" />Flag Pending on Page</>}
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search unmapped products by name, SKU, or category..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Products Requiring Attention</h3>
          <span className="text-xs text-muted-foreground">{unmappedTotal.toLocaleString()} total unmapped</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-green-700 text-sm flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            {search ? 'No unmapped products match your search.' : 'All products have emission factors mapped.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">UPC / SKU</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.upc || p.sku || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          p.emission_mapping_status === 'Flagged'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {p.emission_mapping_status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.emission_mapping_status !== 'Flagged' && (
                          <button onClick={() => resolve(p)} className="text-xs text-muted-foreground hover:text-red-600 transition-colors">
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              hasMore={hasMore}
              totalItems={items.length}
              pageSize={pageSize}
              loading={loading}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              pageSizeOptions={[50, 100, 200]}
            />
          </>
        )}
      </div>
    </div>
  );
}