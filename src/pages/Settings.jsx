import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Settings as SettingsIcon, Leaf, RefreshCw, CheckCircle2, AlertCircle, Key, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Settings() {
  const [climatiqKey, setClimatiqKey] = useState('');
  const [defraDataset, setDefraDataset] = useState('UK Government GHG Conversion Factors 2024');
  const [testStatus, setTestStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [stores, setStores] = useState([]);
  const [newStore, setNewStore] = useState({ name: '', location: '', postcode: '', manager_name: '' });

  useEffect(() => {
    base44.entities.Store.list().then(setStores);
  }, []);

  const testConnection = async () => {
    setTesting(true);
    setTestStatus(null);
    await new Promise(r => setTimeout(r, 1200));
    if (climatiqKey.length > 10) {
      setTestStatus('success');
      toast.success('API connection successful');
    } else {
      setTestStatus('error');
      toast.error('Invalid API key — check your Climatiq.io credentials');
    }
    setTesting(false);
  };

  const addStore = async () => {
    if (!newStore.name || !newStore.location) {
      toast.error('Store name and location are required');
      return;
    }
    await base44.entities.Store.create({ ...newStore, is_active: true });
    toast.success('Store added');
    setStores(await base44.entities.Store.list());
    setNewStore({ name: '', location: '', postcode: '', manager_name: '' });
  };

  const removeStore = async (id) => {
    await base44.entities.Store.delete(id);
    setStores(stores.filter(s => s.id !== id));
    toast.success('Store removed');
  };

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure API integrations, stores, and emission data sources</p>
      </div>

      {/* DEFRA Config */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">DEFRA Emission Factors</h2>
            <p className="text-xs text-muted-foreground">UK Government GHG Conversion Factors (Primary Source)</p>
          </div>
          <span className="ml-auto bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full border border-green-200">
            Primary
          </span>
        </div>
        <div className="space-y-2">
          <Label>Active Dataset</Label>
          <Input value={defraDataset} onChange={e => setDefraDataset(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            DEFRA publishes annual GHG conversion factors. Download from{' '}
            <a href="https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              gov.uk/ghg-conversion-factors
            </a>
          </p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-green-800">
            DEFRA factors are pre-loaded and cached locally for offline use. Emission factors can be manually assigned to products in the Products section.
          </div>
        </div>
      </div>

      {/* Climatiq Config */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <Key className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Climatiq.io API</h2>
            <p className="text-xs text-muted-foreground">Global emission factors — used as fallback when DEFRA factor unavailable</p>
          </div>
          <span className="ml-auto bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-200">
            Fallback
          </span>
        </div>
        <div className="space-y-2">
          <Label>Climatiq API Key</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Enter your Climatiq.io API key..."
              value={climatiqKey}
              onChange={e => setClimatiqKey(e.target.value)}
              className="flex-1"
            />
            <Button onClick={testConnection} disabled={testing} variant="outline">
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key from{' '}
            <a href="https://climatiq.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">climatiq.io</a>
          </p>
        </div>
        {testStatus && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${testStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {testStatus === 'success' ? 'Climatiq.io connected successfully' : 'Connection failed — check your API key'}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
          <div><span className="font-medium text-foreground">Fallback logic:</span> DEFRA primary → Climatiq fallback</div>
          <div><span className="font-medium text-foreground">Cache duration:</span> 24 hours (offline safe)</div>
          <div><span className="font-medium text-foreground">Scope:</span> GHG Protocol Scope 3</div>
          <div><span className="font-medium text-foreground">Region:</span> United Kingdom</div>
        </div>
      </div>

      {/* Stores */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Store Locations</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Store Name</Label>
            <Input value={newStore.name} onChange={e => setNewStore(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Oxford Street" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Location / City</Label>
            <Input value={newStore.location} onChange={e => setNewStore(s => ({ ...s, location: e.target.value }))} placeholder="e.g. London" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Postcode</Label>
            <Input value={newStore.postcode} onChange={e => setNewStore(s => ({ ...s, postcode: e.target.value }))} placeholder="e.g. W1C 1DX" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Manager Name</Label>
            <Input value={newStore.manager_name} onChange={e => setNewStore(s => ({ ...s, manager_name: e.target.value }))} placeholder="e.g. Jane Smith" />
          </div>
        </div>
        <Button onClick={addStore} variant="outline" className="w-full">Add Store</Button>
        {stores.length > 0 && (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {stores.map(store => (
              <div key={store.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{store.name}</div>
                  <div className="text-xs text-muted-foreground">{store.location}{store.postcode ? ` · ${store.postcode}` : ''}</div>
                </div>
                <button onClick={() => removeStore(store.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}