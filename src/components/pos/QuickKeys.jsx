import { Star } from 'lucide-react';

export default function QuickKeys({ products, onAdd }) {
  const favourites = products.filter(p => p.is_favourite && p.is_active && (p.stock_quantity || 0) > 0);

  if (favourites.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Star className="w-3.5 h-3.5 text-amber-500" />
        Quick Keys
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {favourites.map(product => (
          <button
            key={product.id}
            onClick={() => onAdd(product)}
            className="flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl bg-gradient-to-b from-amber-50 to-white border border-amber-200 hover:border-primary hover:shadow-sm transition-all active:scale-95 min-w-[72px]"
          >
            {product.image_url ? (
              <img src={product.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-500" />
              </div>
            )}
            <span className="text-xs font-medium text-foreground truncate max-w-[64px]">{product.name}</span>
            <span className="text-xs font-bold text-primary">£{product.price?.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}