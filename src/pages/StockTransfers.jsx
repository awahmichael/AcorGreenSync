import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Truck, PackageCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import StockTransferModal from '@/components/stocktransfers/StockTransferModal';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  in_transit: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function StockTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.StockTransfer.list('-created_date', 100);
      setTransfers(data);
    } catch (err) { toast.error('Failed to load transfers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === 'all' ? transfers : transfers.filter(t => t.status === statusFilter);

  const ship = async (transfer) => {
    try {
      // Deduct stock from source products
      await Promise.allSettled(
        (transfer.items || []).map(async (item) => {
          const products = await base44.entities.Product.filter({ id: item.product_id });
          if (products[0]) {
            await base44.entities.Product.update(item.product_id, {
              stock_quantity: Math.max(0, (products[0].stock_quantity || 0) - item.quantity),
            });
          }
          await base44.entities.StockMovement.create({
            product_id: item.product_id,
            product_name: item.product_name,
            store_id: transfer.from_store_id,
            store_name: transfer.from_store_name,
            movement_type: 'transfer_out',
            quantity: item.quantity,
            unit: item.unit || 'unit',
            reference: transfer.transfer_ref,
            movement_date: new Date().toISOString(),
          });
        })
      );
      await base44.entities.StockTransfer.update(transfer.id, { status: 'in_transit', shipped_date: new Date().toISOString() });
      toast.success('Transfer shipped — stock deducted from source');
      load();
    } catch (err) { toast.error(`Failed: ${err.message}`); }
  };

  const receive = async (transfer) => {
    try {
      // Add stock to destination products
      await Promise.allSettled(
        (transfer.items || []).map(async (item) => {
          const products = await base44.entities.Product.filter({ id: item.product_id });
          if (products[0]) {
            await base44.entities.Product.update(item.product_id, {
              stock_quantity: (products[0].stock_quantity || 0) + item.quantity,
            });
          }
          await base44.entities.StockMovement.create({
            product_id: item.product_id,
            product_name: item.product_name,
            store_id: transfer.to_store_id,
            store_name: transfer.to_store_name,
            movement_type: 'transfer_in',
            quantity: item.quantity,
            unit: item.unit || 'unit',
            reference: transfer.transfer_ref,
            movement_date: new Date().toISOString(),
          });
        })
      );
      await base44.entities.StockTransfer.update(transfer.id, { status: 'received', received_date: new Date().toISOString() });
      toast.success('Transfer received — stock added to destination');
      load();
    } catch (err) { toast.error(`Failed: ${err.message}`); }
  };

  const cancel = async (transfer) => {
    try {
      await base44.entities.StockTransfer.update(transfer.id, { status: 'cancelled' });
      toast.success('Transfer cancelled');
      load();
    } catch (err) { toast.error(`Failed: ${err.message}`); }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Transfers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Move inventory between stores with in-transit tracking</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />New Transfer
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'draft', 'in_transit', 'received', 'cancelled'].map(s => (
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">From → To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shipped</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium font-mono">{t.transfer_ref}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium">{t.from_store_name}</span>
                    <span className="text-muted-foreground mx-1.5">→</span>
                    <span className="font-medium">{t.to_store_name}</span>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[t.status] || 'bg-gray-100'}`}>{t.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{t.items?.length || 0}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{t.shipped_date ? new Date(t.shipped_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {t.status === 'draft' && <button onClick={() => ship(t)} className="p-1.5 hover:bg-muted rounded text-blue-600" title="Ship transfer"><Truck className="w-3.5 h-3.5" /></button>}
                      {t.status === 'in_transit' && <button onClick={() => receive(t)} className="p-1.5 hover:bg-muted rounded text-green-600" title="Receive transfer"><PackageCheck className="w-3.5 h-3.5" /></button>}
                      {t.status !== 'received' && t.status !== 'cancelled' && <button onClick={() => cancel(t)} className="p-1.5 hover:bg-muted rounded text-red-500" title="Cancel"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No stock transfers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <StockTransferModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}