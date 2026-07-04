import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Building2, Store, Receipt, CheckCircle2, ArrowRight, ArrowLeft, Leaf, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/hooks/useOrganization.jsx';
import { toast } from 'sonner';
import HmrcOnboardingStep from '@/components/onboarding/HmrcOnboardingStep';

const STEPS = [
  { id: 'org', label: 'Organization', icon: Building2 },
  { id: 'store', label: 'Store Setup', icon: Store },
  { id: 'tax', label: 'Tax Config', icon: Receipt },
  { id: 'hmrc', label: 'HMRC MTD', icon: Landmark },
  { id: 'done', label: 'Complete', icon: CheckCircle2 },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { currentOrg, refreshCurrentOrg, reloadOrgs } = useOrganization();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [orgForm, setOrgForm] = useState({
    name: currentOrg?.name || '',
    billing_email: currentOrg?.billing_email || '',
    vat_number: currentOrg?.vat_number || '',
    country_code: currentOrg?.country_code || 'GB',
  });

  const [storeForm, setStoreForm] = useState({
    name: '', location: '', address: '', postcode: '', manager_name: '',
  });

  const [taxForm, setTaxForm] = useState({
    default_tax_rate: currentOrg?.default_tax_rate?.toString() || '20',
    stock_count_cycle: currentOrg?.stock_count_cycle || 'monthly',
  });

  // Redirect to dashboard if onboarding already completed
  useEffect(() => {
    if (currentOrg?.onboarding_completed) {
      navigate('/');
    }
  }, [currentOrg, navigate]);

  const saveOrgDetails = async () => {
    if (!orgForm.name) { toast.error('Organization name is required'); return false; }
    setSaving(true);
    try {
      await base44.entities.Organization.update(currentOrg.id, {
        name: orgForm.name,
        billing_email: orgForm.billing_email,
        vat_number: orgForm.vat_number,
        country_code: orgForm.country_code,
      });
      await refreshCurrentOrg();
      toast.success('Organization details saved');
      return true;
    } catch (err) {
      toast.error('Failed to save organization');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveStore = async () => {
    if (!storeForm.name || !storeForm.location) { toast.error('Store name and location are required'); return false; }
    setSaving(true);
    try {
      await base44.entities.Store.create({
        ...storeForm,
        organization_id: currentOrg.id,
        is_active: true,
      });
      toast.success('Store created');
      return true;
    } catch (err) {
      toast.error('Failed to create store');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveTaxConfig = async () => {
    setSaving(true);
    try {
      await base44.entities.Organization.update(currentOrg.id, {
        default_tax_rate: parseFloat(taxForm.default_tax_rate),
        stock_count_cycle: taxForm.stock_count_cycle,
      });
      await refreshCurrentOrg();
      toast.success('Tax configuration saved');
      return true;
    } catch (err) {
      toast.error('Failed to save tax config');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const completeOnboarding = async () => {
    setSaving(true);
    try {
      await base44.entities.Organization.update(currentOrg.id, {
        onboarding_completed: true,
        subscription_started_at: currentOrg.subscription_started_at || new Date().toISOString(),
      });
      await refreshCurrentOrg();
      await reloadOrgs();
      toast.success('Onboarding complete! Welcome to AcorCloud.');
      setStep(4);
    } catch (err) {
      toast.error('Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 0) {
      const ok = await saveOrgDetails();
      if (ok) setStep(1);
    } else if (step === 1) {
      const ok = await saveStore();
      if (ok) setStep(2);
    } else if (step === 2) {
      const ok = await saveTaxConfig();
      if (ok) setStep(3);
    } else if (step === 3) {
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg leading-tight">AcorCloud</div>
              <div className="text-primary text-xs font-medium">Green-Sync Setup</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold">Welcome to AcorCloud</h1>
          <p className="text-muted-foreground text-sm mt-1">Let's get your retail business ready in 3 quick steps.</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive ? 'border-primary bg-primary text-white' :
                    isDone ? 'border-primary bg-primary/10 text-primary' :
                    'border-border bg-white text-muted-foreground'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 -mt-5 ${i < step ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Organization Details</h2>
              <p className="text-sm text-muted-foreground">Tell us about your business. This information is used for billing and tax compliance.</p>
              <div className="space-y-3">
                <div>
                  <Label>Business Name *</Label>
                  <Input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Green Grocers Ltd" />
                </div>
                <div>
                  <Label>Billing Email</Label>
                  <Input type="email" value={orgForm.billing_email} onChange={e => setOrgForm(f => ({ ...f, billing_email: e.target.value }))} placeholder="finance@greengrocers.co.uk" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>VAT Registration Number</Label>
                    <Input value={orgForm.vat_number} onChange={e => setOrgForm(f => ({ ...f, vat_number: e.target.value }))} placeholder="GB123456789" />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Select value={orgForm.country_code} onValueChange={v => setOrgForm(f => ({ ...f, country_code: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="IE">Ireland</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Store Setup</h2>
              <p className="text-sm text-muted-foreground">Add your first retail location. You can add more stores later.</p>
              <div className="space-y-3">
                <div>
                  <Label>Store Name *</Label>
                  <Input value={storeForm.name} onChange={e => setStoreForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Oxford Street Branch" />
                </div>
                <div>
                  <Label>Location / City *</Label>
                  <Input value={storeForm.location} onChange={e => setStoreForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. London" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={storeForm.address} onChange={e => setStoreForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Oxford Street" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Postcode</Label>
                    <Input value={storeForm.postcode} onChange={e => setStoreForm(f => ({ ...f, postcode: e.target.value }))} placeholder="W1D 2HN" />
                  </div>
                  <div>
                    <Label>Manager Name</Label>
                    <Input value={storeForm.manager_name} onChange={e => setStoreForm(f => ({ ...f, manager_name: e.target.value }))} placeholder="Jane Smith" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Tax Configuration</h2>
              <p className="text-sm text-muted-foreground">Set your default VAT rate and stock counting cycle. These can be changed anytime in Settings.</p>
              <div className="space-y-3">
                <div>
                  <Label>Default VAT Rate (%)</Label>
                  <Select value={taxForm.default_tax_rate} onValueChange={v => setTaxForm(f => ({ ...f, default_tax_rate: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20% — Standard Rate</SelectItem>
                      <SelectItem value="5">5% — Reduced Rate</SelectItem>
                      <SelectItem value="0">0% — Zero Rated</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Most UK retail goods use the 20% standard rate.</p>
                </div>
                <div>
                  <Label>Stock Count Cycle</Label>
                  <Select value={taxForm.stock_count_cycle} onValueChange={v => setTaxForm(f => ({ ...f, stock_count_cycle: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="ad_hoc">Ad-hoc (Manual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">How often you'll be prompted to count inventory.</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <HmrcOnboardingStep
              organizationId={currentOrg.id}
              onSkip={handleNext}
              saving={saving}
            />
          )}

          {step === 4 && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-semibold text-xl">You're all set!</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your AcorCloud workspace is ready. Head to your dashboard to start adding products, processing sales, and tracking your carbon footprint.
              </p>
              <Button onClick={() => navigate('/')} className="bg-primary hover:bg-primary/90">
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
              <Button variant="ghost" onClick={handleBack} disabled={step === 0}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              {step === 3 ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={handleNext} disabled={saving} className="text-muted-foreground">
                    Skip for now <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button onClick={handleNext} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Saving...</>
                    ) : (
                      <>Complete Setup <CheckCircle2 className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </div>
              ) : (
                <Button onClick={handleNext} disabled={saving} className="bg-primary hover:bg-primary/90">
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Saving...</>
                  ) : (
                    <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}