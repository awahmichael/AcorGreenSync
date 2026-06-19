import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ACTION_STYLE = {
  create: 'bg-green-50 text-green-700',
  update: 'bg-blue-50 text-blue-700',
  delete: 'bg-red-50 text-red-700',
  period_lock: 'bg-purple-50 text-purple-700',
  emission_resolve: 'bg-amber-50 text-amber-700',
};

export default function AuditLogPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.AuditLog.list('-performed_at', 200).then(setLogs).finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Action', 'Entity Type', 'Entity Ref', 'User', 'Notes'],
      ...logs.map(l => [
        new Date(l.performed_at).toLocaleString('en-GB'),
        l.action,
        l.entity_type,
        l.entity_ref || l.entity_id,
        l.user_name || '',
        l.notes || '',
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Audit log exported');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Immutable record of all data changes, period locks, and emission resolutions.</p>
        <Button size="sm" variant="outline" onClick={exportCSV} disabled={logs.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1" />Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Audit Trail</h3>
          <span className="text-xs text-muted-foreground">{logs.length} entries</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 opacity-30" />
            No audit entries yet. Actions like period locks and emission resolutions will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Entity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.performed_at).toLocaleString('en-GB')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_STYLE[l.action] || 'bg-muted text-muted-foreground'}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.entity_type}</td>
                    <td className="px-4 py-3 text-xs font-mono">{l.entity_ref || l.entity_id?.substring(0, 12) + '...'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.user_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{l.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}