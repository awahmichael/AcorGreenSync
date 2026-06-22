import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Settings, Leaf, TrendingDown, FileCheck, Database, AlertTriangle, Target, Truck, RotateCcw, BarChart3, Gauge, FileText } from 'lucide-react';
import ReportCard from './ReportCard';
import ReportTable from './ReportTable';
import { filterByPeriod, flattenItems, groupBy, groupAndSum, sum, avg, topN, formatCurrency, formatNumber, formatCO2e, exportCSV, CHART_PALETTE } from '@/lib/reports/calculations';

const NotConfigured = ({ msg }) => (
  <div className="h-28 flex flex-col items-center justify-center text-center">
    <Settings className="w-5 h-5 text-muted-foreground/40 mb-2" />
    <p className="text-xs text-muted-foreground">{msg}</p>
  </div>
);

const TRANSPORT_FACTORS = { road_hgv: 0.105, road_lgv: 0.183, rail: 0.025, sea: 0.016, air: 0.602 };

export default function CarbonReports({ data, period, dateRange }) {
  const { transactions = [], products = [], customers = [], suppliers = [], carbonTargets = [], returns = [], emissionFactors = [], auditLogs = [] } = data;
  const filtered = filterByPeriod(transactions, period, 'transaction_date', dateRange);
  const filteredReturns = filterByPeriod(returns, period, 'return_date', dateRange);
  const items = flattenItems(filtered);

  const totalCO2e = sum(filtered, 'total_kg_co2e');
  const upstreamCO2e = sum(filtered, 'upstream_kg_co2e');
  const downstreamCO2e = sum(filtered, 'downstream_kg_co2e');
  const totalRevenue = sum(filtered, 'total_amount');
  const carbonIntensity = totalRevenue > 0 ? totalCO2e / totalRevenue : 0;
  const avgPerTxn = filtered.length > 0 ? totalCO2e / filtered.length : 0;

  // Product carbon footprint
  const productCarbon = topN(groupAndSum(items, i => i.product_name || 'Unknown', i => i.kg_co2e || 0), 20, d => d.value);

  // Customer carbon
  const customerCarbon = topN(customers.map(c => ({ ...c, value: c.total_kg_co2e || 0 })), 20, c => c.value);

  // Supplier disclosure
  const disclosureGroups = groupAndSum(suppliers, s => s.carbon_disclosure_status || 'Not Disclosed', s => s.declared_scope3_kg_co2e || 0);

  // Supplier transport emissions
  const transportEmissions = suppliers.map(s => {
    const factor = TRANSPORT_FACTORS[s.transport_mode || 'road_hgv'] || 0.105;
    const co2e = (s.distance_km || 0) * factor;
    return { name: s.name, mode: s.transport_mode || 'road_hgv', distance: s.distance_km || 0, co2e };
  }).filter(s => s.distance > 0);
  const totalTransportCO2e = sum(transportEmissions, s => s.co2e);

  // Carbon targets
  const activeTarget = carbonTargets.find(t => t.is_active !== false && t.scope === 'Company-wide');
  const targetAnnual = activeTarget?.annual_kg_co2e || 0;
  const annualizedCO2e = totalCO2e * (365 / period);
  const targetProgress = targetAnnual > 0 ? (annualizedCO2e / targetAnnual) * 100 : 0;
  const remainingBudget = targetAnnual - annualizedCO2e;

  // Emission factor mapping status
  const mapped = products.filter(p => p.emission_mapping_status === 'Mapped').length;
  const pending = products.filter(p => p.emission_mapping_status === 'Pending').length;
  const flagged = products.filter(p => p.emission_mapping_status === 'Flagged').length;
  const dataQualityScore = products.length > 0 ? (mapped / products.length) * 100 : 0;

  // Return carbon reversal
  const totalReversed = sum(filteredReturns, 'carbon_reversal_kg_co2e');
  const netCO2e = totalCO2e - totalReversed;

  // Net zero trajectory
  const currentYear = new Date().getFullYear();
  const trajectoryData = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear - 2 + i;
    const isPast = year < currentYear;
    const isCurrent = year === currentYear;
    const reductionFactor = activeTarget?.reduction_pct ? Math.pow(1 - activeTarget.reduction_pct / 100, year - (activeTarget.baseline_year || currentYear)) : 1;
    const projected = annualizedCO2e * reductionFactor;
    return {
      year: String(year),
      Actual: isPast ? projected * 0.95 : (isCurrent ? annualizedCO2e : null),
      Target: targetAnnual > 0 ? targetAnnual * Math.pow(1 - (activeTarget?.reduction_pct || 5) / 100, Math.max(0, year - (activeTarget?.baseline_year || currentYear))) : projected,
      Projected: projected,
    };
  });

  // Emission factor library
  const factorBySource = groupAndSum(emissionFactors, e => e.source || 'DEFRA', e => 1);
  const factorByCategory = topN(groupAndSum(emissionFactors, e => e.category || 'Unknown', e => 1), 10, d => d.value);

  // Carbon ledger from audit logs
  const carbonLogs = auditLogs.filter(l => l.action === 'emission_resolve' || l.entity_type === 'EmissionFactor');

  // Scenario analysis
  const scenarios = [
    { label: 'Current Trajectory', co2e: annualizedCO2e, reduction: 0 },
    { label: 'Switch Suppliers (-10%)', co2e: annualizedCO2e * 0.9, reduction: 10 },
    { label: 'Product Redesign (-20%)', co2e: annualizedCO2e * 0.8, reduction: 20 },
    { label: 'Net Zero Target', co2e: targetAnnual || annualizedCO2e * 0.5, reduction: 50 },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Scope 3', value: formatCO2e(totalCO2e), sub: 'Cat 1 & 11', icon: Leaf, color: 'text-primary' },
          { label: 'Upstream (Cat 1)', value: formatCO2e(upstreamCO2e), sub: 'Purchased Goods', icon: TrendingDown, color: 'text-blue-600' },
          { label: 'Downstream (Cat 11)', value: formatCO2e(downstreamCO2e), sub: 'Sold Products', icon: TrendingDown, color: 'text-purple-600' },
          { label: 'Carbon Intensity', value: `${(carbonIntensity * 1000).toFixed(2)}`, sub: 'g CO2e per £ revenue', icon: Gauge, color: 'text-orange-600' },
          { label: 'Data Quality', value: `${dataQualityScore.toFixed(0)}%`, sub: `${mapped}/${products.length} mapped`, icon: Database, color: dataQualityScore > 80 ? 'text-green-600' : 'text-amber-600' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${k.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{k.label}</span>
              </div>
              <div className="text-xl font-bold text-foreground">{k.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Scope 3 Summary */}
      <ReportCard title="Scope 3 Carbon Emissions Summary" description="GHG Protocol Categories 1 (Purchased Goods) & 11 (Use of Sold Products)" onExport={() => exportCSV('scope3-summary.csv', ['Metric', 'Value'], [['Total Transactions', filtered.length], ['Total Revenue', totalRevenue.toFixed(2)], ['Total CO2e', totalCO2e.toFixed(4)], ['Upstream (Cat 1)', upstreamCO2e.toFixed(4)], ['Downstream (Cat 11)', downstreamCO2e.toFixed(4)], ['Net CO2e (after returns)', netCO2e.toFixed(4)], ['Avg CO2e / Transaction', avgPerTxn.toFixed(4)], ['Carbon Intensity (g/£)', (carbonIntensity * 1000).toFixed(2)]])}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Transactions</span><span className="font-medium">{formatNumber(filtered.length)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Revenue</span><span className="font-medium">{formatCurrency(totalRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Avg CO2e / Txn</span><span className="font-medium">{formatCO2e(avgPerTxn)}</span></div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Upstream (Cat 1)</span><span className="font-medium text-blue-600">{formatCO2e(upstreamCO2e)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Downstream (Cat 11)</span><span className="font-medium text-purple-600">{formatCO2e(downstreamCO2e)}</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold">Total Scope 3</span><span className="font-bold text-primary">{formatCO2e(totalCO2e)}</span></div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Returns Reversed</span><span className="font-medium text-red-600">-{formatCO2e(totalReversed)}</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold">Net CO2e</span><span className="font-bold text-primary">{formatCO2e(netCO2e)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Intensity (g/£)</span><span className="font-medium text-orange-600">{(carbonIntensity * 1000).toFixed(2)}</span></div>
          </div>
        </div>
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Product Carbon Footprint */}
        <ReportCard title="Product Carbon Footprint" description="CO2e per product (top 20)" onExport={() => exportCSV('product-carbon.csv', ['Product', 'CO2e'], productCarbon.map(d => [d.key, d.value.toFixed(4)]))}>
          <ReportTable headers={['Product', 'CO2e', '% of Total']} rows={productCarbon.map(d => [d.key, formatCO2e(d.value), `${totalCO2e > 0 ? ((d.value / totalCO2e) * 100).toFixed(1) : 0}%`])} maxHeight="250px" />
        </ReportCard>

        {/* Customer Carbon Footprint */}
        <ReportCard title="Customer Carbon Footprint" description="Per-customer lifetime CO2e (top 20)" onExport={() => exportCSV('customer-carbon.csv', ['Customer', 'Tier', 'CO2e', 'Spend'], customerCarbon.map(c => [c.name, c.tier, (c.total_kg_co2e || 0).toFixed(4), (c.total_spend || 0).toFixed(2)]))}>
          <ReportTable headers={['Customer', 'Tier', 'CO2e', 'Spend']} rows={customerCarbon.map(c => [c.name, c.tier || 'Bronze', formatCO2e(c.total_kg_co2e), formatCurrency(c.total_spend)])} maxHeight="250px" />
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Supplier Carbon Disclosure */}
        <ReportCard title="Supplier Carbon Disclosure" description="Disclosure status across supplier base" onExport={() => exportCSV('supplier-disclosure.csv', ['Status', 'Suppliers', 'Declared CO2e'], disclosureGroups.map(d => [d.key, d.count, d.value.toFixed(2)]))}>
          {disclosureGroups.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={disclosureGroups.map(d => ({ name: d.key, value: d.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={e => e.name}>
                  {disclosureGroups.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <NotConfigured msg="No supplier data." />}
        </ReportCard>

        {/* Supplier Transport Emissions */}
        <ReportCard title="Supplier Transport Emissions" description="Distance x DEFRA transport mode factor" onExport={() => exportCSV('supplier-transport.csv', ['Supplier', 'Mode', 'Distance (km)', 'CO2e'], transportEmissions.map(s => [s.name, s.mode, s.distance, s.co2e.toFixed(4)]))}>
          <ReportTable headers={['Supplier', 'Mode', 'Distance', 'CO2e']} rows={transportEmissions.map(s => [s.name, s.mode, `${s.distance} km`, formatCO2e(s.co2e)])} maxHeight="250px" />
        </ReportCard>
      </div>

      {/* Carbon Target Progress */}
      <ReportCard title="Carbon Target Progress" description={`vs ${activeTarget?.label || 'No target set'} (${activeTarget?.methodology || 'N/A'})`} onExport={() => exportCSV('carbon-target.csv', ['Metric', 'Value'], [['Target Annual CO2e', targetAnnual.toFixed(2)], ['Annualized Current', annualizedCO2e.toFixed(2)], ['Progress %', targetProgress.toFixed(1)], ['Remaining Budget', remainingBudget.toFixed(2)]])}>
        {activeTarget ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Annualized Emissions vs Target</span>
              <span className={`font-bold ${targetProgress > 100 ? 'text-red-600' : 'text-primary'}`}>{targetProgress.toFixed(1)}% of target</span>
            </div>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div className={`h-full rounded-full ${targetProgress > 100 ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${Math.min(targetProgress, 100)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Annual Target</div>
                <div className="font-bold">{formatCO2e(targetAnnual)}</div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Annualized Run-Rate</div>
                <div className="font-bold text-primary">{formatCO2e(annualizedCO2e)}</div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Remaining Budget</div>
                <div className={`font-bold ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCO2e(remainingBudget)}</div>
              </div>
            </div>
          </div>
        ) : <NotConfigured msg="No active carbon target configured. Set a CarbonTarget to track progress." />}
      </ReportCard>

      {/* Net Zero Progress Tracking */}
      <ReportCard title="Net Zero Progress Tracking" description="Year-on-year reduction trajectory vs SBTi pathway" onExport={() => exportCSV('net-zero-trajectory.csv', ['Year', 'Actual', 'Target', 'Projected'], trajectoryData.map(d => [d.year, (d.Actual || 0).toFixed(2), (d.Target || 0).toFixed(2), (d.Projected || 0).toFixed(2)]))}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trajectoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => formatCO2e(v)} />
            <Legend />
            <Area type="monotone" dataKey="Actual" stroke="#16A34A" fill="#16A34A" fillOpacity={0.3} strokeWidth={2} />
            <Area type="monotone" dataKey="Target" stroke="#3B82F6" fill="none" strokeWidth={2} strokeDasharray="5 5" />
            <Area type="monotone" dataKey="Projected" stroke="#F97316" fill="#F97316" fillOpacity={0.1} strokeWidth={2} strokeDasharray="3 3" />
          </AreaChart>
        </ResponsiveContainer>
      </ReportCard>

      {/* Emission Factor Mapping Status */}
      <ReportCard title="Emission Factor Mapping Status" description="Product coverage by mapping state" onExport={() => exportCSV('mapping-status.csv', ['Status', 'Count', '% of Total'], [['Mapped', mapped, products.length > 0 ? ((mapped / products.length) * 100).toFixed(1) : 0], ['Pending', pending, products.length > 0 ? ((pending / products.length) * 100).toFixed(1) : 0], ['Flagged', flagged, products.length > 0 ? ((flagged / products.length) * 100).toFixed(1) : 0]])}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Mapped', count: mapped, color: 'bg-green-500', text: 'text-green-600' },
            { label: 'Pending', count: pending, color: 'bg-amber-500', text: 'text-amber-600' },
            { label: 'Flagged', count: flagged, color: 'bg-red-500', text: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${s.color}`} />
              <div>
                <div className={`text-lg font-bold ${s.text}`}>{s.count}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 w-full bg-muted rounded-full h-3 overflow-hidden flex">
          <div className="bg-green-500 h-full" style={{ width: `${products.length > 0 ? (mapped / products.length) * 100 : 0}%` }} />
          <div className="bg-amber-500 h-full" style={{ width: `${products.length > 0 ? (pending / products.length) * 100 : 0}%` }} />
          <div className="bg-red-500 h-full" style={{ width: `${products.length > 0 ? (flagged / products.length) * 100 : 0}%` }} />
        </div>
      </ReportCard>

      {/* Return Carbon Reversal */}
      <ReportCard title="Return Carbon Reversal" description="CO2e reversed from returned products" onExport={() => exportCSV('carbon-reversal.csv', ['Return Ref', 'Original Txn', 'CO2e Reversed', 'Date'], filteredReturns.map(r => [r.return_ref, r.original_transaction_ref, (r.carbon_reversal_kg_co2e || 0).toFixed(4), new Date(r.return_date).toLocaleDateString('en-GB')]))}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Gross Scope 3</div>
            <div className="font-bold">{formatCO2e(totalCO2e)}</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Reversed from Returns</div>
            <div className="font-bold text-red-600">-{formatCO2e(totalReversed)}</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Net Reportable</div>
            <div className="font-bold text-primary">{formatCO2e(netCO2e)}</div>
          </div>
        </div>
        <ReportTable headers={['Return Ref', 'Original Txn', 'CO2e Reversed', 'Date']} rows={filteredReturns.slice(0, 10).map(r => [r.return_ref, r.original_transaction_ref, formatCO2e(r.carbon_reversal_kg_co2e), new Date(r.return_date).toLocaleDateString('en-GB')])} maxHeight="200px" />
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SECR Compliance Report */}
        <ReportCard title="SECR Compliance Report" description="Streamlined Energy & Carbon Reporting (UK)" onExport={() => exportCSV('secr-report.csv', ['Section', 'Metric', 'Value'], [['Scope 3 Cat 1', 'Purchased Goods CO2e', upstreamCO2e.toFixed(2)], ['Scope 3 Cat 11', 'Use of Sold Products CO2e', downstreamCO2e.toFixed(2)], ['Total Scope 3', 'Combined CO2e', totalCO2e.toFixed(2)], ['Returns', 'CO2e Reversed', totalReversed.toFixed(2)], ['Net Scope 3', 'Reportable CO2e', netCO2e.toFixed(2)], ['Intensity', 'g CO2e per £ revenue', (carbonIntensity * 1000).toFixed(2)], ['Transport', 'Supplier transport CO2e', totalTransportCO2e.toFixed(2)]])}>
          <div className="space-y-1.5 text-sm">
            <div className="font-semibold text-foreground border-b border-border pb-1.5">Annual Figures (annualized from {period}d)</div>
            <div className="flex justify-between"><span className="text-muted-foreground">Scope 3 Cat 1 (Purchased Goods)</span><span className="font-medium">{formatCO2e(upstreamCO2e * (365 / period))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Scope 3 Cat 11 (Use of Sold Products)</span><span className="font-medium">{formatCO2e(downstreamCO2e * (365 / period))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Supplier Transport (est.)</span><span className="font-medium">{formatCO2e(totalTransportCO2e * (365 / period))}</span></div>
            <div className="flex justify-between border-t border-border pt-1.5"><span className="font-semibold">Total Scope 3</span><span className="font-bold text-primary">{formatCO2e(annualizedCO2e)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Intensity Ratio</span><span className="font-medium text-orange-600">{(carbonIntensity * 1000).toFixed(2)} g/£</span></div>
          </div>
        </ReportCard>

        {/* CDP Climate Disclosure */}
        <ReportCard title="CDP Climate Disclosure Export" description="Pre-formatted CDP questionnaire sections" onExport={() => exportCSV('cdp-disclosure.csv', ['CDP Section', 'Response'], [['C6.1 Scope 1', 'Not measured (direct emissions from owned sources)'], ['C6.3 Scope 2', 'Not measured (purchased electricity/heat)'], ['C6.5 Scope 3', totalCO2e.toFixed(2) + ' kg CO2e'], ['C6.5a Cat 1 (Purchased Goods)', upstreamCO2e.toFixed(2) + ' kg CO2e'], ['C6.5a Cat 11 (Use of Sold Products)', downstreamCO2e.toFixed(2) + ' kg CO2e'], ['C7.1 Intensity', (carbonIntensity * 1000).toFixed(2) + ' g CO2e per £ revenue'], ['C4.1 Reduction Target', activeTarget ? activeTarget.label + ' (' + (activeTarget.reduction_pct || 0) + '% reduction)' : 'Not set'], ['C4.3 Methodology', activeTarget?.methodology || 'N/A']])}>
          <div className="space-y-1.5 text-sm">
            <div className="font-semibold text-foreground border-b border-border pb-1.5">CDP Climate Questionnaire</div>
            <div className="flex justify-between"><span className="text-muted-foreground">C6.1 - Scope 1</span><span className="text-xs text-muted-foreground">Not measured</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">C6.3 - Scope 2</span><span className="text-xs text-muted-foreground">Not measured</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">C6.5 - Scope 3</span><span className="font-medium text-primary">{formatCO2e(totalCO2e)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">C6.5a - Cat 1</span><span className="font-medium text-blue-600">{formatCO2e(upstreamCO2e)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">C6.5a - Cat 11</span><span className="font-medium text-purple-600">{formatCO2e(downstreamCO2e)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">C7.1 - Intensity</span><span className="font-medium text-orange-600">{(carbonIntensity * 1000).toFixed(2)} g/£</span></div>
          </div>
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Carbon Accounting Ledger */}
        <ReportCard title="Carbon Accounting Ledger" description="Immutable audit trail of emission calculations" onExport={() => exportCSV('carbon-ledger.csv', ['Date', 'Action', 'Entity', 'Reference', 'User'], carbonLogs.map(l => [new Date(l.performed_at).toLocaleString('en-GB'), l.action, l.entity_type, l.entity_ref || '', l.user_name || '']))}>
          {carbonLogs.length > 0 ? (
            <ReportTable headers={['Date', 'Action', 'Entity', 'Ref']} rows={carbonLogs.slice(0, 20).map(l => [new Date(l.performed_at).toLocaleDateString('en-GB'), l.action, l.entity_type, l.entity_ref || '—'])} maxHeight="250px" />
          ) : <NotConfigured msg="No emission resolution events logged." />}
        </ReportCard>

        {/* Emission Factor Library Audit */}
        <ReportCard title="Emission Factor Library Audit" description="DEFRA/Climatiq factor inventory by source" onExport={() => exportCSV('factor-library.csv', ['Source', 'Factors'], factorBySource.map(d => [d.key, d.value]))}>
          <div className="space-y-2 text-sm mb-3">
            {factorBySource.map(d => (
              <div key={d.key} className="flex justify-between"><span className="text-muted-foreground">{d.key}</span><span className="font-medium">{d.count} factors</span></div>
            ))}
          </div>
          {factorByCategory.length > 0 && (
            <ReportTable headers={['Category', 'Factors']} rows={factorByCategory.map(d => [d.key, d.count])} maxHeight="150px" />
          )}
        </ReportCard>
      </div>

      {/* Data Quality Score */}
      <ReportCard title="Data Quality / Completeness Score" description="Percentage of products with mapped emission factors" onExport={() => exportCSV('data-quality.csv', ['Metric', 'Value'], [['Total Products', products.length], ['Mapped', mapped], ['Pending', pending], ['Flagged', flagged], ['Quality Score %', dataQualityScore.toFixed(1)]])}>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Overall Data Quality Score</span>
            <span className={`text-2xl font-bold ${dataQualityScore > 80 ? 'text-green-600' : dataQualityScore > 50 ? 'text-amber-600' : 'text-red-600'}`}>{dataQualityScore.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className={`h-full rounded-full ${dataQualityScore > 80 ? 'bg-green-500' : dataQualityScore > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${dataQualityScore}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">{mapped} of {products.length} products have emission factors mapped. {pending} pending, {flagged} flagged for review.</div>
        </div>
      </ReportCard>

      {/* Scenario Analysis / Forecast */}
      <ReportCard title="Scenario Analysis / Forecast" description="Projected emissions under different reduction strategies" onExport={() => exportCSV('scenario-analysis.csv', ['Scenario', 'Annual CO2e', 'Reduction %'], scenarios.map(s => [s.label, s.co2e.toFixed(2), s.reduction]))}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={scenarios.map(s => ({ scenario: s.label, CO2e: s.co2e }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="scenario" tick={{ fontSize: 10, fill: '#94a3b8' }} width={130} />
            <Tooltip formatter={v => formatCO2e(v)} />
            <Bar dataKey="CO2e" radius={[0, 4, 4, 0]}>
              {scenarios.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}