import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, WifiOff, Search, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useRml } from '@/hooks/useRml';
import { toast } from 'sonner';
import CartItem from '@/components/pos/CartItem';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import ReceiptChoice from '@/components/pos/ReceiptChoice';
import BarcodeInput from '@/components/pos/BarcodeInput';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastScanned, setLastScanned] = useState(null);
  const [receiptTx, setReceiptTx] = useState(null);
  const [showReceiptChoice, setShowReceiptChoice] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const isOnline = useOnlineStatus();
  const { addToQueue } = useOfflineQueue();
  const { processingEngine, syncCoordinator, refreshCache } = useRml();

  useEffect(() => {
    base44.entities.Product.filter({ is_active: true }).then(async (prods) => {
      setProducts(prods);
      // Cache products into RML local IndexedDB for offline checkout
      await refreshCache();
    }).finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.upc || '').includes(search) ||
    (p.sku || '').toLowerCase().includes(search.toLowerCase())
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

  // Barcode scan handler — matches UPC or SKU
  const handleScan = (code) => {
    const match = products.find(p => p.upc === code || p.sku === code);
    if (match) {
      addToCart(match);
      setLastScanned({ found: true, name: match.name, code });
      toast.success(`Added: ${match.name}`, { duration: 1500 });
    } else {
      setLastScanned({ found: false, code });
      toast.error(`No product found for barcode: ${code}`, { duration: 2000 });
    }
  };

  // Global keyboard listener for hardware scanners
  useBarcodeScanner({ onScan: handleScan, enabled: !showPayment });

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
    let transaction;

    try {
      // RML Module 4: ProcessingEngine executes checkout — calculates carbon,
      // validates stock, deducts local inventory, writes atomic ledger to IndexedDB
      transaction = await processingEngine.executeCheckout('main-store', cart, {
        transaction_ref: txRef,
        store_name: 'Main Store',
        cashier_name: 'Cashier',
        payment_method: paymentMethod,
        online: isOnline,
      });

      if (isOnline) {
        // RML Module 5: SyncCoordinator dispatches to Base44 cloud (idempotent)
        await syncCoordinator.dispatchSingle(transaction);

        // Deduct stock on cloud Product entities
        await Promise.allSettled(
          cart.map(item => {
            const product = products.find(p => p.id === item.product_id);
            if (!product) return Promise.resolve();
            const newQty = Math.max(0, (product.stock_quantity || 0) - item.quantity);
            return base44.entities.Product.update(item.product_id, { stock_quantity: newQty });
          })
        );

        // Update local products state to reflect new stock
        setProducts(prev => prev.map(p => {
          const cartItem = cart.find(i => i.product_id === p.id);
          if (!cartItem) return p;
          return { ...p, stock_quantity: Math.max(0, (p.stock_quantity || 0) - cartItem.quantity) };
        }));

        toast.success('Transaction complete!');
      } else {
        // Transaction already written to IndexedDB with PENDING status by ProcessingEngine
        // Also add to the legacy queue for UI sync banner
        await addToQueue(transaction);
        toast.success('Saved offline — will sync when connected', { icon: '📶' });
      }
    } catch (err) {
      toast.error(`Checkout failed: ${err.message}`);
      return;
    }

    setReceiptTx(transaction);
    setCart([]);
    setShowPayment(false);
    setShowReceiptChoice(true);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Product grid */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {/* Scanner + search bar */}
        <div className="space-y-2 mb-4">
          <BarcodeInput
            onScan={handleScan}
            lastScanned={lastScanned}
            onClear={() => setLastScanned(null)}
          />
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, category, SKU..."
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
                <div className="text-xs text-muted-foreground mb-1">{product.category}</div>
                {product.upc && (
                  <div className="text-xs text-muted-foreground font-mono mb-1 truncate">{product.upc}</div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">£{product.price?.toFixed(2)}</span>
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Leaf className="w-3 h-3" />
                    <span>{(product.emission_factor_defra || 0).toFixed(2)}</span>
                  </div>
                </div>
                {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                  <div className="mt-1 text-xs text-amber-600">⚠ Low stock ({product.stock_quantity})</div>
                )}
                {product.stock_quantity === 0 && (
                  <div className="mt-1 text-xs text-red-500">✗ Out of stock</div>
                )}
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
              Scan a barcode or tap a product
            </div>
          )}
        </div>

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

      {showReceiptChoice && receiptTx && (
        <ReceiptChoice
          onPrint={() => { setShowReceiptChoice(false); setShowReceipt(true); }}
          onSkip={() => { setShowReceiptChoice(false); setReceiptTx(null); }}
          onClose={() => { setShowReceiptChoice(false); setReceiptTx(null); }}
        />
      )}

      {showReceipt && receiptTx && (
        <ReceiptModal
          transaction={receiptTx}
          onClose={() => { setShowReceipt(false); setReceiptTx(null); }}
        />
      )}
    </div>
  );
}