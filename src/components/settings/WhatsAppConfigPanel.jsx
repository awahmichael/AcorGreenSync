import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Save, Trash2, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';

export default function WhatsAppConfigPanel() {
  const { organizationId, currentOrg } = useOrganization();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone_number_id: '',
    api_token: '',
    business_phone_number: '',
    display_name: '',
    is_active: true,
  });

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      try {
        const configs = await base44.entities.WhatsAppConfig.filter({ organization_id: organizationId });
        if (configs.length > 0) {
          setConfig(configs[0]);
          setForm({
            phone_number_id: configs[0].phone_number_id || '',
            api_token: configs[0].api_token || '',
            business_phone_number: configs[0].business_phone_number || '',
            display_name: configs[0].display_name || currentOrg?.name || '',
            is_active: configs[0].is_active !== false,
          });
        } else {
          setForm(f => ({ ...f, display_name: currentOrg?.name || '' }));
        }
      } catch (err) {
        toast.error('Failed to load WhatsApp config');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId, currentOrg]);

  const handleSave = async () => {
    if (!form.phone_number_id || !form.api_token) {
      toast.error('Phone Number ID and API Token are required');
      return;
    }
    setSaving(true);
    try {
      if (config) {
        await base44.entities.WhatsAppConfig.update(config.id, { ...form });
      } else {
        await base44.entities.WhatsAppConfig.create({ ...form, organization_id: organizationId });
      }
      const refreshed = await base44.entities.WhatsAppConfig.filter({ organization_id: organizationId });
      if (refreshed.length > 0) setConfig(refreshed[0]);
      toast.success('WhatsApp configuration saved');
    } catch (err) {
      toast.error('Failed to save WhatsApp config');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await base44.entities.WhatsAppConfig.delete(config.id);
      setConfig(null);
      setForm({ phone_number_id: '', api_token: '', business_phone_number: '', display_name: currentOrg?.name || '', is_active: true });
      toast.success('WhatsApp config removed');
    } catch (err) {
      toast.error('Failed to remove config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading WhatsApp settings...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">WhatsApp Business API</h2>
          <p className="text-xs text-muted-foreground">Per-tenant WhatsApp Cloud API credentials for sending digital receipts</p>
        </div>
        {config && config.is_active ? (
          <span className="ml-auto bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="ml-auto bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 rounded-full">
            Not Connected
          </span>
        )}
      </div>

      {config ? (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-green-800">
            WhatsApp Business API is active. Digital receipts will be sent from <strong>{config.business_phone_number || 'your configured number'}</strong> as <strong>{config.display_name}</strong>.
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800">
            WhatsApp Business API is not configured. Tenants can still send receipts via WhatsApp app links as a fallback.
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Business Display Name</Label>
          <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Green Grocers Ltd" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">WhatsApp Phone Number ID *</Label>
          <Input value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} placeholder="e.g. 102938475610" />
          <p className="text-xs text-muted-foreground">From Meta Business Manager → WhatsApp Manager → Phone Numbers.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Permanent Access Token *</Label>
          <Input type="password" value={form.api_token} onChange={e => setForm(f => ({ ...f, api_token: e.target.value }))} placeholder="EAAG..." />
          <p className="text-xs text-muted-foreground">Generate a permanent system user token in Meta Business Manager.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Business Phone Number (with country code)</Label>
          <Input value={form.business_phone_number} onChange={e => setForm(f => ({ ...f, business_phone_number: e.target.value }))} placeholder="e.g. 447700900123" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {config ? 'Update' : 'Save'}
        </Button>
        {config && (
          <Button onClick={handleDelete} disabled={saving} variant="outline" className="text-destructive hover:bg-destructive/5">
            <Trash2 className="w-4 h-4" /> Remove
          </Button>
        )}
        <a href="https://business.facebook.com/whatsapp-manager" target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
          Meta Business Manager <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}