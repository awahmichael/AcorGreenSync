import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Save, CheckCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';

const VARIANCE_COLORS = {
  shrinkage: 'bg-red-100 text-red-700',
  damage: 'bg-orange-100 text-orange-700',
  admin_error: 'bg-amber-100 text-amber-700',
  surplus: 'bg-green-100 text-green-700',
  unexplained: 'bg-gray-100 text-gray-700'
};

export default function StockCountDetail({ count, onClose, onUpdated }) {
  const { organizationId } = useOrganization();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    if (count?.items) setItems(count.items.map(it => ({ ...it })));
  }, [count]);

  if (!count) return null;

  const updateItem = (idx, field, value) => {
    const updated = [...items];
    updated[idx][field] = value === '' ? null : Number(value);
    if (field === 'counted_quantity' && updated[idx].counted_quantity != null) {
      updated[idx].variance = updated[idx].counted_quantity - (updated[idx].system_quantity || 0);
      updated[idx].variance_value = updated[idx].variance * (updated[idx].unit_cost || 0);
    }
    setItems(updated);
  };

  const updateReason = (idx, reason) => {
    const updated = [...items];
    updated[idx].variance_reason = reason;
    setItems(updated);
  };

  const filteredItems = items.filter(it =>
    !search || it.product_name?.toLowerCase().includes(search.toLowerCase()) || it.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const countedItems = items.filter(it => it.counted_quantity != null).length;
  const totalVariance = items.reduce((sum, it) => sum + (it.variance || 0), 0);
  const totalVarianceValue = items.reduce((sum, it) => sum + (it.variance_value || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.StockCount.update(count.id, {
        items,
        total_variance_value: totalVarianceValue,
        status: 'counted',
        counted_date: new Date().toISOString()
      });
      toast.success('Stock count saved');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error('Failed to save stock count');
    } finally {
      setSaving(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      for (const item of items) {
        if (item.counted_quantity != null && item.variance !== 0) {
          await base44.entities.Product.update(item.product_id, {
            stock_quantity: item.counted_quantity
          });
          await base44.entities.StockMovement.create({
            product_id: item.product_id,
            product_name: item.product_name,
            store_id: count.store_id,
            store_name: count.store_name,
            movement_type: 'adjustment',
            quantity: Math.abs(item.variance),
            unit: 'unit',
            reference: count.count_ref,
            notes: `Stock count variance — ${item.variance_reason || 'unexplained'} (${item.variance > 0 ? 'surplus' : 'shortage'})`,
            organization_id: organizationId,
            movement_date: new Date().toISOString(),
          });
        }
      }
      await base44.entities.StockCount.update(count.id, {
        items,
        total_variance_value: totalVarianceValue,
        status: 'reconciled',
        counted_date: new Date().toISOString(),
        reconciled_date: new Date().toISOString()
      });
      toast.success('Stock count reconciled — inventory adjusted');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error('Failed to reconcile stock count');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <Dialog open={!!count} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Stock Count: {count.count_ref}</span>
            <Badge variant="outline">{count.count_type === 'global' ? 'Global' : count.department || 'Department'}</Badge>
            <Badge className={count.status === 'reconciled' ? 'bg-green-100 text-green-700' : count.status === 'counted' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}>{count.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-600" /><span className="font-medium">{countedItems}/{items.length}</span><span className="text-muted-foreground">counted</span></div>
          <div className="text-sm">Total Variance: <span className={totalVariance < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{totalVariance > 0 ? '+' : ''}{totalVariance} units</span></div>
          <div className="text-sm">Variance Value: <span className={totalVarianceValue < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>£{totalVarianceValue.toFixed(2)}</span></div>
          <div className="relative ml-auto">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Product</th><th className="px-3 py-2 font-semibold">SKU</th>
                <th className="px-3 py-2 font-semibold text-right">System Qty</th><th className="px-3 py-2 font-semibold text-right">Counted Qty</th>
                <th className="px-3 py-2 font-semibold text-right">Variance</th><th className="px-3 py-2 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item, idx) => {
                const realIdx = items.indexOf(item);
                const hasVariance = item.variance !== 0 && item.counted_quantity != null;
                return (
                  <tr key={realIdx} className={hasVariance ? 'bg-amber-50' : 'hover:bg-muted/20'}>
                    <td className="px-3 py-2 font-medium">{item.product_name}</td>
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{item.sku || '—'}</td>
                    <td className="px-3 py-2 text-right">{item.system_quantity ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" className="w-20 ml-auto text-right h-8" value={item.counted_quantity ?? ''} onChange={e => updateItem(realIdx, 'counted_quantity', e.target.value)} disabled={count.status === 'reconciled'} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {hasVariance ? <span className={item.variance < 0 ? 'text-red-600' : 'text-green-600'}>{item.variance > 0 ? '+' : ''}{item.variance}</span> : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {hasVariance ? (
                        <Select value={item.variance_reason || 'unexplained'} onValueChange={v => updateReason(realIdx, v)} disabled={count.status === 'reconciled'}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shrinkage">Shrinkage</SelectItem><SelectItem value="damage">Damage</SelectItem>
                            <SelectItem value="admin_error">Admin Error</SelectItem><SelectItem value="surplus">Surplus</SelectItem>
                            <SelectItem value="unexplained">Unexplained</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {count.status !== 'reconciled' && (
            <>
              <Button variant="secondary" onClick={handleSave} disabled={saving || countedItems === 0}>
                {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save Progress</>}
              </Button>
              <Button onClick={handleReconcile} disabled={reconciling || countedItems === 0}>
                {reconciling ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Reconcile & Adjust Stock</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}