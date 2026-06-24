import React, { useState } from 'react';
import { Building2, DollarSign, Layers, AlertTriangle, History, Activity, Calculator } from 'lucide-react';
import OrganizationsPanel from '@/components/saasadmin/OrganizationsPanel';
import RevenueOverview from '@/components/saasadmin/RevenueOverview';
import PlansPricingPanel from '@/components/saasadmin/PlansPricingPanel';
import DunningPanel from '@/components/saasadmin/DunningPanel';
import AuditTrailPanel from '@/components/saasadmin/AuditTrailPanel';
import SystemHealthPanel from '@/components/saasadmin/SystemHealthPanel';
import SaaSAccounts from '@/components/saasadmin/SaaSAccounts';

const TABS = [
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'revenue', label: 'Revenue & Billing', icon: DollarSign },
  { id: 'accounts', label: 'Accounts', icon: Calculator },
  { id: 'plans', label: 'Plans & Pricing', icon: Layers },
  { id: 'dunning', label: 'Dunning', icon: AlertTriangle },
  { id: 'audit', label: 'Audit Trail', icon: History },
  { id: 'health', label: 'System Health', icon: Activity },
];

export default function SaaSAdmin() {
  const [activeTab, setActiveTab] = useState('organizations');

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" /> SaaS Platform Admin</h1>
        <p className="text-sm text-muted-foreground">Complete management cockpit for organizations, billing, plans, and platform health</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'organizations' && <OrganizationsPanel />}
      {activeTab === 'revenue' && <RevenueOverview />}
      {activeTab === 'accounts' && <SaaSAccounts />}
      {activeTab === 'plans' && <PlansPricingPanel />}
      {activeTab === 'dunning' && <DunningPanel />}
      {activeTab === 'audit' && <AuditTrailPanel />}
      {activeTab === 'health' && <SystemHealthPanel />}
    </div>
  );
}