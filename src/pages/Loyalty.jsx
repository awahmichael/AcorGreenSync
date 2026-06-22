import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Star, Crown, Award, Gift } from 'lucide-react';
import { toast } from 'sonner';

const tierIcons = { Bronze: Star, Silver: Award, Gold: Crown, Platinum: Crown };

export default function Loyalty() {
  const [rules, setRules] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([base44.entities.LoyaltyRule.list('-created_date', 100), base44.entities.Customer.list()]);
      setRules(r); setCustomers(c);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const tierCounts = customers.reduce((acc, c) => { acc[c.tier] = (acc[c.tier] || 0) + 1; return acc; }, {});

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Loyalty Program</h1><p className="text-sm text-muted-foreground mt-0.5">Manage point earning rules, tier thresholds, and redemption options</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />New Rule</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {['Bronze', 'Silver', 'Gold', 'Platinum'].map(tier => {
          const Icon = tierIcons[tier] || Star;
          return (
            <div key={tier} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Icon className={`w-4 h-4 ${tier === 'Bronze' ? 'text-amber-700' : tier === 'Silver' ? 'text-gray-400' : tier === 'Gold' ? 'text-amber-500' : 'text-purple-500'}`} /><span className="text-sm font-semibold">{tier}</span></div>
              <div className="text-2xl font-bold">{tierCounts[tier] || 0}</div><div className="text-xs text-muted-foreground">customers</div>
            </div>
          );
        })}
      </div>
      {loading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Rule</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Details</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rules.map(r => (
                <tr key={r.id} className="hover:bg-muted/30"><td className="px-4 py-3 text-sm font-medium">{r.name}</td><td className="px-4 py-3 text-sm capitalize">{r.rule_type.replace(/_/g, ' ')}</td><td className="px-4 py-3 text-sm text-muted-foreground">{r.points_per_pound ? `${r.points_per_pound} pts/£` : r.min_spend_threshold ? `£${r.min_spend_threshold} → ${r.tier_name}` : r.points_required ? `${r.points_required} pts → £${r.reward_value}` : `${r.bonus_multiplier}x bonus`}</td><td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-3 text-right"><button onClick={async () => { await base44.entities.LoyaltyRule.delete(r.id); toast.success('Rule deleted'); load(); }} className="p-1.5 hover:bg-muted rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
              ))}
              {rules.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">No loyalty rules configured. Create one to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <LoyaltyRuleModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function LoyaltyRuleModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', rule_type: 'earning_rate', points_per_pound: 1, tier_name: '', min_spend_threshold: 0, points_required: 0, reward_value: 0, bonus_multiplier: 1, start_date: '', end_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name) { toast.error('Enter a rule name'); return; }
    setSaving(true);
    try { await base44.entities.LoyaltyRule.create({ ...form, is_active: true }); toast.success('Rule created'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>New Loyalty Rule</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Rule Name *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Earn 1 point per £1" /></div>
        <div className="space-y-1.5"><Label>Rule Type</Label><Select value={form.rule_type} onValueChange={v => set('rule_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="earning_rate">Earning Rate</SelectItem><SelectItem value="tier_threshold">Tier Threshold</SelectItem><SelectItem value="redemption">Redemption</SelectItem><SelectItem value="bonus_multiplier">Bonus Multiplier</SelectItem></SelectContent></Select></div>
        {form.rule_type === 'earning_rate' && <div className="space-y-1.5"><Label>Points per £1</Label><Input type="number" step="0.1" value={form.points_per_pound} onChange={e => set('points_per_pound', parseFloat(e.target.value) || 0)} /></div>}
        {form.rule_type === 'tier_threshold' && (<><div className="space-y-1.5"><Label>Tier Name</Label><Input value={form.tier_name} onChange={e => set('tier_name', e.target.value)} placeholder="e.g. Gold" /></div><div className="space-y-1.5"><Label>Min Spend (£)</Label><Input type="number" value={form.min_spend_threshold} onChange={e => set('min_spend_threshold', parseFloat(e.target.value) || 0)} /></div></>)}
        {form.rule_type === 'redemption' && (<><div className="space-y-1.5"><Label>Points Required</Label><Input type="number" value={form.points_required} onChange={e => set('points_required', parseInt(e.target.value) || 0)} /></div><div className="space-y-1.5"><Label>Reward Value (£)</Label><Input type="number" step="0.01" value={form.reward_value} onChange={e => set('reward_value', parseFloat(e.target.value) || 0)} /></div></>)}
        {form.rule_type === 'bonus_multiplier' && <div className="space-y-1.5"><Label>Multiplier</Label><Input type="number" step="0.1" value={form.bonus_multiplier} onChange={e => set('bonus_multiplier', parseFloat(e.target.value) || 1)} /></div>}
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div><div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Rule'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}