import React from 'react';

const fmt = (val) => `£${val.toFixed(2)}`;

export default function VatByOrg({ transactions, organizations }) {
  const groups = {};
  transactions.forEach(t => {
    const org = organizations.find(o => o.id === t.organization_id);
    const name = org?.name || t.store_name || 'Unassigned';
    if (!groups[name]) groups[name] = { count: 0, taxable: 0, vat: 0, gross: 0 };
    groups[name].count++;
    groups[name].taxable += t.subtotal || 0;
    groups[name].vat += t.tax_amount || 0;
    groups[name].gross += t.total_amount || 0;
  });

  const rows = Object.entries(groups).sort((a, b) => b[1].gross - a[1].gross);
  const totals = rows.reduce((acc, [_, g]) => {
    acc.count += g.count; acc.taxable += g.taxable; acc.vat += g.vat; acc.gross += g.gross;
    return acc;
  }, { count: 0, taxable: 0, vat: 0, gross: 0 });

  return (
    <div className="space-y-4">
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-700"><h3 className="font-semibold text-white">VAT Breakdown by Organization</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-750/50">
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="px-5 py-3 font-semibold">Organization</th>
              <th className="px-4 py-3 font-semibold text-center">Transactions</th>
              <th className="px-4 py-3 font-semibold text-right">Taxable Sales</th>
              <th className="px-4 py-3 font-semibold text-right">VAT Collected</th>
              <th className="px-5 py-3 font-semibold text-right">Gross Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700/50">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-neutral-500">No transactions in this period</td></tr>
            ) : (
              <>
                {rows.map(([name, g]) => (
                  <tr key={name} className="hover:bg-neutral-750/30">
                    <td className="px-5 py-3 font-medium text-white">{name}</td>
                    <td className="px-4 py-3 text-center text-neutral-300">{g.count}</td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-300">{fmt(g.taxable)}</td>
                    <td className="px-4 py-3 text-right font-mono text-orange-400">{fmt(g.vat)}</td>
                    <td className="px-5 py-3 text-right font-mono font-medium text-white">{fmt(g.gross)}</td>
                  </tr>
                ))}
                <tr className="bg-neutral-750/50 font-semibold">
                  <td className="px-5 py-3 text-white">TOTAL</td>
                  <td className="px-4 py-3 text-center text-white">{totals.count}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">{fmt(totals.taxable)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-400">{fmt(totals.vat)}</td>
                  <td className="px-5 py-3 text-right font-mono text-white">{fmt(totals.gross)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}