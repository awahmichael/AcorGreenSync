import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Mail, MessageSquare, Send, Eye, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';
import ScoutControlPanel from '@/components/marketing/ScoutControlPanel';
import LeadsPanel from '@/components/marketing/LeadsPanel';
import EmailLogPanel from '@/components/marketing/EmailLogPanel';

const statusColors = { draft: 'bg-gray-100 text-gray-700', scheduled: 'bg-blue-100 text-blue-700', sending: 'bg-amber-100 text-amber-700', sent: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

export default function Marketing() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => { setLoading(true); try { setCampaigns(await base44.entities.MarketingCampaign.list('-created_date', 100)); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const sendCampaign = async (c) => { try { await base44.entities.MarketingCampaign.update(c.id, { status: 'sent', sent_date: new Date().toISOString() }); toast.success('Campaign sent'); load(); } catch (e) { toast.error(e.message); } };
  const cancelCampaign = async (c) => { try { await base44.entities.MarketingCampaign.update(c.id, { status: 'cancelled' }); toast.success('Campaign cancelled'); load(); } catch (e) { toast.error(e.message); } };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Marketing Campaigns</h1><p className="text-sm text-muted-foreground mt-0.5">Email & SMS campaigns with customer segmentation</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Campaign</Button>
      </div>
      <ScoutControlPanel />
      <LeadsPanel />
      <EmailLogPanel />
      {loading ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {c.channel === 'email' ? <Mail className="w-4 h-4 text-blue-500" /> : c.channel === 'sms' ? <MessageSquare className="w-4 h-4 text-green-500" /> : <Send className="w-4 h-4 text-purple-500" />}
                  <span className="font-semibold text-foreground">{c.name}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[c.status]}`}>{c.status}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.subject || c.body?.substring(0, 80) || 'No content'}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span>Segment: <span className="font-medium capitalize">{c.segment}</span></span>
                {c.recipients_count > 0 && <span>Recipients: {c.recipients_count}</span>}
                {c.open_rate > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {c.open_rate}%</span>}
                {c.click_rate > 0 && <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {c.click_rate}%</span>}
              </div>
              <div className="flex gap-2">
                {(c.status === 'draft' || c.status === 'scheduled') && <Button size="sm" className="h-7 text-xs" onClick={() => sendCampaign(c)}><Send className="w-3 h-3 mr-1" />Send Now</Button>}
                {c.status !== 'sent' && c.status !== 'cancelled' && <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => cancelCampaign(c)}>Cancel</Button>}
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive ml-auto" onClick={async () => { await base44.entities.MarketingCampaign.delete(c.id); load(); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && <div className="col-span-2 text-center py-16 text-muted-foreground"><Mail className="w-12 h-12 mx-auto opacity-30 mb-3" /><p>No campaigns created yet.</p></div>}
        </div>
      )}
      {showModal && <CampaignModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function CampaignModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', channel: 'email', segment: 'all', subject: '', body: '', promo_code: '', scheduled_date: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.name) { toast.error('Enter campaign name'); return; }
    setSaving(true);
    try { await base44.entities.MarketingCampaign.create({ ...form, status: 'draft', is_active: true }); toast.success('Campaign created'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Marketing Campaign</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Campaign Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Channel</Label><Select value={form.channel} onValueChange={v => set('channel', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="sms">SMS</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Segment</Label><Select value={form.segment} onValueChange={v => set('segment', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Customers</SelectItem><SelectItem value="bronze">Bronze Tier</SelectItem><SelectItem value="silver">Silver Tier</SelectItem><SelectItem value="gold">Gold Tier</SelectItem><SelectItem value="platinum">Platinum Tier</SelectItem><SelectItem value="new_customers">New Customers</SelectItem><SelectItem value="inactive">Inactive Customers</SelectItem></SelectContent></Select></div>
        </div>
        {form.channel !== 'sms' && <div className="space-y-1.5"><Label>Subject Line</Label><Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Email subject..." /></div>}
        <div className="space-y-1.5"><Label>Message Body</Label><Textarea value={form.body} onChange={e => set('body', e.target.value)} rows={4} placeholder="Campaign message..." /></div>
        <div className="space-y-1.5"><Label>Linked Promo Code (optional)</Label><Input value={form.promo_code} onChange={e => set('promo_code', e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Campaign'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}