import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function StockCountModal({ open, onClose, stores, onCreated }) {
  const [countType, setCountType] = useState('global');
  const [storeId, setStoreId] = useState('');
  const [department, setDepartment] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const data = await base44.entities.Product.list('-created_date', 5000);
        setProducts(data || []);
        const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))].sort();
        setCategories(cats);
      } catch (err) {
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const handleCreate = async () => {
    if (!storeId) { toast.error('Please select a store'); return; }
    const store = stores.find(s => s.id === storeId);
    setSaving(true);
    try {
      const filtered = countType === 'departmentalized' && department
        ? products.filter(p => p.category === department)
        : products;

      const items = filtered.map(p => ({
        product_id: p.id,
        product_name: p.name,
        sku: p.sku || '',
        category: p.category || '',
        system_quantity: p.stock_quantity || 0,
        counted_quantity: null,
        variance: 0,
        unit_cost: p.cost_price || 0,
        variance_value: 0
      }));

      const ref = 'SC-' + Date.now().toString(36).toUpperCase();
      await base44.entities.StockCount.create({
        count_ref: ref,
        store_id: storeId,
        store_name: store?.name || '',
        count_type: countType,
        department: countType === 'departmentalized' ? department : null,
        status: 'in_progress',
        snapshot_date: new Date().toISOString(),
        items,
        total_items: items.length,
        total_variance_value: 0
      });
      toast.success(`Stock count started with ${items.length} items`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error('Failed to create stock count');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Start New Stock Count</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Count Type</Label>
              <Select value={countType} onValueChange={setCountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (Entire Store)</SelectItem>
                  <SelectItem value="departmentalized">Departmentalized (Specific Category)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {countType === 'departmentalized' && (
              <div>
                <Label>Department / Category</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || loading || !storeId}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Start Count'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}