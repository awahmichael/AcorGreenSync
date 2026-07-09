import { useState, useMemo } from 'react';
import { Image as ImageIcon, Leaf } from 'lucide-react';

export default function QuickAccessPanel({ products, onAdd, loading }) {
  const [activeCategory, setActiveCategory] = useState(null);

  const favourites = useMemo(() =>
    products.filter(p => p.is_favourite && p.is_active && (p.stock_quantity || 0) > 0),
    [products]
  );

  const categories = useMemo(() => {
    const cats = [...new Set(favourites.map(p => p.category).filter(Boolean))].sort();
    return cats;
  }, [favourites]);

  const filtered = activeCategory
    ? favourites.filter(p => p.category === activeCategory)
    : favourites;

  if (loading) {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (favourites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No quick access items yet. Mark products as favourites to pin them here.
      </div>
    );
  }

  return (
    <div>
      {/* Category tabs */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            !activeCategory
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Compact tiles */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
        {filtered.map(product => (
          <button
            key={product.id}
            onClick={() => onAdd(product)}
            className="bg-white border border-border rounded-lg p-2 text-left hover:border-primary hover:shadow-sm transition-all active:scale-95 relative"
          >
            {product.image_url ? (
              <div className="w-full h-10 mb-1 rounded overflow-hidden bg-muted">
                <img src={product.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-10 mb-1 rounded bg-gradient-to-br from-green-50 to-muted flex items-center justify-center">
                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground/40" />
              </div>
            )}
            <div className="text-[11px] font-semibold text-foreground line-clamp-1 mb-0.5">{product.name}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">£{product.price?.toFixed(2)}</span>
              <div className="flex items-center gap-0.5 text-[10px] text-primary">
                <Leaf className="w-2.5 h-2.5" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}