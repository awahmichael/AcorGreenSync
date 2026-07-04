import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Mail, Phone, Building2, Calendar, RefreshCw, MailOpen, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_STYLES = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  qualified: 'bg-purple-50 text-purple-700 border-purple-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  lost: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_FLOW = ['new', 'contacted', 'qualified', 'converted', 'lost'];

export default function LeadsPanel() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Lead.list('-created_date', 100);
      setLeads(data);
    } catch (err) {
      toast.error('Failed to load leads');
    }
    setLoading(false);
  };

  useEffect(() => { loadLeads(); }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      await base44.entities.Lead.update(id, { status: newStatus });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
      toast.success(`Lead marked as ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update lead');
    }
  };

  const filteredLeads = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };
  const conversionRate = stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">Total Leads</div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">New</div>
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">Contacted</div>
          <div className="text-2xl font-bold text-amber-600">{stats.contacted}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">Converted</div>
          <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-xs text-muted-foreground">Conversion Rate</div>
          <div className="text-2xl font-bold text-primary">{conversionRate}%</div>
        </div>
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${filter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-muted-foreground border-border'}`}>All ({stats.total})</button>
        {STATUS_FLOW.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition capitalize ${filter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-muted-foreground border-border'}`}>{s} ({leads.filter(l => l.status === s).length})</button>
        ))}
        <Button variant="ghost" size="sm" onClick={loadLeads} className="ml-auto"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
      </div>

      {/* Lead cards */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Users className="w-8 h-8 mx-auto mb-2 opacity-30" />No leads in this category yet.</div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.map(lead => {
            const daysAgo = Math.floor((Date.now() - new Date(lead.created_date).getTime()) / (1000 * 60 * 60 * 24));
            const currentIdx = STATUS_FLOW.indexOf(lead.status);
            const nextStatus = STATUS_FLOW[currentIdx + 1] && lead.status !== 'converted' && lead.status !== 'lost' ? STATUS_FLOW[currentIdx + 1] : null;

            return (
              <div key={lead.id} className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{lead.name || 'Unknown'}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_STYLES[lead.status] || 'bg-muted text-muted-foreground border-border'}`}>{lead.status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>}
                      {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>}
                      {lead.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {lead.company}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</span>
                      {lead.store_count > 1 && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {lead.store_count} stores</span>}
                    </div>
                    {lead.message && <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">"{lead.message}"</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {lead.status !== 'converted' && lead.status !== 'lost' && nextStatus && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(lead.id, nextStatus)} className="h-7 text-xs">
                        <MailOpen className="w-3 h-3" /> Mark {nextStatus}
                      </Button>
                    )}
                    {lead.status !== 'converted' && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(lead.id, 'lost')} className="h-7 text-xs text-muted-foreground">Mark Lost</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}