import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2 } from 'lucide-react';
import MerchantsPanel from '@/components/saasadmin/MerchantsPanel';
import RevenueOverview from '@/components/saasadmin/RevenueOverview';
import TaxCompliancePanel from '@/components/saasadmin/TaxCompliancePanel';
import MerchantHealth from '@/components/saasadmin/MerchantHealth';
import { toast } from 'sonner';

export default function SaaSAdmin() {
  const [activeTab, setActiveTab] = useState('merchants');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storeData = await base44.entities.Store.list('-created_date', 200);
        setStores(storeData || []);
      } catch (err) {
        toast.error('Failed to load platform data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tabs = [
    { id: 'merchants', label: 'Merchants' },
    { id: 'revenue', label: 'Revenue (MRR/ARR)' },
    { id: 'tax', label: 'Tax & Compliance' },
    { id: 'health', label: 'Merchant Health' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" /> SaaS Platform Admin</h1>
        <p className="text-sm text-muted-foreground">Platform-wide management cockpit for merchants, revenue, tax, and health monitoring</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'merchants' && <MerchantsPanel stores={stores} />}
      {activeTab === 'revenue' && <RevenueOverview />}
      {activeTab === 'tax' && <TaxCompliancePanel />}
      {activeTab === 'health' && <MerchantHealth />}
    </div>
  );
}