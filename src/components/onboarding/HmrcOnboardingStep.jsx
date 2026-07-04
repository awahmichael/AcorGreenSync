import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Landmark, Link2, Loader2, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function HmrcOnboardingStep({ organizationId, onSkip, saving }) {
  const [vrn, setVrn] = useState('');
  const [config, setConfig] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      try {
        const configs = await base44.entities.HmrcMtdConfig.filter({ organization_id: organizationId });
        if (configs.length > 0) setConfig(configs[0]);
      } catch {
        // ignore
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
        toast.error('HMRC MTD is not yet configured at the platform level. You can skip this and connect later from Settings.');
      } else {
        toast.error(resp.data?.error || 'Failed to start HMRC connection');
      }
    } catch {
      toast.error('Failed to connect to HMRC');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg flex items-center gap-2">
        <Landmark className="w-5 h-5 text-primary" /> HMRC Making Tax Digital (Optional)
      </h2>
      <p className="text-sm text-muted-foreground">
        Connect your HMRC account to submit VAT returns directly from AcorCloud. This is optional — you can skip and connect later from Settings.
      </p>

      {config?.is_connected ? (
        <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <strong>HMRC MTD connected!</strong> VRN: {config.vrn}. You can submit VAT returns directly from Tax Reports.
          </div>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              When you click "Connect to HMRC", you'll be redirected to HMRC's website to authorize AcorCloud. After authorization, you'll return to complete onboarding.
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>VAT Registration Number (VRN)</Label>
            <Input value={vrn} onChange={e => setVrn(e.target.value)} placeholder="e.g. 123456789 or GB123456789" />
            <p className="text-xs text-muted-foreground">Your 9-digit HMRC VAT Registration Number from your VAT certificate.</p>
          </div>
          <Button onClick={handleConnect} disabled={connecting} variant="outline" className="w-full">
            {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Connect to HMRC
          </Button>
        </>
      )}
    </div>
  );
}