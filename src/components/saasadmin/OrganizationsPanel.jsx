import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Plus, Pencil, Power, PowerOff, Store, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import OrganizationModal from '@/components/saasadmin/OrganizationModal';
import SubscribeButton from '@/components/saasadmin/SubscribeButton';

const PLAN_COLORS = {
  Starter: 'bg-blue-100 text-blue-700',
  Growth: 'bg-green-100 text-green-700',
  Enterprise: 'bg-purple-100 text-purple-700'
};

const STATUS_COLORS = {
  trial: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

const PLAN_DEFAULTS = {
  Starter: { max_locations: 1, max_skus: 5000, price: 29 },
  Growth: { max_locations: 5, max_skus: 50000, price: 79 },
  Enterprise: { max_locations: 999, max_skus: 999999, price: 0 }
};

export default function OrganizationsPanel({ onOrgsChange }) {
  const [orgs, setOrgs] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orgData, storeData] = await Promise.all([
        base44.entities.Organization.list('-created_date', 500),
        base44.entities.Store.list('-created_date', 500)
      ]);
      setOrgs(orgData || []);
      setStores(storeData || []);
    } catch (err) {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getStoresForOrg = (orgId) => stores.filter(s => s.organization_id === orgId || s.org_id === orgId);

  const toggleActive = async (org) => {
    setTogglingId(org.id);
    try {
      await base44.entities.Organization.update(org.id, {
        is_active: !org.is_active,
        subscription_status: !org.is_active ? 'suspended' : (org.subscription_status === 'suspended' ? 'active' : org.subscription_status)
      });
      toast.success(org.is_active ? `${org.name} suspended` : `${org.name} activated`);
      loadData();
      onOrgsChange?.();
    } catch (err) {
      toast.error('Failed to toggle organization');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaved = () => {
    loadData();
    onOrgsChange?.();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{orgs.length} organizations · {orgs.filter(o => o.subscription_status === 'active').length} active</p>
        <Button onClick={() => { setEditingOrg(null); setShowModal(true); }}><Plus className="w-4 h-4" /> New Organization</Button>
      </div>

      {orgs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">No organizations onboarded yet.</p>
          <Button onClick={() => { setEditingOrg(null); setShowModal(true); }}><Plus className="w-4 h-4" /> Create First Organization</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {orgs.map(org => {
            const orgStores = getStoresForOrg(org.id);
            const isExpanded = expandedOrg === org.id;
            const planPrice = PLAN_DEFAULTS[org.plan_type]?.price || 0;
            const mrr = org.subscription_status === 'active' ? (org.billing_cycle === 'annual' ? planPrice / 12 : planPrice) : 0;

            return (
              <div key={org.id} className="bg-white border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <button onClick={() => setExpandedOrg(isExpanded ? null : org.id)} className="flex items-center gap-4 flex-1 text-left hover:bg-muted/20 transition rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{org.name}</span>
                        <Badge className={PLAN_COLORS[org.plan_type] || 'bg-gray-100'}>{org.plan_type}</Badge>
                        {org.is_active ? (
                          <Badge className={STATUS_COLORS[org.subscription_status] || 'bg-gray-100'}>{org.subscription_status}</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">Inactive</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {org.billing_cycle || 'monthly'} billing · {orgStores.length}/{org.max_locations || '∞'} locations · {org.vat_number || 'No VAT number'}
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-sm">
                      <div className="text-center"><div className="font-bold">£{mrr.toFixed(2)}</div><div className="text-xs text-muted-foreground">MRR</div></div>
                      <div className="text-center"><div className="font-bold">{orgStores.length}</div><div className="text-xs text-muted-foreground">Stores</div></div>
                      <div className="text-center"><div className="font-bold">{org.dunning_retry_count || 0}</div><div className="text-xs text-muted-foreground">Retries</div></div>
                    </div>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingOrg(org); setShowModal(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={togglingId === org.id} onClick={() => toggleActive(org)}>
                      {togglingId === org.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
                        org.is_active ? <PowerOff className="w-4 h-4 text-red-600" /> : <Power className="w-4 h-4 text-green-600" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4 bg-muted/20 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-xs text-muted-foreground">Billing Email</span><div className="font-medium">{org.billing_email || '—'}</div></div>
                      <div><span className="text-xs text-muted-foreground">Country</span><div className="font-medium">{org.country_code || 'GB'}</div></div>
                      <div><span className="text-xs text-muted-foreground">Max SKUs</span><div className="font-medium">{org.max_skus?.toLocaleString() || '—'}</div></div>
                      <div><span className="text-xs text-muted-foreground">Stock Count Cycle</span><div className="font-medium capitalize">{org.stock_count_cycle || 'monthly'}</div></div>
                      <div><span className="text-xs text-muted-foreground">Trial Ends</span><div className="font-medium">{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString('en-GB') : '—'}</div></div>
                      <div><span className="text-xs text-muted-foreground">Period End</span><div className="font-medium">{org.current_period_end ? new Date(org.current_period_end).toLocaleDateString('en-GB') : '—'}</div></div>
                      <div><span className="text-xs text-muted-foreground">Stripe Customer</span><div className="font-mono text-xs">{org.stripe_customer_id || '—'}</div></div>
                      <div><span className="text-xs text-muted-foreground">Onboarding</span><div className="font-medium">{org.onboarding_completed ? '✅ Completed' : '⏳ Pending'}</div></div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Store className="w-4 h-4" /> Stores ({orgStores.length})</h4>
                      {orgStores.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-3 text-center bg-white rounded-md border border-dashed border-border">No stores provisioned for this organization.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {orgStores.map(s => (
                            <Badge key={s.id} variant="outline" className="py-1.5 px-3">{s.name} — {s.location}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {org.notes && <div className="text-sm bg-white rounded-md border border-border p-3"><span className="text-xs text-muted-foreground font-medium">Notes:</span> {org.notes}</div>}

                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground font-medium">Billing Actions:</span>
                      <SubscribeButton organization={org} billingCycle={org.billing_cycle || 'monthly'} variant="outline" size="sm">Manage Subscription</SubscribeButton>
                      {org.subscription_status === 'trial' && !org.stripe_customer_id && (
                        <SubscribeButton organization={org} billingCycle="monthly" size="sm">Start Paid Subscription</SubscribeButton>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && <OrganizationModal org={editingOrg} onClose={() => setShowModal(false)} onSaved={handleSaved} />}
    </div>
  );
}