import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Leaf, AlertTriangle, ChevronRight, Building2, RefreshCw, TrendingDown } from 'lucide-react';
import UnmappedProductsModal from '@/components/saasadmin/UnmappedProductsModal';

export default function EmissionMappingPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getEmissionMappingOverview', {});
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!data) {
    return <div className="text-center py-16 text-muted-foreground">Failed to load emission mapping data.</div>;
  }

  const { summary, organizations } = data;

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-foreground mb-1"><Building2 className="w-4 h-4" /><span className="text-xs font-medium">Tenants with Unmapped</span></div>
          <div className="text-2xl font-bold">{summary.total_orgs_with_unmapped}</div>
          <div className="text-xs text-muted-foreground">need attention</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 mb-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs font-medium">Total Unmapped</span></div>
          <div className="text-2xl font-bold text-red-700">{summary.total_unmapped.toLocaleString()}</div>
          <div className="text-xs text-red-600">across all tenants</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-1"><Leaf className="w-4 h-4" /><span className="text-xs font-medium">Pending Mapping</span></div>
          <div className="text-2xl font-bold text-amber-700">{summary.total_pending.toLocaleString()}</div>
          <div className="text-xs text-amber-600">never attempted</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-1"><TrendingDown className="w-4 h-4" /><span className="text-xs font-medium">Avg per Tenant</span></div>
          <div className="text-2xl font-bold text-blue-700">{summary.avg_unmapped_per_org.toLocaleString()}</div>
          <div className="text-xs text-blue-600">unmapped products</div>
        </div>
      </div>

      {/* Aggregation table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Leaf className="w-4 h-4 text-primary" /> Emission Mapping Debt by Tenant</h3>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>

        {organizations.length === 0 ? (
          <div className="p-8 text-center text-green-700 text-sm flex flex-col items-center gap-2">
            <Leaf className="w-8 h-8 text-green-500" />
            All tenants have fully mapped emission factors. No mapping debt.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold text-center">Plan</th>
                <th className="px-4 py-3 font-semibold text-center">Pending</th>
                <th className="px-4 py-3 font-semibold text-center">Flagged</th>
                <th className="px-4 py-3 font-semibold text-center">Total Unmapped</th>
                <th className="px-4 py-3 font-semibold">Top Categories</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {organizations.map(org => (
                <tr key={org.org_id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedOrg(org)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{org.org_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{org.org_id === '_unassigned' ? 'no org' : org.org_id.slice(0, 12) + '…'}</div>
                  </td>
                  <td className="px-4 py-3 text-center"><Badge variant="outline" className="text-xs">{org.plan_type}</Badge></td>
                  <td className="px-4 py-3 text-center text-amber-700 font-medium">{org.pending_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center text-red-700 font-medium">{org.flagged_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${org.unmapped_count > 100 ? 'text-red-600' : org.unmapped_count > 10 ? 'text-amber-600' : 'text-foreground'}`}>
                      {org.unmapped_count.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {org.top_categories.map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.name} ({c.count})</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedOrg && (
        <UnmappedProductsModal org={selectedOrg} onClose={() => setSelectedOrg(null)} />
      )}
    </div>
  );
}