import { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportElementAsPDF, printElement } from '@/lib/reports/exportUtils';

function NotConfigured({ label }) {
  return <div className="text-center py-8 text-muted-foreground text-sm">{label}</div>;
}

export default function StoreCloseReports({ data, period, dateRange }) {
  const { transactions = [], shifts = [], returns = [], promotions = [], giftCards = [], stores = [], stockMovements = [] } = data;

  const now = new Date();
  const periodDays = dateRange
    ? Math.max(1, Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24)) + 1)
    : period;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - periodDays);
  cutoff.setHours(0, 0, 0, 0);

  const periodTxns = transactions.filter(t => new Date(t.transaction_date) >= cutoff);
  const periodReturns = returns.filter(r => new Date(r.return_date) >= cutoff);
  const periodShifts = shifts.filter(s => new Date(s.shift_start) >= cutoff);

  const grossSales = periodTxns.reduce((s, t) => s + (t.subtotal || t.total_amount || 0), 0);
  const totalDiscounts = periodTxns.reduce((s, t) => s + (t.discount_amount || 0), 0);
  const netSales = periodTxns.reduce((s, t) => s + (t.total_amount || 0), 0);
  const totalCOGS = periodTxns.reduce((s, t) => s + (t.total_cogs || 0), 0);
  const grossProfit = netSales - totalCOGS;
  const totalReturns = periodReturns.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const totalCO2e = periodTxns.reduce((s, t) => s + (t.total_kg_co2e || 0), 0);

  const paymentBreakdown = periodTxns.reduce((acc, t) => {
    const method = t.payment_method || 'card';
    acc[method] = acc[method] || { count: 0, amount: 0 };
    acc[method].count++;
    acc[method].amount += (t.total_amount || 0);
    return acc;
  }, {});

  const cashSales = (paymentBreakdown.cash?.amount || 0);
  const cashRefunds = periodReturns.filter(r => r.refund_method === 'cash').reduce((s, r) => s + (r.refund_amount || 0), 0);

  const categorySales = periodTxns.flatMap(t => t.items || []).reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    acc[cat] = acc[cat] || { count: 0, quantity: 0, amount: 0, co2e: 0 };
    acc[cat].count++;
    acc[cat].quantity += (item.quantity || 0);
    acc[cat].amount += (item.unit_price || 0) * (item.quantity || 0);
    acc[cat].co2e += (item.kg_co2e || 0);
    return acc;
  }, {});

  const hourlySales = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, amount: 0 }));
  periodTxns.forEach(t => {
    const hour = new Date(t.transaction_date).getHours();
    hourlySales[hour].count++;
    hourlySales[hour].amount += (t.total_amount || 0);
  });

  const clerkSummary = periodTxns.reduce((acc, t) => {
    const name = t.cashier_name || 'Unknown';
    acc[name] = acc[name] || { txns: 0, sales: 0, returns: 0, co2e: 0 };
    acc[name].txns++;
    acc[name].sales += (t.total_amount || 0);
    acc[name].co2e += (t.total_kg_co2e || 0);
    return acc;
  }, {});

  const shiftSummary = periodShifts.map(s => {
    const shiftTxns = periodTxns.filter(t => t.cashier_name === s.cashier_name);
    return {
      ...s,
      txnCount: shiftTxns.length,
      salesTotal: shiftTxns.reduce((sum, t) => sum + (t.total_amount || 0), 0),
      co2eTotal: shiftTxns.reduce((sum, t) => sum + (t.total_kg_co2e || 0), 0),
    };
  });

  const vatRate = 0.20;
  const vatCollected = netSales * vatRate / (1 + vatRate);
  const netOfVat = netSales - vatCollected;

  const giftCardIssued = (giftCards || []).filter(g => new Date(g.issued_date) >= cutoff);
  const giftCardBalance = (giftCards || []).filter(g => g.status === 'active').reduce((s, g) => s + (g.balance || 0), 0);

  const discountsByPromo = periodTxns
    .filter(t => t.applied_promotions)
    .reduce((acc, t) => {
      const promos = t.applied_promotions.split(',').map(p => p.trim());
      promos.forEach(p => {
        acc[p] = acc[p] || { count: 0, discount: 0 };
        acc[p].count++;
        acc[p].discount += (t.discount_amount || 0) / promos.length;
      });
      return acc;
    }, {});

  const exportSection = (el, filename, title) => {
    exportElementAsPDF(el, filename, title, `Store Close — Period: ${periodDays} day(s)`);
  };

  const printSection = (el, title) => {
    printElement(el, title, `Store Close — Period: ${periodDays} day(s)`);
  };

  const SectionWrapper = ({ title, children, sectionId }) => (
    <div id={sectionId} className="bg-white border border-border rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h3 className="font-bold text-foreground">{title}</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const el = document.getElementById(sectionId); if (el) printSection(el, title); }}>
            <Printer className="w-3 h-3 mr-1" /> Print
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { const el = document.getElementById(sectionId); if (el) exportSection(el, `${sectionId}.pdf`, title); }}>
            <Download className="w-3 h-3 mr-1" /> PDF
          </Button>
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Store Close Reports</h2>
          <p className="text-sm text-muted-foreground">End-of-day reconciliation and close-out reports ({periodDays === 1 ? 'today' : `last ${periodDays} days`})</p>
        </div>
      </div>

      {/* Z-Report / End of Day Summary */}
      <SectionWrapper title="Z-Report — End of Day Summary" sectionId="z-report">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Gross Sales</div><div className="text-lg font-bold">£{grossSales.toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Total Discounts</div><div className="text-lg font-bold text-red-600">-£{totalDiscounts.toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Net Sales</div><div className="text-lg font-bold text-primary">£{netSales.toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Returns</div><div className="text-lg font-bold text-red-600">-£{totalReturns.toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Total COGS</div><div className="text-lg font-bold">£{totalCOGS.toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Gross Profit</div><div className="text-lg font-bold text-green-600">£{grossProfit.toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Transactions</div><div className="text-lg font-bold">{periodTxns.length}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Avg Transaction</div><div className="text-lg font-bold">£{(periodTxns.length ? netSales / periodTxns.length : 0).toFixed(2)}</div></div>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            <tr><td className="py-1.5 text-muted-foreground">Gross Sales (Subtotal)</td><td className="py-1.5 text-right font-medium">£{grossSales.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Less: Discounts</td><td className="py-1.5 text-right text-red-600">-£{totalDiscounts.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Less: Returns/Refunds</td><td className="py-1.5 text-right text-red-600">-£{totalReturns.toFixed(2)}</td></tr>
            <tr className="font-bold border-t-2 border-border"><td className="py-2">Net Sales Total</td><td className="py-2 text-right text-primary">£{netSales.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Cost of Goods Sold</td><td className="py-1.5 text-right">£{totalCOGS.toFixed(2)}</td></tr>
            <tr className="font-bold"><td className="py-1.5">Gross Profit</td><td className="py-1.5 text-right text-green-600">£{grossProfit.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Gross Margin %</td><td className="py-1.5 text-right">{netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : 0}%</td></tr>
            <tr className="border-t border-border"><td className="py-1.5 text-muted-foreground">VAT Collected (20%)</td><td className="py-1.5 text-right">£{vatCollected.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Net of VAT</td><td className="py-1.5 text-right">£{netOfVat.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Carbon Footprint</td><td className="py-1.5 text-right text-primary">{totalCO2e.toFixed(3)} kg CO₂e</td></tr>
          </tbody>
        </table>
      </SectionWrapper>

      {/* Payment Reconciliation */}
      <SectionWrapper title="Payment Reconciliation" sectionId="payment-recon">
        {Object.keys(paymentBreakdown).length === 0 ? <NotConfigured label="No transactions in this period." /> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Payment Method</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Count</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Amount</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">% of Total</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(paymentBreakdown).map(([method, val]) => (
                <tr key={method}><td className="px-3 py-2 capitalize font-medium">{method}</td><td className="px-3 py-2 text-right">{val.count}</td><td className="px-3 py-2 text-right font-medium">£{val.amount.toFixed(2)}</td><td className="px-3 py-2 text-right text-muted-foreground">{netSales > 0 ? ((val.amount / netSales) * 100).toFixed(1) : 0}%</td></tr>
              ))}
              <tr className="font-bold border-t-2 border-border"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">{periodTxns.length}</td><td className="px-3 py-2 text-right text-primary">£{netSales.toFixed(2)}</td><td className="px-3 py-2 text-right">100%</td></tr>
            </tbody>
          </table>
        )}
      </SectionWrapper>

      {/* Cash Drawer Reconciliation */}
      <SectionWrapper title="Cash Drawer Reconciliation" sectionId="cash-drawer">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            <tr><td className="py-1.5 text-muted-foreground">Opening Float</td><td className="py-1.5 text-right">£{(periodShifts.reduce((s, sh) => s + (sh.opening_float || 0), 0)).toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Cash Sales</td><td className="py-1.5 text-right">£{cashSales.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Cash Refunds</td><td className="py-1.5 text-right text-red-600">-£{cashRefunds.toFixed(2)}</td></tr>
            <tr className="font-bold border-t border-border"><td className="py-2">Expected Cash in Drawer</td><td className="py-2 text-right text-primary">£{(periodShifts.reduce((s, sh) => s + (sh.opening_float || 0), 0) + cashSales - cashRefunds).toFixed(2)}</td></tr>
          </tbody>
        </table>
        {shiftSummary.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Per Shift Breakdown</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold">Cashier</th><th className="text-left px-3 py-2 text-xs font-semibold">Store</th><th className="text-right px-3 py-2 text-xs font-semibold">Float</th><th className="text-right px-3 py-2 text-xs font-semibold">Sales</th><th className="text-right px-3 py-2 text-xs font-semibold">Close Cash</th></tr></thead>
              <tbody className="divide-y divide-border">
                {shiftSummary.map(s => (
                  <tr key={s.id}><td className="px-3 py-2">{s.cashier_name}</td><td className="px-3 py-2 text-muted-foreground">{s.store_name}</td><td className="px-3 py-2 text-right">£{(s.opening_float || 0).toFixed(2)}</td><td className="px-3 py-2 text-right">£{s.salesTotal.toFixed(2)}</td><td className="px-3 py-2 text-right">{s.closing_cash != null ? `£${s.closing_cash.toFixed(2)}` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionWrapper>

      {/* Clerk/Cashier Summary */}
      <SectionWrapper title="Clerk / Cashier Summary" sectionId="clerk-summary">
        {Object.keys(clerkSummary).length === 0 ? <NotConfigured label="No clerk data in this period." /> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Cashier</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Transactions</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Total Sales</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Avg Sale</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">CO₂e</th></tr></thead>
            <tbody className="divide-y divide-border">
              {Object.entries(clerkSummary).map(([name, val]) => (
                <tr key={name}><td className="px-3 py-2 font-medium">{name}</td><td className="px-3 py-2 text-right">{val.txns}</td><td className="px-3 py-2 text-right font-medium">£{val.sales.toFixed(2)}</td><td className="px-3 py-2 text-right">£{(val.txns ? val.sales / val.txns : 0).toFixed(2)}</td><td className="px-3 py-2 text-right text-primary">{val.co2e.toFixed(3)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionWrapper>

      {/* Department / Category Sales */}
      <SectionWrapper title="Department / Category Sales" sectionId="dept-sales">
        {Object.keys(categorySales).length === 0 ? <NotConfigured label="No category sales data." /> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Category</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Items Sold</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qty</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Revenue</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">% of Sales</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">CO₂e</th></tr></thead>
            <tbody className="divide-y divide-border">
              {Object.entries(categorySales).sort((a, b) => b[1].amount - a[1].amount).map(([cat, val]) => (
                <tr key={cat}><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">{val.count}</td><td className="px-3 py-2 text-right">{val.quantity}</td><td className="px-3 py-2 text-right font-medium">£{val.amount.toFixed(2)}</td><td className="px-3 py-2 text-right text-muted-foreground">{netSales > 0 ? ((val.amount / netSales) * 100).toFixed(1) : 0}%</td><td className="px-3 py-2 text-right text-primary">{val.co2e.toFixed(3)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionWrapper>

      {/* Tax / VAT Summary */}
      <SectionWrapper title="Tax / VAT Summary" sectionId="tax-summary">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            <tr><td className="py-1.5 text-muted-foreground">Total Sales (incl. VAT)</td><td className="py-1.5 text-right font-medium">£{netSales.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">VAT Rate</td><td className="py-1.5 text-right">20%</td></tr>
            <tr className="font-bold border-t border-border"><td className="py-2">VAT Collected</td><td className="py-2 text-right text-primary">£{vatCollected.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Net of VAT</td><td className="py-1.5 text-right">£{netOfVat.toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">Returns (excl. VAT reversal)</td><td className="py-1.5 text-right text-red-600">-£{(totalReturns / 1.2).toFixed(2)}</td></tr>
            <tr><td className="py-1.5 text-muted-foreground">VAT on Returns</td><td className="py-1.5 text-right text-red-600">-£{(totalReturns - totalReturns / 1.2).toFixed(2)}</td></tr>
            <tr className="font-bold border-t border-border"><td className="py-2">Net VAT Payable</td><td className="py-2 text-right text-primary">£{(vatCollected - (totalReturns - totalReturns / 1.2)).toFixed(2)}</td></tr>
          </tbody>
        </table>
      </SectionWrapper>

      {/* Returns & Exchanges Summary */}
      <SectionWrapper title="Returns & Exchanges Summary" sectionId="returns-summary">
        {periodReturns.length === 0 ? <NotConfigured label="No returns in this period." /> : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Total Returns</div><div className="text-lg font-bold">{periodReturns.length}</div></div>
              <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Total Refunded</div><div className="text-lg font-bold text-red-600">£{totalReturns.toFixed(2)}</div></div>
              <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Carbon Reversed</div><div className="text-lg font-bold text-primary">{periodReturns.reduce((s, r) => s + (r.carbon_reversal_kg_co2e || 0), 0).toFixed(3)} kg</div></div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Return Ref</th><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Original TXN</th><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Reason</th><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Method</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Refund</th></tr></thead>
              <tbody className="divide-y divide-border">
                {periodReturns.slice(0, 20).map(r => (
                  <tr key={r.id}><td className="px-3 py-2 font-mono text-xs">{r.return_ref}</td><td className="px-3 py-2 font-mono text-xs">{r.original_transaction_ref}</td><td className="px-3 py-2 capitalize">{r.reason || '—'}</td><td className="px-3 py-2 capitalize">{r.refund_method || '—'}</td><td className="px-3 py-2 text-right font-medium text-red-600">£{(r.refund_amount || 0).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </SectionWrapper>

      {/* Discounts & Promotions Summary */}
      <SectionWrapper title="Discounts & Promotions Summary" sectionId="discounts-summary">
        {Object.keys(discountsByPromo).length === 0 ? <NotConfigured label="No discounts applied in this period." /> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Promotion</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Applications</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Discount Given</th></tr></thead>
            <tbody className="divide-y divide-border">
              {Object.entries(discountsByPromo).map(([promo, val]) => (
                <tr key={promo}><td className="px-3 py-2 font-medium">{promo}</td><td className="px-3 py-2 text-right">{val.count}</td><td className="px-3 py-2 text-right text-red-600">-£{val.discount.toFixed(2)}</td></tr>
              ))}
              <tr className="font-bold border-t-2 border-border"><td className="px-3 py-2">Total Discounts</td><td className="px-3 py-2 text-right">{periodTxns.filter(t => t.discount_amount > 0).length}</td><td className="px-3 py-2 text-right text-red-600">-£{totalDiscounts.toFixed(2)}</td></tr>
            </tbody>
          </table>
        )}
      </SectionWrapper>

      {/* Gift Card Activity */}
      <SectionWrapper title="Gift Card Activity Report" sectionId="giftcard-activity">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Cards Issued</div><div className="text-lg font-bold">{giftCardIssued.length}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Issued Value</div><div className="text-lg font-bold">£{giftCardIssued.reduce((s, g) => s + (g.initial_balance || 0), 0).toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Active Balance</div><div className="text-lg font-bold text-primary">£{giftCardBalance.toFixed(2)}</div></div>
          <div className="bg-muted/30 rounded-lg p-3"><div className="text-xs text-muted-foreground">Total Cards</div><div className="text-lg font-bold">{(giftCards || []).length}</div></div>
        </div>
      </SectionWrapper>

      {/* Hourly Sales Breakdown */}
      <SectionWrapper title="Hourly Sales Breakdown" sectionId="hourly-sales">
        {periodTxns.length === 0 ? <NotConfigured label="No transaction data." /> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Hour</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Transactions</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Sales</th><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-1/2">Volume</th></tr></thead>
            <tbody className="divide-y divide-border">
              {hourlySales.filter(h => h.count > 0).map(h => {
                const maxAmount = Math.max(...hourlySales.map(h => h.amount), 1);
                return (
                  <tr key={h.hour}><td className="px-3 py-2 font-medium">{String(h.hour).padStart(2, '0')}:00</td><td className="px-3 py-2 text-right">{h.count}</td><td className="px-3 py-2 text-right font-medium">£{h.amount.toFixed(2)}</td><td className="px-3 py-2"><div className="h-3 bg-primary/20 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(h.amount / maxAmount) * 100}%` }} /></div></td></tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionWrapper>

      {/* Shift Reconciliation */}
      <SectionWrapper title="Shift Reconciliation Report" sectionId="shift-recon">
        {shiftSummary.length === 0 ? <NotConfigured label="No shifts in this period." /> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Cashier</th><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Store</th><th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Float</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Txns</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Sales</th><th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">CO₂e</th></tr></thead>
            <tbody className="divide-y divide-border">
              {shiftSummary.map(s => (
                <tr key={s.id}><td className="px-3 py-2 font-medium">{s.cashier_name}</td><td className="px-3 py-2 text-muted-foreground">{s.store_name}</td><td className="px-3 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${s.status === 'closed' ? 'bg-green-100 text-green-700' : s.status === 'reconciled' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{s.status}</span></td><td className="px-3 py-2 text-right">£{(s.opening_float || 0).toFixed(2)}</td><td className="px-3 py-2 text-right">{s.txnCount}</td><td className="px-3 py-2 text-right font-medium">£{s.salesTotal.toFixed(2)}</td><td className="px-3 py-2 text-right text-primary">{s.co2eTotal.toFixed(3)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionWrapper>
    </div>
  );
}