import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HmrcCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setStatus('error');
      return;
    }

    (async () => {
      try {
        const resp = await base44.functions.invoke('handleHmrcCallback', { code, state });
        if (resp.data?.success) {
          setStatus('success');
          setTimeout(() => navigate('/settings'), 3000);
        } else {
          setStatus('error');
        }
      } catch (err) {
        setStatus('error');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-border shadow-sm p-8 text-center space-y-4">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="font-semibold text-lg">Connecting to HMRC...</h2>
            <p className="text-sm text-muted-foreground">Please wait while we complete the authorization with HMRC MTD.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-semibold text-lg">HMRC MTD Connected!</h2>
            <p className="text-sm text-muted-foreground">Your VAT returns can now be submitted directly to HMRC. Redirecting to Settings...</p>
            <Button onClick={() => navigate('/settings')} className="bg-primary hover:bg-primary/90">Go to Settings</Button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="font-semibold text-lg">Connection Failed</h2>
            <p className="text-sm text-muted-foreground">We couldn't connect to HMRC. Please try again from Settings → HMRC MTD.</p>
            <Button onClick={() => navigate('/settings')} variant="outline">Back to Settings</Button>
          </>
        )}
      </div>
    </div>
  );
}