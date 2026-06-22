import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function PODetailModal({ po, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{po.po_ref}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Supplier:</span> <span className="font-medium">{po.supplier_name}</span></div>
            <div><span className="text-muted-foreground">Store:</span> <span className="font-medium">{po.store_name || '—'}</span></div>
            <div><span className="text-muted-foreground">Order Date:</span> <span className="font-medium">{po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}</span></div>
            <div><span className="text-muted-foreground">Expected:</span> <span className="font-medium">{po.expected_delivery_date || '—'}</span></div>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Product</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Ordered</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Received</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Unit Cost</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Line Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(po.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-sm">{item.product_name}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.quantity_ordered}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.quantity_received || 0}</td>
                    <td className="px-3 py-2 text-sm text-right">£{(item.unit_cost || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-sm font-medium text-right">£{(item.line_cost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>£{(po.subtotal || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>£{(po.shipping_cost || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Duty</span><span>£{(po.duty_cost || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><span>£{(po.insurance_cost || 0).toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-border pt-1.5"><span className="font-semibold">Landed Cost Total</span><span className="font-bold text-primary">£{(po.landed_cost_total || 0).toFixed(2)}</span></div>
          </div>
          {po.notes && <div className="text-sm bg-muted/30 rounded-lg p-3"><span className="text-muted-foreground text-xs">Notes: </span>{po.notes}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}