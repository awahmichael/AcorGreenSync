import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, WifiOff, Search, Leaf, X, User, Tag, PoundSterling, Clock, Pause, Star, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useRml } from '@/hooks/useRml';
import { useOrganization } from '@/hooks/useOrganization.jsx';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import CartItem from '@/components/pos/CartItem';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import DigitalReceiptChoice from '@/components/pos/DigitalReceiptChoice';
import QuickKeys from '@/components/pos/QuickKeys';
import ParkedTransactions from '@/components/pos/ParkedTransactions';
import ZReport from '@/components/pos/ZReport';
import { getPrintSettings } from '@/lib/printSettings';

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
  const [customers, setCustomers] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [parkedTxns, setParkedTxns] = useState([]);
  const isOnline = useOnlineStatus();
  const { addToQueue } = useOfflineQueue();
  const { processingEngine, syncCoordinator, refreshCache } = useRml();
  const { organizationId, currentOrg } = useOrganization();
  const { user } = useAuth();

  const cashierName = user?.full_name || user?.email || 'Cashier';
  const cashierId = user?.id || '';

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    base44.entities.Product.filter({ is_active: true, organization_id: organizationId }).then(async (prods) => {
      setProducts(prods);
      await refreshCache();
    }).finally(() => setLoading(false));
    base44.entities.Customer.list().then(setCustomers).catch(() => {});
    base44.entities.Promotion.filter({ is_active: true }).then(setPromotions).catch(() => {});
  }, [organizationId]);

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
        unit_cost: product.cost_price || 0,
        unit: product.unit || 'unit',
        emission_factor: product.emission_factor_defra || product.emission_factor_climatiq || 0,
        emission_factor_source: product.emission_factor_source || 'Pending',
        kg_co2e: product.emission_factor_defra || product.emission_factor_climatiq || 0,
        scope3_category: product.scope3_category || 'Both',
        age_restricted: product.age_restricted || false,
        age_restriction_type: product.age_restriction_type || 'none',
        min_age: product.min_age || 0,
        allergens: product.allergens || [],
        _productData: product,
      }];
    });
  };

  // Barcode scan handler
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

  // Age restriction check
  const hasAgeRestricted = cart.some(i => i.age_restricted);
  const ageRestrictionType = hasAgeRestricted
    ? cart.filter(i => i.age_restricted).map(i => i.age_restriction_type).filter(Boolean)[0]
    : null;

  // Auto-apply eligible promotions
  const eligiblePromos = promotions.filter(p => {
    if (!p.is_active) return false;
    const today = new Date().toISOString().split('T')[0];
    if (p.start_date && today < p.start_date) return false;
    if (p.end_date && today > p.end_date) return false;
    if (p.min_spend && cartTotal < p.min_spend) return false;
    if (p.product_id && !cart.some(i => i.product_id === p.product_id)) return false;
    if (p.category_filter && !p.product_id && !cart.some(i => i.category === p.category_filter)) return false;
    return ['percentage', 'fixed', 'multibuy'].includes(p.type);
  });

  const autoDiscount = eligiblePromos.reduce((sum, p) => {
    const baseAmount = p.product_id
      ? cart.filter(i => i.product_id === p.product_id).reduce((s, i) => s + i.unit_price * i.quantity, 0)
      : cartTotal;
    if (p.type === 'percentage') return sum + (baseAmount * p.value / 100);
    if (p.type === 'fixed') return sum + Math.min(p.value, baseAmount);
    if (p.type === 'multibuy' && cartTotal >= p.value) return sum + (cartTotal * 0.05);
    return sum;
  }, 0);

  const promoDiscount = appliedPromo ? (appliedPromo.type === 'percentage' ? cartTotal * appliedPromo.value / 100 : Math.min(appliedPromo.value, cartTotal)) : 0;
  const totalDiscount = autoDiscount + promoDiscount;
  const finalTotal = Math.max(0, cartTotal - totalDiscount);

  const applyPromoCode = () => {
    const match = promotions.find(p => p.promo_code && p.promo_code.toUpperCase() === promoCode.trim().toUpperCase() && p.is_active);
    if (match) {
      setAppliedPromo(match);
      toast.success(`Promo code applied: ${match.name}`);
    } else {
      toast.error('Invalid or expired promo code');
    }
  };

  const customerResults = customerSearch.trim().length >= 2
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.includes(customerSearch)
      ).slice(0, 5)
    : [];

  // Park current transaction
  const parkTransaction = () => {
    if (cart.length === 0) return;
    setParkedTxns(prev => [...prev, { items: cart, total: finalTotal, reason: 'Parked by cashier' }]);
    setCart([]);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setAppliedPromo(null);
    setPromoCode('');
    toast.success('Transaction parked — resume anytime');
  };

  const resumeTransaction = (idx) => {
    const parked = parkedTxns[idx];
    setCart(parked.items);
    setParkedTxns(prev => prev.filter((_, i) => i !== idx));
    toast.success('Transaction resumed');
  };

  const deleteParked = (idx) => {
    setParkedTxns(prev => prev.filter((_, i) => i !== idx));
    toast.success('Parked transaction discarded');
  };

  const processTransaction = async (paymentDetails) => {
    const txRef = `TXN-${Date.now()}`;
    const paymentMethod = paymentDetails.method === 'split' ? 'card' : paymentDetails.method;
    const tipAmount = paymentDetails.tipAmount || 0;
    const carbonOffset = paymentDetails.carbonOffset || 0;
    const ageVerified = paymentDetails.ageVerified || false;
    const splitPayments = paymentDetails.method === 'split' ? paymentDetails.splitPayments : [];

    const grandTotal = finalTotal + tipAmount + carbonOffset;
    let transaction;

    try {
      // RML ProcessingEngine executes checkout
      transaction = await processingEngine.executeCheckout('main-store', cart, {
        transaction_ref: txRef,
        organization_id: organizationId,
        store_name: currentOrg?.name || 'Main Store',
        cashier_id: cashierId,
        cashier_name: cashierName,
        payment_method: paymentMethod,
        online: isOnline,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name,
        discount_amount: totalDiscount,
        applied_promotions: [...eligiblePromos.map(p => p.name), appliedPromo?.name].filter(Boolean),
        final_total: grandTotal,
        tip_amount: tipAmount,
        carbon_offset_amount: carbonOffset,
        age_verified: ageVerified,
        age_verified_by: ageVerified ? cashierName : null,
        split_payments: splitPayments,
      });

      // --- PROCESS CARD PAYMENT VIA GATEWAY ---
      if (isOnline && (paymentMethod === 'card' || paymentMethod === 'contactless' || splitPayments.some(sp => sp.method === 'card' || sp.method === 'contactless'))) {
        try {
          // Find active terminal for this store
          const terminals = await base44.entities.PaymentTerminal.filter({ is_active: true, is_paired: true, status: 'online' });
          if (terminals.length > 0) {
            const terminal = terminals[0];
            const paymentResp = await base44.functions.invoke('processPayment', {
              terminal_id: terminal.terminal_id,
              amount: grandTotal,
              currency: 'GBP',
              transaction_ref: txRef,
              store_id: terminal.store_id,
            });

            if (paymentResp.data?.success) {
              // Update transaction with gateway details
              transaction.gateway_transaction_id = paymentResp.data.gateway_transaction_id;
              transaction.gateway_provider = paymentResp.data.provider;
              transaction.payment_status = paymentResp.data.status === 'completed' ? 'completed' : 'pending_terminal';
              transaction.client_secret = paymentResp.data.client_secret;
              toast.success(`Card payment ${paymentResp.data.status === 'completed' ? 'approved' : 'pending — awaiting terminal'}`);
            } else if (paymentResp.data?.error) {
              console.warn('[POS] Payment gateway error:', paymentResp.data.error);
              transaction.payment_status = 'pending_terminal';
              toast.warning(`Payment gateway: ${paymentResp.data.error}. Transaction saved — process payment manually.`);
            }
          } else {
            transaction.payment_status = 'pending_terminal';
            toast.warning('No paired terminal found — payment recorded as pending. Complete on terminal manually.');
          }
        } catch (gatewayErr) {
          console.error('[POS] Gateway payment failed:', gatewayErr);
          transaction.payment_status = 'pending_terminal';
          toast.warning('Card payment could not reach gateway — transaction saved, process payment on terminal manually.');
        }
      }

      if (isOnline) {
        // Sync to cloud
        await syncCoordinator.dispatchSingle(transaction);

        // Deduct stock on cloud Product entities + create StockMovement records
        await Promise.allSettled(
          cart.map(async (item) => {
            const product = products.find(p => p.id === item.product_id);
            if (!product) return;
            const newQty = Math.max(0, (product.stock_quantity || 0) - item.quantity);

            // Create StockMovement audit record
            await base44.entities.StockMovement.create({
              product_id: item.product_id,
              product_name: item.product_name,
              store_id: product.store_id || '',
              store_name: currentOrg?.name || 'Main Store',
              movement_type: 'sale_out',
              quantity: item.quantity,
              unit: product.unit || 'unit',
              reference: txRef,
              notes: `POS sale — ${txRef}`,
              organization_id: organizationId,
              movement_date: new Date().toISOString(),
            }).catch(() => {});

            // Update product stock
            return base44.entities.Product.update(item.product_id, { stock_quantity: newQty });
          })
        );

        // --- UPDATE CUSTOMER LOYALTY & STATS ---
        if (selectedCustomer) {
          const pointsEarned = Math.floor(grandTotal); // 1 point per £1
          const newLoyaltyPoints = (selectedCustomer.loyalty_points || 0) + pointsEarned;
          const newTotalSpend = (selectedCustomer.total_spend || 0) + grandTotal;
          const newTotalCO2e = (selectedCustomer.total_kg_co2e || 0) + cartCO2e;
          const newTxnCount = (selectedCustomer.transaction_count || 0) + 1;

          // Tier upgrade logic
          let newTier = selectedCustomer.tier || 'Bronze';
          if (newTotalSpend >= 5000) newTier = 'Platinum';
          else if (newTotalSpend >= 2000) newTier = 'Gold';
          else if (newTotalSpend >= 500) newTier = 'Silver';

          await base44.entities.Customer.update(selectedCustomer.id, {
            loyalty_points: newLoyaltyPoints,
            total_spend: newTotalSpend,
            total_kg_co2e: newTotalCO2e,
            transaction_count: newTxnCount,
            tier: newTier,
          }).catch(() => {});

          if (newTier !== selectedCustomer.tier) {
            toast.success(`🎉 Customer upgraded to ${newTier} tier!`);
          }
        }

        // Update local products state to reflect new stock
        setProducts(prev => prev.map(p => {
          const cartItem = cart.find(i => i.product_id === p.id);
          if (!cartItem) return p;
          return { ...p, stock_quantity: Math.max(0, (p.stock_quantity || 0) - cartItem.quantity) };
        }));

        // Check for low stock / reorder alerts
        const lowStockProducts = cart.filter(item => {
          const product = products.find(p => p.id === item.product_id);
          if (!product) return false;
          const newQty = (product.stock_quantity || 0) - item.quantity;
          return newQty <= (product.reorder_point || 5);
        });
        if (lowStockProducts.length > 0) {
          const names = lowStockProducts.map(i => i.product_name).join(', ');
          toast.warning(`⚠ Low stock — reorder needed: ${names}`, { duration: 5000 });
        }

        toast.success('Transaction complete!');
      } else {
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
    const printMode = getPrintSettings().receipt_mode;
    if (printMode === 'always_print') {
      setShowReceipt(true);
    } else {
      setShowReceiptChoice(true);
    }
    setSelectedCustomer(null);
    setCustomerSearch('');
    setAppliedPromo(null);
    setPromoCode('');
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Product grid */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {/* Top bar with park + Z-report */}
        <div className="flex items-center gap-2 mb-3">
          {cart.length > 0 && (
            <Button variant="outline" size="sm" onClick={parkTransaction}>
              <Pause className="w-3.5 h-3.5 mr-1.5" /> Park
            </Button>
          )}
          <ParkedTransactions
            parkedTxns={parkedTxns}
            onResume={resumeTransaction}
            onDelete={deleteParked}
          />
          <div className="flex-1" />
          <ZReport />
        </div>

        {/* Quick Keys */}
        <QuickKeys products={products} onAdd={addToCart} />

        {/* Unified search + barcode scan field */}
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, category, or scan/type barcode & press Enter..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim().length >= 6) {
                    handleScan(search.trim());
                  }
                }}
                className="pl-9"
              />
            </div>
            {lastScanned && (
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap ${lastScanned.found ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {lastScanned.found ? `✓ ${lastScanned.name}` : `✗ Not found: ${lastScanned.code}`}
                <button onClick={() => setLastScanned(null)} className="ml-1 opacity-60 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
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
                className="bg-white border border-border rounded-xl p-3 text-left hover:border-primary hover:shadow-sm transition-all active:scale-95 group relative"
              >
                {/* Product image */}
                {product.image_url ? (
                  <div className="w-full h-16 mb-2 rounded-lg overflow-hidden bg-muted">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-16 mb-2 rounded-lg bg-gradient-to-br from-green-50 to-muted flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="text-sm font-semibold text-foreground line-clamp-2 mb-1">{product.name}</div>
                <div className="text-xs text-muted-foreground mb-1">{product.category}</div>
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  {product.is_favourite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  {product.age_restricted && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-50 text-red-600">18+</span>
                  )}
                  {product.allergens && product.allergens.length > 0 && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-600">⚠</span>
                  )}
                </div>
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

        {/* Customer lookup */}
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{selectedCustomer.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedCustomer.tier} · {selectedCustomer.loyalty_points || 0} pts</div>
                </div>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Attach customer (name/phone/email)..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {customerResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border last:border-0"
                    >
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email || c.phone || c.tier}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Age restriction banner */}
        {hasAgeRestricted && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-800 font-medium">Age-restricted items — Challenge 25 will apply at checkout</span>
          </div>
        )}

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

            {/* Promo code input */}
            {!appliedPromo ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Promo code..."
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyPromoCode(); }}
                    className="pl-8 h-8 text-sm font-mono"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={applyPromoCode} className="h-8">Apply</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-green-700"><Tag className="w-3.5 h-3.5" /> {appliedPromo.name}</span>
                <button onClick={() => { setAppliedPromo(null); setPromoCode(''); }} className="text-green-600 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Discount breakdown */}
            {totalDiscount > 0 && (
              <div className="space-y-1.5 text-sm">
                {eligiblePromos.map((p, i) => {
                  const baseAmount = p.product_id
                    ? cart.filter(item => item.product_id === p.product_id).reduce((s, i) => s + i.unit_price * i.quantity, 0)
                    : cartTotal;
                  const disc = p.type === 'percentage' ? baseAmount * p.value / 100
                    : p.type === 'fixed' ? Math.min(p.value, baseAmount)
                    : 0;
                  return (
                    <div key={i} className="flex items-center justify-between text-green-600">
                      <span className="text-xs">↓ {p.name}{p.product_id ? ` (item only)` : ''}</span>
                      <span className="font-medium">-£{disc.toFixed(2)}</span>
                    </div>
                  );
                })}
                {appliedPromo && (
                  <div className="flex items-center justify-between text-green-600">
                    <span className="text-xs">↓ {appliedPromo.name}</span>
                    <span className="font-medium">-£{promoDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-1.5">
                  <span className="text-xs text-muted-foreground">Subtotal</span>
                  <span className="text-muted-foreground">£{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-red-500">
                  <span className="flex items-center gap-1 text-xs"><PoundSterling className="w-3 h-3" /> Total Discount</span>
                  <span className="font-medium">-£{totalDiscount.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between font-bold text-lg">
              <span>Total</span>
              <span>£{finalTotal.toFixed(2)}</span>
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
          total={finalTotal}
          co2e={cartCO2e}
          onConfirm={processTransaction}
          onClose={() => setShowPayment(false)}
          needsAgeVerification={hasAgeRestricted}
          ageRestrictionType={ageRestrictionType}
        />
      )}

      {showReceiptChoice && receiptTx && (
        <DigitalReceiptChoice
          transaction={receiptTx}
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