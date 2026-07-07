import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Leaf, AlertCircle, CheckCircle2, Edit2, Trash2, Upload, Package, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';
import ProductModal from '@/components/products/ProductModal';
import VersionHistoryModal from '@/components/products/VersionHistoryModal';
import BulkUploadModal from '@/components/products/BulkUploadModal';
import Pagination from '@/components/products/Pagination';

const STATUS_STYLE = {
  Mapped: 'bg-green-50 text-green-700 border-green-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Flagged: 'bg-red-50 text-red-700 border-red-200',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [filter, setFilter] = useState('all');
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { organizationId } = useOrganization();

  const buildQuery = (searchVal, filterVal) => {
    const query = { is_current_version: true, organization_id: organizationId };
    if (filterVal !== 'all') query.emission_mapping_status = filterVal;
    if (searchVal.trim()) {
      const regex = { $regex: searchVal.trim(), $options: 'i' };
      return { ...query, $or: [{ name: regex }, { category: regex }, { sku: regex }] };
    }
    return query;
  };

  const load = async (page, size, searchVal, filterVal) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const query = buildQuery(searchVal ?? search, filterVal ?? filter);
      const useSize = size ?? pageSize;
      const usePage = page ?? currentPage;
      const skip = (usePage - 1) * useSize;
      const [pageData, countData] = await Promise.all([
        base44.entities.Product.filter(query, '-created_date', useSize, skip),
        base44.entities.Product.filter(query, '-created_date', 5000, 0),
      ]);
      setProducts(pageData);
      setTotalItems(countData.length);
      setCurrentPage(usePage);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (organizationId) load(1, pageSize, '', 'all'); }, [organizationId]);

  const handleSearch = (val) => {
    setSearch(val);
    load(1, pageSize, val, filter);
  };

  const handleFilterChange = (val) => {
    setFilter(val);
    load(1, pageSize, search, val);
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    load(1, size);
  };

  const handlePageChange = (page) => {
    load(page);
  };

  const handleDelete = async (id) => {
    await base44.entities.Product.delete(id);
    toast.success('Product removed');
    load();
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setShowModal(true);
  };

  const openAdd = () => {
    setEditProduct(null);
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage products and emission factor mappings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={openAdd} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {['all', 'Mapped', 'Pending', 'Flagged'].map(f => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filter === f ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:border-primary'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Img</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margin</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">kg CO₂e/unit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ver</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={11} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover inline-block" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center inline-flex">
                        <Package className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-foreground flex items-center gap-1.5">
                      {p.name}
                      {p.is_favourite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                      {p.age_restricted && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-50 text-red-600">18+</span>}
                    </div>
                    {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
                    {p.allergens && p.allergens.length > 0 && (
                      <div className="text-[10px] text-amber-600 mt-0.5">⚠ {p.allergens.join(', ')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-right">£{(p.price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground text-right">£{(p.cost_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.price > 0 ? (
                      <span className={`text-xs font-medium ${p.cost_price > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {p.cost_price > 0 ? `${(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%` : '—'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-sm">
                      <Leaf className="w-3 h-3 text-primary" />
                      <span className="font-medium">
                        {p.emission_factor_defra || p.emission_factor_climatiq 
                          ? (p.emission_factor_defra || p.emission_factor_climatiq).toFixed(4) 
                          : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-muted-foreground">{p.emission_factor_source || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[p.emission_mapping_status] || STATUS_STYLE.Pending}`}>
                      {p.emission_mapping_status === 'Mapped' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                      {p.emission_mapping_status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-mono text-muted-foreground">v{p.version || 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setHistoryProduct(p); setShowVersionHistory(true); }} className="p-1.5 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-primary" title="View version history">
                        <Leaf className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && products.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No products found.</div>
          )}
          </div>
          <Pagination
          currentPage={currentPage}
          totalPages={Math.max(1, Math.ceil(totalItems / pageSize))}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          />
          </div>

      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {showVersionHistory && (
        <VersionHistoryModal
          product={historyProduct}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onSynced={() => load(1)}
        />
      )}
    </div>
  );
}