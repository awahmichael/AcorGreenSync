import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Package, Users, UserCog, DollarSign, Tag, Settings, Leaf, Calendar, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportElementAsPDF, printElement } from '@/lib/reports/exportUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SalesReports from '@/components/reports/SalesReports';
import InventoryReports from '@/components/reports/InventoryReports';
import CustomerReports from '@/components/reports/CustomerReports';
import StaffReports from '@/components/reports/StaffReports';
import FinancialReports from '@/components/reports/FinancialReports';
import PromotionReports from '@/components/reports/PromotionReports';
import OperationalReports from '@/components/reports/OperationalReports';
import CarbonReports from '@/components/reports/CarbonReports';
import StoreCloseReports from '@/components/reports/StoreCloseReports';

const CATEGORIES = [
  { id: 'store_close', label: 'Store Close', icon: DollarSign, component: StoreCloseReports, count: 12 },
  { id: 'sales', label: 'Sales & Revenue', icon: TrendingUp, component: SalesReports, count: 20 },
  { id: 'inventory', label: 'Inventory', icon: Package, component: InventoryReports, count: 13 },
  { id: 'customer', label: 'Customer & CRM', icon: Users, component: CustomerReports, count: 8 },
  { id: 'staff', label: 'Staff & Employees', icon: UserCog, component: StaffReports, count: 5 },
  { id: 'financial', label: 'Financial', icon: DollarSign, component: FinancialReports, count: 9 },
  { id: 'promotions', label: 'Promotions', icon: Tag, component: PromotionReports, count: 4 },
  { id: 'operational', label: 'Operational', icon: Settings, component: OperationalReports, count: 7 },
  { id: 'carbon', label: 'Carbon & Sustainability', icon: Leaf, component: CarbonReports, count: 16 },
];

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('cat') || 'sales';
  const [period, setPeriod] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [exporting, setExporting] = useState(false);
  const reportsRef = useRef(null);

  const isCustom = period === 'custom';
  const dateRange = isCustom && customStart && customEnd ? { start: customStart, end: customEnd } : null;
  const computedPeriod = isCustom && dateRange
    ? Math.max(1, Math.ceil((new Date(customEnd) - new Date(customStart)) / (1000 * 60 * 60 * 24)) + 1)
    : parseInt(period);

  useEffect(() => {
    Promise.all([
      base44.entities.Transaction.list('-transaction_date', 500),
      base44.entities.Product.list('-updated_date', 500),
      base44.entities.Customer.list('-updated_date', 500),
      base44.entities.Supplier.list(),
      base44.entities.Promotion.list(),
      base44.entities.Return.list('-return_date', 200),
      base44.entities.Shift.list('-shift_start', 200),
      base44.entities.StockMovement.list('-movement_date', 500),
      base44.entities.Store.list(),
      base44.entities.CarbonTarget.list(),
      base44.entities.EmissionFactor.list(),
      base44.entities.AuditLog.list('-performed_at', 200),
      base44.entities.GiftCard.list('-issued_date', 200),
    ]).then(([
      transactions, products, customers, suppliers, promotions,
      returns, shifts, stockMovements, stores, carbonTargets, emissionFactors, auditLogs, giftCards
    ]) => {
      setData({ transactions, products, customers, suppliers, promotions, returns, shifts, stockMovements, stores, carbonTargets, emissionFactors, auditLogs, giftCards });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeCat = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  const ActiveComponent = activeCat?.component;

  const periodLabel = isCustom && dateRange
    ? `${customStart} to ${customEnd}`
    : period === '1' ? 'Today' : period === '7' ? 'Last 7 days' : period === '30' ? 'Last 30 days' : period === '90' ? 'Last 90 days' : period === '365' ? 'Last 12 months' : 'All time';

  const handleExportAllPDF = async () => {
    if (!reportsRef.current) return;
    setExporting(true);
    try {
      await exportElementAsPDF(reportsRef.current, `${activeCat?.id || 'reports'}-full-report.pdf`, `${activeCat?.label || 'Reports'} — Full Report`, `Period: ${periodLabel}`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrintAll = async () => {
    if (!reportsRef.current) return;
    setExporting(true);
    try {
      await printElement(reportsRef.current, `${activeCat?.label || 'Reports'} — Full Report`, `Period: ${periodLabel}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">94 reports across 9 categories — competitor-parity suite</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {isCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handlePrintAll} disabled={exporting || loading} className="h-9">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print All
          </Button>
          <Button size="sm" onClick={handleExportAllPDF} disabled={exporting || loading} className="h-9">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> {exporting ? 'Generating...' : 'Export All PDF'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setSearchParams({ cat: cat.id })}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              <span className={`text-xs ${activeCategory === cat.id ? 'text-primary-foreground/60' : 'text-muted-foreground/50'}`}>{cat.count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      ) : ActiveComponent ? (
        <div ref={reportsRef}>
          <ActiveComponent data={data} period={computedPeriod} dateRange={dateRange} />
        </div>
      ) : null}
    </div>
  );
}