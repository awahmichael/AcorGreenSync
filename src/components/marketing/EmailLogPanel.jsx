import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const typeLabels = {
  welcome: 'Welcome Email',
  nurture_day1: 'Day 1 Follow-up',
  nurture_day4: 'Case Study',
  nurture_day10: 'Final Check-in',
  sales_notification: 'Sales Alert',
  campaign: 'Campaign Blast',
  scout_outreach: 'Scout Outreach',
};

const statusColors = {
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function EmailLogPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.MarketingEmailLog.list('-created_date', 100);
      setLogs(data || []);
    } catch (e) {
      toast.error('Failed to load email logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-white border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Email Activity Log</h2>
            <p className="text-xs text-muted-foreground">Every automated email the system sends</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Mail className="w-10 h-10 mx-auto opacity-30 mb-2" />
          <p className="text-sm">No emails sent yet. They'll appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                {log.status === 'sent'
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <XCircle className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{log.recipient_email}</span>
                  <Badge className={`text-xs ${statusColors[log.status] || 'bg-gray-100'}`}>{log.status}</Badge>
                  <span className="text-xs text-muted-foreground">{typeLabels[log.email_type] || log.email_type}</span>
                </div>
                <div className="text-sm text-foreground truncate mt-0.5">{log.subject}</div>
                {log.body_preview && <div className="text-xs text-muted-foreground truncate mt-0.5">{log.body_preview}</div>}
                {log.status === 'failed' && log.error_message && (
                  <div className="text-xs text-red-500 mt-1">⚠ {log.error_message}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(log.created_date).toLocaleString('en-GB', { day: 'short', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}