import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Plus, Eye, Trash2 } from 'lucide-react';
import StockCountModal from '@/components/stockcounts/StockCountModal';
import StockCountDetail from '@/components/stockcounts/StockCountDetail';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-amber-100 text-amber-700',
  counted: 'bg-blue-100 text-blue-700',
  reconciled: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

export default function StockCounts() {
  const { organizationId } = useOrganization();
  const [counts, setCounts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [countData, storeData] = await Promise.all([
        base44.entities.StockCount.filter({ organization_id: organizationId }, '-created_date', 200),
        base44.entities.Store.filter({ organization_id: organizationId }, '-created_date', 200)
      ]);
      setCounts(countData || []);
      setStores(storeData || []);
    } catch (err) {
      toast.error('Failed to load stock counts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (count) => {
    try {
      await base44.entities.StockCount.delete(count.id);
      toast.success('Stock count deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-primary" /> Stock Counts</h1>
          <p className="text-sm text-muted-foreground">Create and reconcile physical inventory counts with system quantities</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> New Count</Button>
      </div>

      {counts.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">No stock counts yet. Start your first inventory count.</p>
          <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> New Stock Count</Button>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Reference</th><th className="px-4 py-3 font-semibold">Store</th>
              <th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Items</th><th className="px-4 py-3 font-semibold text-right">Variance</th>
              <th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {counts.map(c => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-mono text-xs">{c.count_ref}</td>
                  <td className="px-4 py-2.5 font-medium">{c.store_name}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline">{c.count_type === 'global' ? 'Global' : c.department || 'Dept.'}</Badge></td>
                  <td className="px-4 py-2.5"><Badge className={STATUS_COLORS[c.status] || STATUS_COLORS.draft}>{c.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right">{c.total_items || (c.items?.length || 0)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {(c.total_variance_value || 0) !== 0 ? <span className={(c.total_variance_value || 0) < 0 ? 'text-red-600' : 'text-green-600'}>£{(c.total_variance_value || 0).toFixed(2)}</span> : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.snapshot_date ? new Date(c.snapshot_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCount(c)}><Eye className="w-4 h-4" /></Button>
                      {c.status !== 'reconciled' && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(c)}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StockCountModal open={showModal} onClose={() => setShowModal(false)} stores={stores} onCreated={loadData} />
      {selectedCount && <StockCountDetail count={selectedCount} onClose={() => setSelectedCount(null)} onUpdated={loadData} />}
    </div>
  );
}