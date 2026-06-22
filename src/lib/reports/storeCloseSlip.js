// Generates slip-printer-style HTML for store close reports
// Mimics thermal receipt printer output: narrow, monospace, dashed separators

function money(n) {
  const neg = (n || 0) < 0;
  const abs = Math.abs(n || 0);
  return `${neg ? '-' : ''}£${abs.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmt(n) { return (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 }); }

function row(label, value, opts = {}) {
  const bold = opts.bold ? 'font-weight:bold;' : '';
  const indent = opts.indent ? 'padding-left:14px;' : '';
  const valClass = opts.red ? 'color:#c00;' : '';
  return `<div style="display:flex;justify-content:space-between;padding:1px 0;${bold}${indent}"><span>${label}</span><span style="${valClass}">${value}</span></div>`;
}

function dashed() {
  return '<div style="border-top:1px dashed #000;margin:4px 0;"></div>';
}

function doubleLine() {
  return '<div style="border-top:3px double #000;margin:4px 0;"></div>';
}

function center(text, bold = false) {
  return `<div style="text-align:center;${bold ? 'font-weight:bold;' : ''}">${text}</div>`;
}

function sectionHeader(text) {
  return dashed() + center(text, true) + dashed();
}

export function generateStoreCloseSlipHTML({ periodLabel, storeName, calculations }) {
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  const {
    grossSales, totalDiscounts, netSales, totalReturns, totalCOGS, grossProfit,
    periodTxnsCount, totalCO2e, paymentBreakdown, cashSales, cashRefunds,
    openingFloatTotal, expectedCash, categorySales, clerkSummary,
    vatCollected, netOfVat, vatOnReturns, netVATPayable,
    discountsByPromo, giftCardIssued, giftCardBalance, totalGiftCards,
    hourlySales, shiftSummary,
  } = calculations;

  let html = '';

  // Header
  html += center('ACORCLOUD GREEN-SYNC', true);
  html += center('STORE CLOSE REPORT', true);
  html += center(now);
  html += dashed();
  html += row('Store:', storeName || 'All Stores');
  html += row('Period:', periodLabel);
  html += row('Transactions:', String(periodTxnsCount));
  html += dashed();

  // Sales Summary
  html += sectionHeader('SALES SUMMARY');
  html += row('Gross Sales', money(grossSales));
  html += row('Less: Discounts', `-${money(totalDiscounts)}`, { red: true });
  html += row('Less: Returns', `-${money(totalReturns)}`, { red: true });
  html += doubleLine();
  html += row('Net Sales', money(netSales), { bold: true });
  html += row('Cost of Goods Sold', money(totalCOGS));
  html += row('Gross Profit', money(grossProfit));
  html += row('Gross Margin %', `${netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0.0'}%`);
  html += row('Avg Transaction', money(periodTxnsCount ? netSales / periodTxnsCount : 0));

  // Payment Reconciliation
  html += sectionHeader('PAYMENT RECONCILIATION');
  Object.entries(paymentBreakdown).forEach(([method, val]) => {
    const pct = netSales > 0 ? ((val.amount / netSales) * 100).toFixed(1) : '0.0';
    html += row(`${method.toUpperCase()} (${val.count})`, `${money(val.amount)}  ${pct}%`);
  });
  html += doubleLine();
  html += row('TOTAL', money(netSales), { bold: true });

  // Cash Drawer
  html += sectionHeader('CASH DRAWER');
  html += row('Opening Float', money(openingFloatTotal));
  html += row('Cash Sales', money(cashSales));
  html += row('Cash Refunds', `-${money(cashRefunds)}`, { red: true });
  html += doubleLine();
  html += row('Expected Cash', money(expectedCash), { bold: true });

  // Department Sales
  if (Object.keys(categorySales).length > 0) {
    html += sectionHeader('DEPARTMENT SALES');
    Object.entries(categorySales).sort((a, b) => b[1].amount - a[1].amount).forEach(([cat, val]) => {
      const pct = netSales > 0 ? ((val.amount / netSales) * 100).toFixed(1) : '0.0';
      html += row(cat.toUpperCase(), `${money(val.amount)} ${pct}%`, { bold: true });
      html += row(`Qty: ${fmt(val.quantity)} / Items: ${val.count}`, `CO2e: ${val.co2e.toFixed(3)}`, { indent: true });
    });
    html += doubleLine();
    html += row('TOTAL', money(netSales), { bold: true });
  }

  // Clerk Summary
  if (Object.keys(clerkSummary).length > 0) {
    html += sectionHeader('CLERK SUMMARY');
    Object.entries(clerkSummary).forEach(([name, val]) => {
      html += row(name.toUpperCase(), money(val.sales), { bold: true });
      html += row(`Txns: ${val.txns} / Avg: ${money(val.txns ? val.sales / val.txns : 0)}`, `CO2e: ${val.co2e.toFixed(3)}`, { indent: true });
    });
  }

  // Tax / VAT Summary
  html += sectionHeader('TAX / VAT SUMMARY');
  html += row('Total Sales (incl VAT)', money(netSales));
  html += row('VAT Rate', '20%');
  html += doubleLine();
  html += row('VAT Collected', money(vatCollected), { bold: true });
  html += row('Net of VAT', money(netOfVat));
  html += row('VAT on Returns', `-${money(vatOnReturns)}`, { red: true });
  html += doubleLine();
  html += row('Net VAT Payable', money(netVATPayable), { bold: true });

  // Returns & Exchanges
  if (calculations.periodReturnsCount > 0) {
    html += sectionHeader('RETURNS & EXCHANGES');
    html += row('Total Returns', String(calculations.periodReturnsCount));
    html += row('Total Refunded', `-${money(totalReturns)}`, { red: true });
    html += row('Carbon Reversed', `${calculations.carbonReversed.toFixed(3)} kg CO2e`);
  }

  // Discounts & Promotions
  if (Object.keys(discountsByPromo).length > 0) {
    html += sectionHeader('DISCOUNTS & PROMOTIONS');
    Object.entries(discountsByPromo).forEach(([promo, val]) => {
      html += row(promo, `-${money(val.discount)} (${val.count})`, { red: true });
    });
    html += doubleLine();
    html += row('TOTAL DISCOUNTS', `-${money(totalDiscounts)}`, { bold: true, red: true });
  }

  // Gift Card Activity
  if (totalGiftCards > 0) {
    html += sectionHeader('GIFT CARD ACTIVITY');
    html += row('Cards Issued', String(giftCardIssued.length));
    html += row('Issued Value', money(giftCardIssued.reduce((s, g) => s + (g.initial_balance || 0), 0)));
    html += row('Active Balance', money(giftCardBalance));
    html += row('Total Cards', String(totalGiftCards));
  }

  // Hourly Sales
  const activeHours = hourlySales.filter(h => h.count > 0);
  if (activeHours.length > 0) {
    html += sectionHeader('HOURLY SALES');
    activeHours.forEach(h => {
      html += row(`${String(h.hour).padStart(2, '0')}:00  ${h.count} txns`, money(h.amount));
    });
  }

  // Shift Reconciliation
  if (shiftSummary.length > 0) {
    html += sectionHeader('SHIFT RECONCILIATION');
    shiftSummary.forEach(s => {
      html += row(`${s.cashier_name}`, s.store_name || '', { bold: true });
      html += row(`Float: ${money(s.opening_float || 0)}`, `Txns: ${s.txnCount}`, { indent: true });
      html += row(`Sales: ${money(s.salesTotal)}`, `CO2e: ${s.co2eTotal.toFixed(3)}`, { indent: true });
      html += row('Status:', s.status || 'open', { indent: true });
    });
  }

  // Carbon footer
  html += dashed();
  html += center('CARBON FOOTPRINT TOTAL', true);
  html += center(`${totalCO2e.toFixed(3)} kg CO2e`, true);
  html += dashed();
  html += center('End of Report', true);
  html += center('---', false);

  return html;
}