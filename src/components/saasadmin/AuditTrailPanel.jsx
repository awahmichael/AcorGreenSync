import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Search, Shield, History } from 'lucide-react';

const ACTION_COLORS = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  period_lock: 'bg-purple-100 text-purple-700',
  emission_resolve: 'bg-amber-100 text-amber-700'
};

export default function AuditTrailPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.AuditLog.list('-performed_at', 500);
        setLogs(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))].sort();

  const filtered = logs.filter(log => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return log.entity_ref?.toLowerCase().includes(q) || log.user_name?.toLowerCase().includes(q) || log.entity_type?.toLowerCase().includes(q) || log.notes?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by ref, user, or notes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="period_lock">Period Lock</SelectItem>
            <SelectItem value="emission_resolve">Emission Resolve</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Entity Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entityTypes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
          <History className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No audit log entries found.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Timestamp</th><th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Entity</th><th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">User</th><th className="px-4 py-3 font-semibold">Notes</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(0, 100).map(log => (
                <tr key={log.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{log.performed_at ? new Date(log.performed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="px-4 py-2.5"><Badge className={ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}>{log.action}</Badge></td>
                  <td className="px-4 py-2.5"><span className="font-medium">{log.entity_type || '—'}</span></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{log.entity_ref || log.entity_id?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-2.5">{log.user_name || 'System'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">Showing 100 of {filtered.length} entries. Refine your search to see more.</div>}
        </div>
      )}
    </div>
  );
}