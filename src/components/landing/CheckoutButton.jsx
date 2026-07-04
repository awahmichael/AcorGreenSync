import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function CheckoutButton({ planName, billingCycle = 'monthly', leadId, children, className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (window.self !== window.top) {
      toast.error('Checkout requires a published app. Please open in a new tab.');
      return;
    }
    setLoading(true);
    try {
      const response = await base44.functions.invoke('createPublicCheckoutSession', {
        plan_name: planName,
        billing_cycle: billingCycle,
        lead_id: leadId,
      });
      const { url, error } = response.data || {};
      if (error) {
        toast.error(error);
        setLoading(false);
        return;
      }
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      toast.error('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={className || 'w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60'}
    >
      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to checkout...</> : <>{children || 'Start Free Trial'}</>}
    </button>
  );
}