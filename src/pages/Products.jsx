import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Leaf, AlertCircle, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ProductModal from '@/components/products/ProductModal';

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
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    base44.entities.Product.list().then(setProducts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || p.emission_mapping_status === filter;
    return matchSearch && matchFilter;
  });

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

  const pendingCount = products.filter(p => p.emission_mapping_status !== 'Mapped').length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage products and emission factor mappings</p>
        </div>
        <Button onClick={openAdd} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800">
            <strong>{pendingCount} product{pendingCount !== 1 ? 's' : ''}</strong> need emission factor mapping for accurate Scope 3 reporting.
          </span>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {['all', 'Mapped', 'Pending', 'Flagged'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">kg CO₂e/unit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-foreground">{p.name}</div>
                    {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-right">£{(p.price || 0).toFixed(2)}</td>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
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
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No products found.</div>
          )}
        </div>
      </div>

      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}