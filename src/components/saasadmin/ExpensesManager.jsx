import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ExpenseModal from '@/components/saasadmin/ExpenseModal';

const CATEGORY_LABELS = {
  stock_purchased: 'Stock / Goods Purchased',
  freight_in: 'Freight In',
  packaging: 'Packaging',
  delivery_to_customers: 'Delivery to Customers',
  platform_fees: 'Platform / Transaction Fees',
  marketing: 'Marketing',
  office_admin: 'Office & Admin',
  other: 'Other Expenses'
};

const CATEGORY_COLORS = {
  stock_purchased: 'bg-purple-100 text-purple-700',
  freight_in: 'bg-purple-100 text-purple-700',
  packaging: 'bg-purple-100 text-purple-700',
  delivery_to_customers: 'bg-blue-100 text-blue-700',
  platform_fees: 'bg-blue-100 text-blue-700',
  marketing: 'bg-blue-100 text-blue-700',
  office_admin: 'bg-blue-100 text-blue-700',
  other: 'bg-blue-100 text-blue-700'
};

const fmt = (val) => `£${val.toFixed(2)}`;

export default function ExpensesManager({ expenses, onReload }) {
  const [editingExpense, setEditingExpense] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (expense) => {
    setDeletingId(expense.id);
    try {
      await base44.entities.Expense.delete(expense.id);
      toast.success('Expense deleted');
      onReload();
    } catch (err) {
      toast.error('Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalVat = expenses.reduce((s, e) => s + (e.vat_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="text-xs text-neutral-400 font-medium mb-1">Total Expenses</div>
          <div className="text-xl font-bold text-red-400">{fmt(totalAmount)}</div>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="text-xs text-neutral-400 font-medium mb-1">Total VAT (Reclaimable)</div>
          <div className="text-xl font-bold text-orange-400">{fmt(totalVat)}</div>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="text-xs text-neutral-400 font-medium mb-1">Expense Count</div>
          <div className="text-xl font-bold text-white">{expenses.length}</div>
        </div>
      </div>

      <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-750/50">
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
              <th className="px-4 py-3 font-semibold text-right">VAT</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700/50">
            {expenses.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No expenses recorded in this period</td></tr>
            ) : (
              expenses.map(e => (
                <tr key={e.id} className="hover:bg-neutral-750/30">
                  <td className="px-4 py-3 text-neutral-300 whitespace-nowrap">{e.date ? new Date(e.date).toLocaleDateString('en-GB') : '—'}</td>
                  <td className="px-4 py-3 text-white font-medium">{e.description}</td>
                  <td className="px-4 py-3"><Badge className={CATEGORY_COLORS[e.category] || 'bg-gray-100'}>{CATEGORY_LABELS[e.category] || e.category}</Badge></td>
                  <td className="px-4 py-3 text-neutral-400 text-xs">{e.supplier || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-400">-{fmt(e.amount || 0)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-400">{e.is_vat_reclaimable ? fmt(e.vat_amount || 0) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingExpense(e); setShowModal(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" disabled={deletingId === e.id} onClick={() => handleDelete(e)}>
                        {deletingId === e.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && <ExpenseModal expense={editingExpense} onClose={() => setShowModal(false)} onSaved={onReload} />}
    </div>
  );
}