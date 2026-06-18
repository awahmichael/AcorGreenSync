import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, WifiOff, Search, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { toast } from 'sonner';
import CartItem from '@/components/pos/CartItem';
import PaymentModal from '@/components/pos/PaymentModal';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();
  const { addToQueue } = useOfflineQueue();

  useEffect(() => {
    base44.entities.Product.filter({ is_active: true }).then(setProducts).finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        category: product.category,
        quantity: 1,
        unit_price: product.price,
        unit: product.unit || 'unit',
        emission_factor: product.emission_factor_defra || product.emission_factor_climatiq || 0,
        emission_factor_source: product.emission_factor_source || 'Pending',
        kg_co2e: product.emission_factor_defra || product.emission_factor_climatiq || 0,
        scope3_category: product.scope3_category || 'Both',
      }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev
      .map(i => i.product_id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      .filter(i => i.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const cartCO2e = cart.reduce((sum, i) => sum + (i.kg_co2e * i.quantity), 0);
  const upstreamCO2e = cart.filter(i => i.scope3_category !== 'Category_11_Use_of_Sold_Products').reduce((sum, i) => sum + (i.kg_co2e * i.quantity), 0);
  const downstreamCO2e = cart.filter(i => i.scope3_category !== 'Category_1_Purchased_Goods').reduce((sum, i) => sum + (i.kg_co2e * i.quantity), 0);

  const processTransaction = async (paymentMethod) => {
    const txRef = `TXN-${Date.now()}`;
    const transaction = {
      transaction_ref: txRef,
      store_name: 'Main Store',
      cashier_name: 'Cashier',
      items: cart.map(i => ({ ...i, kg_co2e: i.kg_co2e * i.quantity })),
      total_amount: cartTotal,
      total_kg_co2e: cartCO2e,
      upstream_kg_co2e: upstreamCO2e,
      downstream_kg_co2e: downstreamCO2e,
      payment_method: paymentMethod,
      transaction_date: new Date().toISOString(),
      recorded_offline: !isOnline,
      sync_status: isOnline ? 'synced' : 'pending_sync',
    };

    if (isOnline) {
      await base44.entities.Transaction.create(transaction);
      toast.success('Transaction complete!');
    } else {
      addToQueue(transaction);
      toast.success('Saved offline — will sync when connected', { icon: '📶' });
    }

    setCart([]);
    setShowPayment(false);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Product grid */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {!isOnline && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <WifiOff className="w-3.5 h-3.5" />
              Offline
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white border border-border rounded-xl p-4 text-left hover:border-primary hover:shadow-sm transition-all active:scale-95 group"
              >
                <div className="text-sm font-semibold text-foreground line-clamp-2 mb-1">{product.name}</div>
                <div className="text-xs text-muted-foreground mb-2">{product.category}</div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">£{product.price?.toFixed(2)}</span>
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Leaf className="w-3 h-3" />
                    <span>{(product.emission_factor_defra || 0).toFixed(2)}</span>
                  </div>
                </div>
                {product.emission_mapping_status === 'Pending' && (
                  <div className="mt-1 text-xs text-amber-600">⚠ No emission factor</div>
                )}
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No products found. Add products in the Products section.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Cart</h2>
            {cart.length > 0 && (
              <span className="ml-auto bg-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {cart.map(item => (
            <CartItem
              key={item.product_id}
              item={item}
              onIncrease={() => updateQty(item.product_id, 1)}
              onDecrease={() => updateQty(item.product_id, -1)}
              onRemove={() => removeFromCart(item.product_id)}
            />
          ))}
          {cart.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Add products to the cart
            </div>
          )}
        </div>

        {/* Cart summary */}
        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-primary" />
                <span>Carbon footprint</span>
              </div>
              <span className="font-semibold text-primary">{cartCO2e.toFixed(3)} kg CO₂e</span>
            </div>
            <div className="flex items-center justify-between font-bold text-lg">
              <span>Total</span>
              <span>£{cartTotal.toFixed(2)}</span>
            </div>
            <Button onClick={() => setShowPayment(true)} className="w-full bg-primary hover:bg-primary/90">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Process Payment
            </Button>
          </div>
        )}
      </div>

      {showPayment && (
        <PaymentModal
          total={cartTotal}
          co2e={cartCO2e}
          onConfirm={processTransaction}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}