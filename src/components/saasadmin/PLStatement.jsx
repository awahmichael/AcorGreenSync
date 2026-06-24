import React from 'react';
import { DollarSign, TrendingUp, Building2 } from 'lucide-react';

const fmt = (val) => `£${val.toFixed(2)}`;
const fmtNeg = (val) => `-£${Math.abs(val).toFixed(2)}`;

export default function PLStatement({ fin }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Turnover</span></div>
          <div className="text-2xl font-bold text-green-500">{fmt(fin.turnover)}</div>
          <div className="text-xs text-neutral-400 mt-1">{fin.orderCount} orders</div>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2"><TrendingUp className="w-4 h-4" /><span className="text-xs font-medium">Gross Profit</span></div>
          <div className="text-2xl font-bold text-green-500">{fmt(fin.grossProfit)}</div>
          <div className="text-xs text-neutral-400 mt-1">After COGS</div>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2"><TrendingUp className="w-4 h-4" /><span className="text-xs font-medium">Operating Profit</span></div>
          <div className="text-2xl font-bold text-green-500">{fmt(fin.operatingProfit)}</div>
          <div className="text-xs text-neutral-400 mt-1">{fin.operatingMargin.toFixed(1)}% margin</div>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2"><Building2 className="w-4 h-4" /><span className="text-xs font-medium">Profit After Tax</span></div>
          <div className="text-2xl font-bold text-green-500">{fmt(fin.profitAfterTax)}</div>
          <div className="text-xs text-neutral-400 mt-1">Corp Tax: {(fin.corpTaxRate * 100).toFixed(0)}%</div>
        </div>
      </div>

      <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-700">
          <h3 className="font-semibold text-white">Profit & Loss Statement</h3>
          <p className="text-xs text-neutral-400">Limited Company — Corporation Tax</p>
        </div>
        <div className="divide-y divide-neutral-700/50">
          <Row label="Turnover (Net Sales)" value={fmt(fin.turnover)} bold />
          <SectionHeader label="COST OF GOODS SOLD" />
          <Row label="Stock / Goods Purchased" value={fmtNeg(fin.stockPurchased)} indent />
          <Row label="Freight In (Import / Delivery of Stock)" value={fmtNeg(fin.freightIn)} indent />
          <Row label="Packaging" value={fmtNeg(fin.packaging)} indent />
          <Row label="Gross Profit" value={fmt(fin.grossProfit)} bold positive />
          <SectionHeader label="ADMINISTRATIVE & OPERATING EXPENSES" />
          <Row label="Delivery to Customers" value={fmtNeg(fin.deliveryToCustomers)} indent />
          <Row label="Platform / Transaction Fees" value={fmtNeg(fin.platformFees)} indent />
          <Row label="Marketing" value={fmtNeg(fin.marketing)} indent />
          <Row label="Office & Admin" value={fmtNeg(fin.officeAdmin)} indent />
          <Row label="Other Expenses" value={fmtNeg(fin.otherExpenses)} indent />
          <Row label="Operating Profit (Profit Before Tax)" value={fmt(fin.operatingProfit)} bold positive />
          <SectionHeader label="TAXATION" />
          <Row label={`Corporation Tax (${(fin.corpTaxRate * 100).toFixed(0)}%)`} value={fmtNeg(fin.corpTax)} indent />
          <Row label="Profit After Tax" value={fmt(fin.profitAfterTax)} bold positive large />
        </div>
      </div>

      <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-700 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center"><DollarSign className="w-4 h-4 text-orange-500" /></div>
          <div><h3 className="font-semibold text-white">VAT Summary</h3></div>
        </div>
        <div className="divide-y divide-neutral-700/50">
          <Row label="Output VAT (on sales)" value={fmt(fin.outputVat)} sublabel="Food products are zero-rated (0%)" />
          <Row label="Input VAT (on purchases — reclaimable)" value={fmt(fin.inputVat)} />
          <Row label={fin.netVat >= 0 ? "Net VAT Position (HMRC owes you)" : "Net VAT Position (You owe HMRC)"} value={fmt(Math.abs(fin.netVat))} bold />
        </div>
        <div className="px-5 py-3 bg-neutral-750 border-t border-neutral-700 text-xs text-neutral-400">
          As a zero-rated food supplier, you charge 0% VAT on sales but can reclaim VAT paid on business purchases. File quarterly VAT returns with HMRC.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, positive, indent, large, sublabel }) {
  return (
    <div className={`flex items-center justify-between px-5 py-2.5 ${indent ? 'pl-8' : ''}`}>
      <div>
        <span className={`text-sm ${bold ? 'font-semibold text-white' : 'text-neutral-300'}`}>{label}</span>
        {sublabel && <div className="text-xs text-neutral-500">{sublabel}</div>}
      </div>
      <span className={`font-mono text-sm ${large ? 'text-lg' : ''} ${bold ? 'font-bold ' : ''}${positive ? 'text-green-500' : value.startsWith('-') ? 'text-red-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ label }) {
  return <div className="px-5 py-2 bg-neutral-750/50"><span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{label}</span></div>;
}