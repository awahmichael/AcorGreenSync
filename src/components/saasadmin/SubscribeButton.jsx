import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SubscribeButton({ organization, billingCycle = 'monthly', onSubscribed, variant = 'default', size = 'default', children }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (window.self !== window.top) {
      toast.error('Checkout requires a published app. Please open in a new tab.');
      return;
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('createCheckoutSession', {
        organization_id: organization.id,
        billing_cycle: billingCycle
      });
      const { url, error } = response.data || {};
      if (error) {
        toast.error(error);
        return;
      }
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      toast.error('Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} disabled={loading} onClick={handleCheckout}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      {children || 'Subscribe'}
    </Button>
  );
}