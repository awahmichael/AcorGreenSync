import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Send, PackageCheck, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import PurchaseOrderModal from '@/components/purchaseorders/PurchaseOrderModal';
import ReceivePOModal from '@/components/purchaseorders/ReceivePOModal';
import PODetailModal from '@/components/purchaseorders/PODetailModal';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [receivePO, setReceivePO] = useState(null);
  const [viewPO, setViewPO] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.PurchaseOrder.list('-order_date', 100);
      setOrders(data);
    } catch (err) { toast.error('Failed to load purchase orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  const sendPO = async (po) => {
    try {
      await base44.entities.PurchaseOrder.update(po.id, { status: 'sent' });
      toast.success('PO sent to supplier');
      load();
    } catch (err) { toast.error(`Failed: ${err.message}`); }
  };

  const cancelPO = async (po) => {
    try {
      await base44.entities.PurchaseOrder.update(po.id, { status: 'cancelled' });
      toast.success('PO cancelled');
      load();
    } catch (err) { toast.error(`Failed: ${err.message}`); }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage procurement from suppliers with landed cost tracking</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />New Purchase Order
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'draft', 'sent', 'partially_received', 'received', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">PO Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Store</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Landed Cost</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expected</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(po => (
                <tr key={po.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium font-mono">{po.po_ref}</td>
                  <td className="px-4 py-3 text-sm">{po.supplier_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{po.store_name || '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[po.status] || 'bg-gray-100'}`}>{po.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{po.items?.length || 0}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-right">£{(po.landed_cost_total || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{po.expected_delivery_date || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewPO(po)} className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      {po.status === 'draft' && <button onClick={() => sendPO(po)} className="p-1.5 hover:bg-muted rounded text-blue-600" title="Send to supplier"><Send className="w-3.5 h-3.5" /></button>}
                      {(po.status === 'sent' || po.status === 'partially_received') && <button onClick={() => setReceivePO(po)} className="p-1.5 hover:bg-muted rounded text-green-600" title="Receive goods"><PackageCheck className="w-3.5 h-3.5" /></button>}
                      {po.status !== 'received' && po.status !== 'cancelled' && <button onClick={() => cancelPO(po)} className="p-1.5 hover:bg-muted rounded text-red-500" title="Cancel"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No purchase orders found. Create one to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <PurchaseOrderModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {receivePO && <ReceivePOModal po={receivePO} onClose={() => setReceivePO(null)} onReceived={() => { setReceivePO(null); load(); }} />}
      {viewPO && <PODetailModal po={viewPO} onClose={() => setViewPO(null)} />}
    </div>
  );
}