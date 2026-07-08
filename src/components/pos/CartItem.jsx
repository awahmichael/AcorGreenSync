import { Plus, Minus, Trash2, Leaf, ShieldAlert, Scale } from 'lucide-react';

export default function CartItem({ item, onIncrease, onDecrease, onRemove }) {
  const isWeighted = item.is_weighted_item;
  const displayQty = isWeighted
    ? Number(item.quantity).toFixed(3)
    : item.quantity;

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate flex items-center gap-1">
          {item.product_name}
          {isWeighted && <Scale className="w-3 h-3 text-blue-500 shrink-0" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {item.category}
          {isWeighted && item.sell_unit && <span> · per {item.sell_unit}</span>}
        </div>
        {item.age_restricted && (
          <div className="flex items-center gap-1 mt-0.5 text-xs text-red-600 font-medium">
            <ShieldAlert className="w-3 h-3" /> 18+ {item.age_restriction_type}
          </div>
        )}
        <div className="flex items-center gap-1 mt-0.5 text-xs text-primary">
          <Leaf className="w-3 h-3" />
          <span>{(item.kg_co2e * item.quantity).toFixed(3)} kg CO₂e</span>
          {item.emission_factor_source === 'Pending' && (
            <span className="text-amber-500 ml-1">⚠</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-sm font-bold text-foreground">£{(item.unit_price * item.quantity).toFixed(2)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onDecrease}
            className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-semibold text-center min-w-[2.5rem]">{displayQty}{isWeighted ? ` ${item.sell_unit || ''}` : ''}</span>
          <button
            onClick={onIncrease}
            className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-muted"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center ml-1"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}