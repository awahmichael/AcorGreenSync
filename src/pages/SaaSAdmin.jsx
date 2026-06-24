import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Store as StoreIcon, CreditCard, KeyRound, ChevronDown, ChevronRight, 
  Power, PowerOff, Activity, CheckCircle, XCircle, Building2, Globe
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  idle: 'bg-gray-100 text-gray-700',
  online: 'bg-green-100 text-green-700',
  offline: 'bg-gray-100 text-gray-500',
  busy: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700'
};

const PROVIDER_COLORS = {
  Stripe: 'bg-indigo-100 text-indigo-700',
  Adyen: 'bg-emerald-100 text-emerald-700',
  SumUp: 'bg-sky-100 text-sky-700',
  MoniePoint: 'bg-amber-100 text-amber-700',
  Squad: 'bg-purple-100 text-purple-700'
};

export default function SaaSAdmin() {
  const [stores, setStores] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedStore, setExpandedStore] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [storeData, termData, configData] = await Promise.all([
        base44.entities.Store.list('-created_date', 200),
        base44.entities.PaymentTerminal.list('-updated_date', 500),
        base44.entities.PaymentGatewayConfig.list('-updated_date', 200)
      ]);
      setStores(storeData || []);
      setTerminals(termData || []);
      setConfigs(configData || []);
    } catch (err) {
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getTerminalsForStore = (storeId) => terminals.filter(t => t.store_id === storeId);
  const getConfigsForStore = (storeId) => {
    const storeTerminals = getTerminalsForStore(storeId);
    const providers = [...new Set(storeTerminals.map(t => t.provider))];
    return configs.filter(c => providers.includes(c.provider));
  };

  const toggleTerminal = async (terminal) => {
    setTogglingId(terminal.id);
    try {
      await base44.entities.PaymentTerminal.update(terminal.id, { 
        is_active: !terminal.is_active,
        status: !terminal.is_active ? 'offline' : 'offline'
      });
      toast.success(terminal.is_active 
        ? `Terminal bricked for "${terminal.alias || terminal.terminal_id}"` 
        : `Terminal activated for "${terminal.alias || terminal.terminal_id}"`);
      loadData();
    } catch (err) {
      toast.error('Failed to toggle terminal');
    } finally {
      setTogglingId(null);
    }
  };

  // Platform-level stats
  const activeStores = stores.filter(s => s.is_active !== false).length;
  const totalTerminals = terminals.length;
  const activeTerminals = terminals.filter(t => t.is_active).length;
  const pairedTerminals = terminals.filter(t => t.is_paired).length;
  const onlineTerminals = terminals.filter(t => t.status === 'online').length;
  const totalConfigs = configs.length;
  const activeConfigs = configs.filter(c => c.is_active).length;

  const providersInUse = [...new Set(terminals.map(t => t.provider))];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">SaaS Platform Admin</h1>
        <p className="text-sm text-muted-foreground">Platform-wide view of all merchants, terminals, and gateway configurations</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-medium">Merchants</span>
          </div>
          <div className="text-2xl font-bold">{activeStores}</div>
          <div className="text-xs text-muted-foreground">{stores.length} total</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-medium">Terminals</span>
          </div>
          <div className="text-2xl font-bold">{totalTerminals}</div>
          <div className="text-xs text-green-600">{activeTerminals} active</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Paired</span>
          </div>
          <div className="text-2xl font-bold">{pairedTerminals}</div>
          <div className="text-xs text-muted-foreground">of {totalTerminals}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-medium">Online Now</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{onlineTerminals}</div>
          <div className="text-xs text-muted-foreground">live devices</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <KeyRound className="w-4 h-4" />
            <span className="text-xs font-medium">Gateway Configs</span>
          </div>
          <div className="text-2xl font-bold">{totalConfigs}</div>
          <div className="text-xs text-green-600">{activeConfigs} active</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Globe className="w-4 h-4" />
            <span className="text-xs font-medium">Providers</span>
          </div>
          <div className="text-2xl font-bold">{providersInUse.length}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {providersInUse.map(p => (
              <Badge key={p} className={PROVIDER_COLORS[p] || 'bg-gray-100 text-gray-700'}>{p}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Merchant List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Merchants</h2>

        {stores.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No merchants onboarded yet.</p>
          </div>
        ) : (
          stores.map(store => {
            const storeTerminals = getTerminalsForStore(store.id);
            const storeConfigs = getConfigsForStore(store.id);
            const activeTermCount = storeTerminals.filter(t => t.is_active).length;
            const pairedTermCount = storeTerminals.filter(t => t.is_paired).length;
            const onlineTermCount = storeTerminals.filter(t => t.status === 'online').length;
            const isExpanded = expandedStore === store.id;

            return (
              <div key={store.id} className="bg-white border border-border rounded-lg overflow-hidden">
                {/* Merchant Header */}
                <button
                  onClick={() => setExpandedStore(isExpanded ? null : store.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <StoreIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{store.name}</span>
                      {store.is_active !== false ? (
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500">Suspended</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {store.location}{store.region ? `, ${store.region}` : ''}{store.postcode ? ` ${store.postcode}` : ''}
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-bold">{storeTerminals.length}</div>
                      <div className="text-xs text-muted-foreground">Terminals</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">{onlineTermCount}</div>
                      <div className="text-xs text-muted-foreground">Online</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{pairedTermCount}</div>
                      <div className="text-xs text-muted-foreground">Paired</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{storeConfigs.length}</div>
                      <div className="text-xs text-muted-foreground">Gateways</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {storeTerminals.length > 0 && (
                      <div className="flex gap-1 mr-2">
                        {[...new Set(storeTerminals.map(t => t.provider))].map(p => (
                          <Badge key={p} className={PROVIDER_COLORS[p] || 'bg-gray-100'}>{p}</Badge>
                        ))}
                      </div>
                    )}
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                    {/* Terminals Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> Terminals ({storeTerminals.length})
                        </h4>
                        <div className="text-xs text-muted-foreground">
                          {activeTermCount} active · {storeTerminals.length - activeTermCount} inactive
                        </div>
                      </div>

                      {storeTerminals.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center bg-white rounded-md border border-dashed border-border">
                          No terminals registered for this merchant.
                        </p>
                      ) : (
                        <div className="border border-border rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr className="text-left text-xs uppercase text-muted-foreground">
                                <th className="px-3 py-2 font-semibold">Terminal</th>
                                <th className="px-3 py-2 font-semibold">Provider</th>
                                <th className="px-3 py-2 font-semibold">Status</th>
                                <th className="px-3 py-2 font-semibold">Paired</th>
                                <th className="px-3 py-2 font-semibold">Last Heartbeat</th>
                                <th className="px-3 py-2 font-semibold text-right">Toggle</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {storeTerminals.map(t => (
                                <tr key={t.id} className="hover:bg-muted/20">
                                  <td className="px-3 py-2.5">
                                    <div className="font-medium">{t.alias || t.terminal_id}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{t.terminal_id}</div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge className={PROVIDER_COLORS[t.provider] || 'bg-gray-100'}>{t.provider}</Badge>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge className={STATUS_COLORS[t.status] || STATUS_COLORS.offline}>{t.status}</Badge>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {t.is_paired
                                      ? <CheckCircle className="w-4 h-4 text-green-600" />
                                      : <XCircle className="w-4 h-4 text-muted-foreground" />}
                                  </td>
                                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                    {t.last_heartbeat
                                      ? new Date(t.last_heartbeat).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                      : 'Never'}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={togglingId === t.id}
                                      onClick={() => toggleTerminal(t)}
                                      className={t.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}
                                    >
                                      {togglingId === t.id ? (
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                      ) : t.is_active ? (
                                        <><PowerOff className="w-3.5 h-3.5" /> Brick</>
                                      ) : (
                                        <><Power className="w-3.5 h-3.5" /> Activate</>
                                      )}
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Gateway Configs Section */}
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                        <KeyRound className="w-4 h-4" /> Gateway Configurations ({storeConfigs.length})
                      </h4>

                      {storeConfigs.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center bg-white rounded-md border border-dashed border-border">
                          No gateway configurations for this merchant.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {storeConfigs.map(c => (
                            <div key={c.id} className="bg-white border border-border rounded-lg p-3 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{c.name}</span>
                                  <Badge className={PROVIDER_COLORS[c.provider] || 'bg-gray-100'}>{c.provider}</Badge>
                                </div>
                                <Badge variant={c.is_active ? 'default' : 'secondary'}>
                                  {c.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Environment: <span className="font-medium">{c.environment === 'sandbox' ? 'Sandbox (Test)' : 'Live (Production)'}</span>
                              </div>
                              {c.merchant_code && (
                                <div className="text-xs text-muted-foreground">
                                  Merchant: <span className="font-mono">{c.merchant_code}</span>
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                Secret Key: <span className="font-mono">{'•'.repeat(16)}</span>
                              </div>
                              {c.webhook_secret && (
                                <div className="text-xs text-muted-foreground">
                                  Webhook Secret: <span className="font-mono">{'•'.repeat(12)}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}