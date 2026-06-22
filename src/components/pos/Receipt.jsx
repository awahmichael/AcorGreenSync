import { Leaf } from 'lucide-react';

function formatPrice(val) {
  return `\u00A3${(val || 0).toFixed(2)}`;
}

function formatCO2e(val) {
  return `${(val || 0).toFixed(3)} kg`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('en-GB');
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `Date: ${date}  Time: ${time}`;
}

const PAYMENT_LABELS = {
  card: 'CARD',
  cash: 'CASH',
  contactless: 'CONTACTLESS',
  online: 'ONLINE',
};

export default function Receipt({ transaction }) {
  const items = transaction?.items || [];
  const paymentLabel = PAYMENT_LABELS[transaction?.payment_method] || 'CARD';
  const totalAmount = transaction?.total_amount || 0;
  const totalCO2e = transaction?.total_kg_co2e || 0;
  const upstream = transaction?.upstream_kg_co2e || 0;
  const downstream = transaction?.downstream_kg_co2e || 0;

  return (
    <div className="receipt-print font-mono text-[11px] leading-[1.6] text-black bg-white px-6 py-4 mx-auto" style={{ width: '320px' }}>
      {/* Header */}
      <div className="text-center space-y-0.5">
        <div className="font-bold text-sm tracking-wide">{transaction?.store_name || 'AcorCloud Green-Sync'}</div>
        <div>123 High Street, Edinburgh</div>
        <div>VAT NO. GB350396892</div>
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
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate">{label}</span>
              <span className="whitespace-nowrap">{formatPrice(lineTotal)}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Totals */}
      <div className="space-y-0.5">
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span>{paymentLabel}</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Transaction details */}
      <div className="text-center space-y-0.5">
        <div className="font-bold">*CUSTOMER COPY*</div>
        <div>PLEASE RETAIN RECEIPT</div>
        <div>{formatDate(transaction?.transaction_date)}</div>
        <div>TRNS NO: {transaction?.transaction_ref}</div>
        <div>{paymentLabel} SALE</div>
        <div>APPROVED</div>
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Carbon Footprint Summary */}
      <div className="text-center font-bold mb-1 flex items-center justify-center gap-1">
        <Leaf className="w-3 h-3" />
        CARBON FOOTPRINT
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between font-bold">
          <span>Total CO2e</span>
          <span>{formatCO2e(totalCO2e)}</span>
        </div>
        <div className="flex justify-between">
          <span>Upstream (Cat 1)</span>
          <span>{formatCO2e(upstream)}</span>
        </div>
        <div className="flex justify-between">
          <span>Downstream (Cat 11)</span>
          <span>{formatCO2e(downstream)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-500 my-2" />

      {/* Footer */}
      <div className="text-center space-y-0.5">
        <div>Thank you for shopping with us</div>
        <div className="font-bold">AcorCloud Green-Sync</div>
        <div>Working towards a greener</div>
        <div>future together</div>
      </div>
    </div>
  );
}