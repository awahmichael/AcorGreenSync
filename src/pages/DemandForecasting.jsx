import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';

const trendIcons = { increasing: TrendingUp, stable: Minus, decreasing: TrendingDown };
const trendColors = { increasing: 'text-green-600 bg-green-50', stable: 'text-gray-500 bg-gray-50', decreasing: 'text-red-600 bg-red-50' };

export default function DemandForecasting() {
  const [forecasts, setForecasts] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => { setLoading(true); try { const [f, p, t] = await Promise.all([base44.entities.DemandForecast.list('-forecast_date', 200), base44.entities.Product.list(), base44.entities.Transaction.list('-transaction_date', 500)]); setForecasts(f); setProducts(p); setTransactions(t); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const generateForecasts = async () => {
    setGenerating(true);
    try {
      const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
      const recentTxns = transactions.filter(t => new Date(t.transaction_date) >= cutoff30);

      // Delete old forecasts
      await base44.entities.DemandForecast.deleteMany({});

      // Calculate per-product sales velocity
      const productSales = {};
      recentTxns.forEach(t => {
        (t.items || []).forEach(item => {
          if (!item.product_id) return;
          productSales[item.product_id] = productSales[item.product_id] || { name: item.product_name, totalQty: 0, sales: [] };
          productSales[item.product_id].totalQty += (item.quantity || 0);
          productSales[item.product_id].sales.push({ date: t.transaction_date, qty: item.quantity });
        });
      });

      const forecastDate = new Date().toISOString().split('T')[0];
      const forecastsToCreate = products.map(p => {
        const sales = productSales[p.id];
        const avgDaily = sales ? sales.totalQty / 30 : 0;
        const avgWeekly = avgDaily * 7;
        const currentStock = p.stock_quantity || 0;
        const daysOfStock = avgDaily > 0 ? Math.floor(currentStock / avgDaily) : 999;
        const reorderPoint = Math.ceil(avgWeekly * 2); // 2 weeks of stock
        const reorderQuantity = Math.ceil(avgWeekly * 4); // 4 weeks supply
        const lastSale = sales?.sales?.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date?.split('T')[0] || null;
        let trend = 'stable';
        if (sales && sales.sales.length >= 10) {
          const half = Math.floor(sales.sales.length / 2);
          const firstHalf = sales.sales.slice(0, half).reduce((s, x) => s + x.qty, 0);
          const secondHalf = sales.sales.slice(half).reduce((s, x) => s + x.qty, 0);
          if (secondHalf > firstHalf * 1.15) trend = 'increasing';
          else if (secondHalf < firstHalf * 0.85) trend = 'decreasing';
        }
        return { product_id: p.id, product_name: p.name, sku: p.sku || '', current_stock: currentStock, avg_daily_sales: parseFloat(avgDaily.toFixed(2)), avg_weekly_sales: parseFloat(avgWeekly.toFixed(2)), days_of_stock: daysOfStock === 999 ? 999 : daysOfStock, reorder_point: reorderPoint, reorder_quantity: reorderQuantity, trend, last_sale_date: lastSale, forecast_date: forecastDate, confidence_score: sales ? Math.min(100, sales.sales.length * 10) : 0 };
      });

      if (forecastsToCreate.length > 0) {
        await base44.entities.DemandForecast.bulkCreate(forecastsToCreate);
      }
      toast.success(`${forecastsToCreate.length} forecasts generated`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  // Sort by urgency (low days of stock first)
  const sorted = [...forecasts].sort((a, b) => (a.days_of_stock || 0) - (b.days_of_stock || 0));
  const needsReorder = sorted.filter(f => f.days_of_stock <= 14);
  const criticalStock = sorted.filter(f => f.days_of_stock <= 7);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Demand Forecasting</h1><p className="text-sm text-muted-foreground mt-0.5">Predictive replenishment based on 30-day sales velocity</p></div>
        <Button onClick={generateForecasts} disabled={generating} className="bg-primary hover:bg-primary/90"><RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />{generating ? 'Generating...' : 'Generate Forecasts'}</Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-border rounded-xl p-4"><div className="text-xs text-muted-foreground">Products Tracked</div><div className="text-xl font-bold">{forecasts.length}</div></div>
        <div className="bg-white border border-border rounded-xl p-4"><div className="text-xs text-muted-foreground">Need Reorder (≤14d)</div><div className="text-xl font-bold text-amber-600">{needsReorder.length}</div></div>
        <div className="bg-white border border-border rounded-xl p-4"><div className="text-xs text-muted-foreground">Critical (≤7d)</div><div className="text-xl font-bold text-red-600">{criticalStock.length}</div></div>
        <div className="bg-white border border-border rounded-xl p-4"><div className="text-xs text-muted-foreground">Avg Confidence</div><div className="text-xl font-bold">{forecasts.length > 0 ? Math.round(forecasts.reduce((s, f) => s + (f.confidence_score || 0), 0) / forecasts.length) : 0}%</div></div>
      </div>

      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div> : forecasts.length === 0 ? (
        <div className="text-center py-16"><Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" /><p className="text-muted-foreground">No forecasts generated yet. Click "Generate Forecasts" to analyze sales velocity.</p></div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Product</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Stock</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Daily Avg</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Weekly Avg</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Days Left</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Reorder At</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Reorder Qty</th><th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Trend</th><th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Confidence</th></tr></thead>
            <tbody className="divide-y divide-border">
              {sorted.map(f => { const TIcon = trendIcons[f.trend] || Minus; const isCritical = f.days_of_stock <= 7; const isLow = f.days_of_stock <= 14; return (
                <tr key={f.id} className={`hover:bg-muted/30 ${isCritical ? 'bg-red-50/30' : isLow ? 'bg-amber-50/20' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium">{f.product_name}{f.sku && <span className="text-xs text-muted-foreground ml-1.5 font-mono">{f.sku}</span>}</td>
                  <td className="px-4 py-3 text-sm text-right">{f.current_stock || 0}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{(f.avg_daily_sales || 0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{(f.avg_weekly_sales || 0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{f.days_of_stock === 999 ? '∞' : f.days_of_stock}{f.days_of_stock <= 7 && <AlertTriangle className="inline w-3 h-3 text-red-500 ml-1" />}</td>
                  <td className="px-4 py-3 text-sm text-right">{f.reorder_point || 0}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-primary">{f.reorder_quantity || 0}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${trendColors[f.trend]}`}><TIcon className="w-3 h-3" />{f.trend}</span></td>
                  <td className="px-4 py-3 text-center"><div className="inline-flex items-center gap-1"><div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${f.confidence_score || 0}%` }} /></div><span className="text-xs text-muted-foreground">{f.confidence_score || 0}%</span></div></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}