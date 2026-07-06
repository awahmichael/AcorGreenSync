import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';

export default function ReceivePOModal({ po, onClose, onReceived }) {
  const { organizationId } = useOrganization();
  const [receivedQty, setReceivedQty] = useState({});
  const [saving, setSaving] = useState(false);

  const handleReceive = async () => {
    setSaving(true);
    try {
      const updatedItems = po.items.map((item, idx) => {
        const received = parseFloat(receivedQty[idx]) || 0;
        return { ...item, quantity_received: (item.quantity_received || 0) + received };
      });
      const allReceived = updatedItems.every(i => i.quantity_received >= i.quantity_ordered);
      const anyReceived = updatedItems.some((i, idx) => parseFloat(receivedQty[idx]) > 0);

      if (!anyReceived) { toast.error('Enter at least one received quantity'); setSaving(false); return; }

      await base44.entities.PurchaseOrder.update(po.id, {
        items: updatedItems,
        status: allReceived ? 'received' : 'partially_received',
        received_date: allReceived ? new Date().toISOString() : null,
      });

      // Update product stock & create stock movements
      await Promise.allSettled(
        po.items.map(async (item, idx) => {
          const received = parseFloat(receivedQty[idx]) || 0;
          if (received <= 0) return;
          const products = await base44.entities.Product.filter({ id: item.product_id });
          if (products[0]) {
            await base44.entities.Product.update(item.product_id, {
              stock_quantity: (products[0].stock_quantity || 0) + received,
              cost_price: item.unit_cost || products[0].cost_price || 0,
            });
          }
          await base44.entities.StockMovement.create({
            product_id: item.product_id,
            product_name: item.product_name,
            store_id: po.store_id,
            store_name: po.store_name,
            movement_type: 'purchase_in',
            quantity: received,
            unit: 'unit',
            supplier_id: po.supplier_id,
            reference: po.po_ref,
            organization_id: organizationId,
            movement_date: new Date().toISOString(),
          });
        })
      );

      toast.success(allReceived ? 'PO fully received — stock updated' : 'Partial receipt recorded');
      onReceived();
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Receive PO — {po.po_ref}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {po.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 py-2 border-b last:border-0">
              <div className="flex-1">
                <div className="text-sm font-medium">{item.product_name}</div>
                <div className="text-xs text-muted-foreground">Ordered: {item.quantity_ordered} · Already received: {item.quantity_received || 0}</div>
              </div>
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Receiving now</Label>
                <Input type="number" min="0" max={item.quantity_ordered - (item.quantity_received || 0)} value={receivedQty[idx] || ''} onChange={e => setReceivedQty(prev => ({ ...prev, [idx]: e.target.value }))} placeholder="0" className="h-8" />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleReceive} disabled={saving}>{saving ? 'Processing...' : 'Confirm Receipt'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}