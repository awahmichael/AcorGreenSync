import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, Radar, Search, ChevronDown, ChevronUp, ExternalLink, Mail, Phone, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const leadStatusColors = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  qualified: 'bg-purple-100 text-purple-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-gray-100 text-gray-500',
  enriched: 'bg-teal-100 text-teal-700',
  promoted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

export default function LeadsPanel() {
  const [websiteLeads, setWebsiteLeads] = useState([]);
  const [scoutLeads, setScoutLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('website');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [wLeads, sLeads] = await Promise.all([
        base44.entities.Lead.list('-created_date', 200),
        base44.entities.Lead_Scout.list('-created_date', 200).catch(() => []),
      ]);
      setWebsiteLeads(wLeads || []);
      setScoutLeads(sLeads || []);
    } catch (e) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateLeadStatus = async (lead, newStatus) => {
    try {
      await base44.entities.Lead.update(lead.id, { status: newStatus });
      setWebsiteLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
      toast.success(`Marked as ${newStatus}`);
    } catch (e) { toast.error(e.message); }
  };

  const filteredWebsite = websiteLeads.filter(l =>
    !search || (l.name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase()) || l.company?.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredScout = scoutLeads.filter(l =>
    !search || (l.company_name?.toLowerCase().includes(search.toLowerCase()) || l.city?.toLowerCase().includes(search.toLowerCase()) || l.company_number?.includes(search))
  );

  const renderWebsiteLead = (lead) => {
    const expanded = expandedId === lead.id;
    return (
      <div key={lead.id} className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedId(expanded ? null : lead.id)}>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{lead.name || 'Unknown'}</span>
              <Badge className={`text-xs ${leadStatusColors[lead.status] || 'bg-gray-100'} capitalize`}>{lead.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">{lead.email} · {lead.company || 'No company'}</div>
          </div>
          <div className="text-xs text-muted-foreground flex-shrink-0">{lead.store_count || 1} store{(lead.store_count || 1) > 1 ? 's' : ''}</div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10">
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              {lead.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> {lead.phone}</div>}
              {lead.company && <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> {lead.company}</div>}
            </div>
            {lead.message && <p className="text-sm text-muted-foreground bg-white border border-border rounded-md p-3 mb-3">{lead.message}</p>}
            <div className="flex flex-wrap gap-2">
              {lead.status !== 'contacted' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateLeadStatus(lead, 'contacted')}>Mark Contacted</Button>}
              {lead.status !== 'qualified' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateLeadStatus(lead, 'qualified')}>Mark Qualified</Button>}
              {lead.status !== 'converted' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateLeadStatus(lead, 'converted')}>Mark Converted</Button>}
              {lead.status !== 'lost' && <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => updateLeadStatus(lead, 'lost')}>Mark Lost</Button>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderScoutLead = (lead) => {
    const expanded = expandedId === lead.id;
    return (
      <div key={lead.id} className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedId(expanded ? null : lead.id)}>
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Radar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{lead.company_name}</span>
              <Badge className={`text-xs ${leadStatusColors[lead.status] || leadStatusColors[lead.enrichment_status] || 'bg-gray-100'} capitalize`}>{lead.status || lead.enrichment_status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">{lead.company_number} · {lead.city || 'Unknown city'}</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/10">
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div><span className="text-muted-foreground">Status:</span> {lead.company_status || 'N/A'}</div>
              <div><span className="text-muted-foreground">Incorporated:</span> {lead.incorporation_date || 'N/A'}</div>
              <div><span className="text-muted-foreground">SIC Codes:</span> {(lead.sic_codes || []).join(', ') || 'N/A'}</div>
              <div><span className="text-muted-foreground">Scout City:</span> {lead.scout_city || 'N/A'}</div>
            </div>
            {lead.registered_address && <p className="text-sm text-muted-foreground bg-white border border-border rounded-md p-3 mb-3">{lead.registered_address}</p>}
            <div className="flex flex-wrap gap-2">
              {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline" className="h-7 text-xs"><ExternalLink className="w-3 h-3 mr-1" />Visit Website</Button></a>}
              {lead.contact_email && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`mailto:${lead.contact_email}`)}><Mail className="w-3 h-3 mr-1" />Email</Button>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const currentLeads = activeTab === 'website' ? filteredWebsite : filteredScout;
  const totalCount = activeTab === 'website' ? websiteLeads.length : scoutLeads.length;

  return (
    <div className="bg-white border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Leads Pipeline</h2>
          <p className="text-xs text-muted-foreground">Website inquiries & scouted companies</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setActiveTab('website')} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'website' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            <Globe className="w-3.5 h-3.5 inline mr-1" />Website ({websiteLeads.length})
          </button>
          <button onClick={() => setActiveTab('scout')} className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'scout' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            <Radar className="w-3.5 h-3.5 inline mr-1" />Scout ({scoutLeads.length})
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${activeTab === 'website' ? 'name, email, company...' : 'company name, city, number...'}`} className="pl-9 h-9 text-sm" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : currentLeads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {activeTab === 'website' ? <Globe className="w-10 h-10 mx-auto opacity-30 mb-2" /> : <Radar className="w-10 h-10 mx-auto opacity-30 mb-2" />}
          <p className="text-sm">No {activeTab === 'website' ? 'website' : 'scouted'} leads yet.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {currentLeads.map(lead => activeTab === 'website' ? renderWebsiteLead(lead) : renderScoutLead(lead))}
        </div>
      )}
    </div>
  );
}