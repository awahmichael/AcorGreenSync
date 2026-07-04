import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { FileBarChart, Printer, TrendingUp, RotateCcw, DollarSign, CreditCard, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';

export default function ZReport() {
  const [open, setOpen] = useState(false);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const { organizationId } = useOrganization();

  useEffect(() => {
    if (organizationId) {
      base44.entities.Store.filter({ organization_id: organizationId }).then(setStores);
    }
  }, [organizationId]);

  const generate = async () => {
    setLoading(true);
    setReport(null);
    try {
      const startOfDay = new Date(date + 'T00:00:00');
      const endOfDay = new Date(date + 'T23:59:59');

      const txns = await base44.entities.Transaction.filter({
        organization_id: organizationId,
        ...(storeId ? { store_id: storeId } : {}),
      }, '-transaction_date', 500);

      const dayTxns = txns.filter(t => {
        const td = new Date(t.transaction_date);
        return td >= startOfDay && td <= endOfDay && t.payment_status !== 'cancelled';
      });

      const returns = await base44.entities.Return.list('-return_date', 500);
      const dayReturns = returns.filter(r => {
        const rd = new Date(r.return_date);
        return rd >= startOfDay && rd <= endOfDay;
      });

      const grossSales = dayTxns.reduce((s, t) => s + (t.subtotal || t.total_amount || 0), 0);
      const discounts = dayTxns.reduce((s, t) => s + (t.discount_amount || 0), 0);
      const taxCollected = dayTxns.reduce((s, t) => s + (t.tax_amount || 0), 0);
      const netSales = grossSales - discounts;
      const tips = dayTxns.reduce((s, t) => s + (t.tip_amount || 0), 0);
      const carbonOffsets = dayTxns.reduce((s, t) => s + (t.carbon_offset_amount || 0), 0);
      const refundTotal = dayReturns.reduce((s, r) => s + (r.refund_amount || 0), 0);

      const byMethod = {};
      dayTxns.forEach(t => {
        const methods = t.split_payments?.length ? t.split_payments : [{ method: t.payment_method, amount: t.total_amount }];
        methods.forEach(p => {
          if (!byMethod[p.method]) byMethod[p.method] = 0;
          byMethod[p.method] += p.amount || 0;
        });
      });

      const totalCO2e = dayTxns.reduce((s, t) => s + (t.total_kg_co2e || 0), 0);

      setReport({
        date,
        transactionCount: dayTxns.length,
        grossSales,
        discounts,
        netSales,
        taxCollected,
        tips,
        carbonOffsets,
        refundTotal,
        netCash: (byMethod.cash || 0) - refundTotal,
        byMethod,
        totalCO2e,
        returns: dayReturns.length,
      });
    } catch (err) {
      toast.error('Failed to generate Z-Report');
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileBarChart className="w-4 h-4 mr-2" />
        Z-Report
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-primary" /> Z-Report (End of Day)
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Store (optional)</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="All stores" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Stores</SelectItem>
                  {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </div>

          {report && (
            <div className="receipt-print space-y-3 pt-2">
              <div className="text-center border-b border-dashed border-border pb-3">
                <div className="font-bold text-sm">Z-REPORT — END OF DAY</div>
                <div className="text-xs text-muted-foreground">{new Date(report.date).toLocaleDateString('en-GB')}</div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Transactions</span><span className="font-medium">{report.transactionCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Returns</span><span className="font-medium">{report.returns}</span></div>
                <div className="border-t border-dashed border-border my-1" />

                <div className="flex justify-between"><span className="text-muted-foreground">Gross Sales</span><span>£{report.grossSales.toFixed(2)}</span></div>
                <div className="flex justify-between text-red-500"><span>Discounts</span><span>-£{report.discounts.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold"><span>Net Sales</span><span>£{report.netSales.toFixed(2)}</span></div>
                <div className="border-t border-dashed border-border my-1" />

                <div className="flex justify-between"><span className="text-muted-foreground">VAT Collected</span><span>£{report.taxCollected.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tips</span><span>£{report.tips.toFixed(2)}</span></div>
                <div className="flex justify-between text-primary"><span>Carbon Offsets</span><span>£{report.carbonOffsets.toFixed(2)}</span></div>
                <div className="flex justify-between text-red-500"><span>Refunds</span><span>-£{report.refundTotal.toFixed(2)}</span></div>
              </div>

              <div className="border-t border-dashed border-border pt-2 space-y-1.5 text-sm">
                <div className="font-semibold mb-1">By Payment Method</div>
                {Object.entries(report.byMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between capitalize">
                    <span className="text-muted-foreground">{method}</span>
                    <span>£{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-border pt-2 space-y-1.5 text-sm">
                <div className="font-semibold mb-1">Carbon Summary</div>
                <div className="flex justify-between text-primary"><span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Total CO₂e</span><span>{report.totalCO2e.toFixed(3)} kg</span></div>
              </div>

              <div className="border-t border-dashed border-border pt-2 flex justify-between font-bold text-base">
                <span>Net Cash Expected</span>
                <span className="text-primary">£{report.netCash.toFixed(2)}</span>
              </div>

              <Button onClick={handlePrint} className="w-full mt-2">
                <Printer className="w-4 h-4 mr-2" /> Print Z-Report
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}