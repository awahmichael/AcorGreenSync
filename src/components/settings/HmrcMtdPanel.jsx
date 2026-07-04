import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Landmark, Link2, Unlink, ExternalLink, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useOrganization } from '@/hooks/useOrganization.jsx';

export default function HmrcMtdPanel() {
  const { organizationId, currentOrg } = useOrganization();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [vrn, setVrn] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      try {
        const configs = await base44.entities.HmrcMtdConfig.filter({ organization_id: organizationId });
        if (configs.length > 0) {
          setConfig(configs[0]);
          setVrn(configs[0].vrn || '');
        }
      } catch (err) {
        toast.error('Failed to load HMRC MTD config');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  const handleConnect = async () => {
    if (!vrn) {
      toast.error('Enter your VAT Registration Number');
      return;
    }
    const cleanVrn = vrn.replace(/\s/g, '').replace(/^GB/i, '');
    if (cleanVrn.length < 9) {
      toast.error('VRN looks too short — check your HMRC VAT number');
      return;
    }
    setConnecting(true);
    try {
      const resp = await base44.functions.invoke('connectHmrcMtd', {
        organization_id: organizationId,
        vrn: cleanVrn,
      });
      if (resp.data?.auth_url) {
        window.location.href = resp.data.auth_url;
      } else if (resp.data?.needs_platform_config) {
        toast.error('HMRC MTD is not yet configured at the platform level. Please contact support.');
      } else {
        toast.error(resp.data?.error || 'Failed to start HMRC connection');
      }
    } catch (err) {
      toast.error('Failed to connect to HMRC');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!config) return;
    setConnecting(true);
    try {
      await base44.entities.HmrcMtdConfig.update(config.id, { is_connected: false });
      setConfig({ ...config, is_connected: false });
      toast.success('HMRC MTD disconnected');
    } catch (err) {
      toast.error('Failed to disconnect');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading HMRC MTD settings...
      </div>
    );
  }

  const isConnected = config?.is_connected;

  return (
    <div className="bg-white rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
          <Landmark className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">HMRC Making Tax Digital</h2>
          <p className="text-xs text-muted-foreground">Connect your HMRC account to submit VAT returns directly to HMRC</p>
        </div>
        {isConnected ? (
          <span className="ml-auto bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Connected · VRN: {config.vrn}
          </span>
        ) : (
          <span className="ml-auto bg-muted text-muted-foreground text-xs font-medium px-2.5 py-1 rounded-full">
            Not Connected
          </span>
        )}
      </div>

      {isConnected ? (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-green-800">
            Your HMRC MTD account is connected with VRN <strong>{config.vrn}</strong>. You can submit 9-box VAT returns directly from the Tax Reports page. Token expires: {config.token_expires_at ? new Date(config.token_expires_at).toLocaleString('en-GB') : 'N/A'} (auto-renews).
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            Connect your HMRC account via Making Tax Digital (MTD) to submit VAT returns directly from AcorCloud. You'll be redirected to HMRC to authorize AcorCloud access — you can skip this and come back later.
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">VAT Registration Number (VRN)</Label>
            <Input value={vrn} onChange={e => setVrn(e.target.value)} placeholder="e.g. 123456789 or GB123456789" />
            <p className="text-xs text-muted-foreground">Your 9-digit HMRC VAT Registration Number. Found on your VAT certificate.</p>
          </div>
          <Button onClick={handleConnect} disabled={connecting} className="bg-primary hover:bg-primary/90">
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Connect to HMRC
          </Button>
        </div>
      )}

      {isConnected && (
        <Button onClick={handleDisconnect} disabled={connecting} variant="outline" className="text-destructive hover:bg-destructive/5">
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
          Disconnect HMRC
        </Button>
      )}

      <a href="https://www.gov.uk/guidance/making-tax-digital-for-vat" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
        Learn about Making Tax Digital for VAT <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}