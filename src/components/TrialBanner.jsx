import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, AlertCircle } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization.jsx';

export default function TrialBanner() {
  const { currentOrg } = useOrganization();

  if (!currentOrg) return null;

  const isTrial = currentOrg.subscription_status === 'trial';
  const isExpired = currentOrg.subscription_status === 'past_due' || currentOrg.subscription_status === 'suspended';

  if (!isTrial && !isExpired) return null;

  const trialEnd = currentOrg.trial_ends_at ? new Date(currentOrg.trial_ends_at) : null;
  const daysLeft = trialEnd ? Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  if (isExpired) {
    return (
      <Link to="/subscription" className="block">
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center gap-2 text-xs text-red-700 hover:bg-red-100 transition">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Subscription needs attention</span>
          <span className="hidden sm:inline">— Click here to update your payment method</span>
        </div>
      </Link>
    );
  }

  if (!isTrial || !trialEnd) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <Link to="/subscription" className="block">
      <div className={`px-4 py-2 flex items-center gap-2 text-xs transition ${isUrgent ? 'bg-amber-50 border-b border-amber-100 text-amber-700 hover:bg-amber-100' : 'bg-blue-50 border-b border-blue-100 text-blue-700 hover:bg-blue-100'}`}>
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium">{daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : 'Trial expired'}</span>
        <span className="hidden sm:inline">on your {currentOrg.plan_type} trial — Click to choose a plan</span>
      </div>
    </Link>
  );
}