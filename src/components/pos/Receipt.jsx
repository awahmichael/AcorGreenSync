import { Leaf } from 'lucide-react';
import { getPrintSettings } from '@/lib/printSettings';
import { useOrganization } from '@/hooks/useOrganization.jsx';

function formatPrice(val) { return `\u00A3${(val || 0).toFixed(2)}`; }
function formatCO2e(val) { return `${(val || 0).toFixed(3)} kg`; }
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `Date: ${d.toLocaleDateString('en-GB')}  Time: ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

const PAYMENT_LABELS = { card: 'CARD', cash: 'CASH', contactless: 'CONTACTLESS', online: 'ONLINE' };

export default function Receipt({ transaction }) {
  const items = transaction?.items || [];
  const settings = getPrintSettings();
  const { currentOrg } = useOrganization();

  const businessName = settings.business_name || currentOrg?.name || 'AcorCloud Green-Sync';
  const vatNumber = settings.vat_number || currentOrg?.vat_number || '';
  const footerMessage = settings.footer_message || 'Thank you for shopping with us';
  const paymentLabel = PAYMENT_LABELS[transaction?.payment_method] || 'CARD';
  const totalAmount = transaction?.total_amount || 0;
  const totalCO2e = transaction?.total_kg_co2e || 0;
  const tipAmount = transaction?.tip_amount || 0;
  const carbonOffset = transaction?.carbon_offset_amount || 0;
  const discountAmount = transaction?.discount_amount || 0;
  const splitPayments = transaction?.split_payments || [];

  // Collect allergen warnings
  const allergenItems = items.filter(i => i.allergens && i.allergens.length > 0);

  return (
    <div className="receipt-print font-mono text-[11px] leading-[1.6] text-black bg-white px-6 py-4 mx-auto" style={{ width: '320px' }}>
      {/* Header — branded */}
      <div className="text-center space-y-0.5">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center">
            <Leaf className="w-3 h-3 text-white" />
          </div>
          <div className="font-bold text-sm tracking-wide">{businessName}</div>
        </div>
        {currentOrg?.name && settings.business_name && <div>{settings.business_name}</div>}
        <div>{settings.address_line || '123 High Street, Edinburgh'}</div>
        {vatNumber && <div>VAT NO. {vatNumber}</div>}
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Items */}
      <div className="space-y-0.5">
        {items.map((item, i) => {
          const lineTotal = (item.unit_price || 0) * (item.quantity || 1);
          const label = item.quantity > 1
            ? `${item.product_name} ${item.quantity} x \u00A3${(item.unit_price || 0).toFixed(2)}`
            : item.product_name;
          return (
            <div key={i}>
              <div className="flex justify-between gap-2">
                <span className="truncate">{label}</span>
                <span className="whitespace-nowrap">{formatPrice(lineTotal)}</span>
              </div>
              {item.allergens && item.allergens.length > 0 && (
                <div className="text-[9px] text-amber-700 ml-2">⚠ Allergens: {item.allergens.join(', ')}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Totals */}
      <div className="space-y-0.5">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(transaction?.subtotal || totalAmount)}</span></div>
        {discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatPrice(discountAmount)}</span></div>}
        {transaction?.tax_amount > 0 && <div className="flex justify-between"><span>VAT ({transaction?.tax_rate || 20}%)</span><span>{formatPrice(transaction.tax_amount)}</span></div>}
        {tipAmount > 0 && <div className="flex justify-between"><span>Tip</span><span>{formatPrice(tipAmount)}</span></div>}
        {carbonOffset > 0 && <div className="flex justify-between text-green-700"><span>Carbon Offset</span><span>{formatPrice(carbonOffset)}</span></div>}
        <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{formatPrice(totalAmount)}</span></div>
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Payment breakdown */}
      <div className="space-y-0.5">
        {splitPayments.length > 0 ? (
          splitPayments.map((sp, i) => (
            <div key={i} className="flex justify-between">
              <span>{PAYMENT_LABELS[sp.method] || sp.method?.toUpperCase()}</span>
              <span>{formatPrice(sp.amount)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between"><span>{paymentLabel}</span><span>{formatPrice(totalAmount)}</span></div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Transaction details */}
      <div className="text-center space-y-0.5">
        <div className="font-bold">*CUSTOMER COPY*</div>
        <div>PLEASE RETAIN RECEIPT</div>
        <div>{formatDate(transaction?.transaction_date)}</div>
        <div>TRNS NO: {transaction?.transaction_ref}</div>
        {transaction?.age_verified && <div className="font-bold">AGE VERIFIED ✓</div>}
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Carbon Footprint Summary */}
      <div className="text-center font-bold mb-1 flex items-center justify-center gap-1">
        <Leaf className="w-3 h-3" />
        CARBON FOOTPRINT
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between font-bold"><span>Total CO₂e</span><span>{formatCO2e(totalCO2e)}</span></div>
        {carbonOffset > 0 && <div className="flex justify-between text-green-700"><span>Offset Contribution</span><span>{formatCO2e(carbonOffset * 20)}</span></div>}
      </div>

      {/* Allergen declaration */}
      {allergenItems.length > 0 && (
        <>
          <div className="border-t border-dashed border-gray-500 my-2" />
          <div className="text-[9px] space-y-0.5">
            <div className="font-bold">ALLERGEN INFORMATION</div>
            <div>For full allergen details, please ask staff.</div>
          </div>
        </>
      )}

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Footer — branded */}
      <div className="text-center space-y-0.5">
        <div>{footerMessage}</div>
        <div className="font-bold flex items-center justify-center gap-1">
          <Leaf className="w-3 h-3 text-green-600" />
          AcorCloud Green-Sync
        </div>
        <div>The UK's First Carbon-Native POS</div>
        <div className="text-[9px] text-gray-500 mt-1">www.acorgreensync.com</div>
      </div>
    </div>
  );
}