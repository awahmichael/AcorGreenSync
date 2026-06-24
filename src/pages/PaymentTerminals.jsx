import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, CreditCard, KeyRound, Trash2, Pencil, CheckCircle, XCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';
import TerminalModal from '@/components/payments/TerminalModal';
import GatewayConfigModal from '@/components/payments/GatewayConfigModal';

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

export default function PaymentTerminals() {
  const [tab, setTab] = useState('terminals');
  const [terminals, setTerminals] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [terminalModalOpen, setTerminalModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState(null);
  const [editingConfig, setEditingConfig] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [termData, configData, storeData] = await Promise.all([
        base44.entities.PaymentTerminal.list('-updated_date', 100),
        base44.entities.PaymentGatewayConfig.list('-updated_date', 50),
        base44.entities.Store.list('-updated_date', 50)
      ]);
      setTerminals(termData || []);
      setConfigs(configData || []);
      setStores(storeData || []);
    } catch (err) {
      toast.error('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveTerminal = async (data) => {
    try {
      if (editingTerminal) {
        await base44.entities.PaymentTerminal.update(editingTerminal.id, data);
        toast.success('Terminal updated');
      } else {
        await base44.entities.PaymentTerminal.create(data);
        toast.success('Terminal registered');
      }
      setTerminalModalOpen(false);
      setEditingTerminal(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save terminal');
    }
  };

  const handleSaveConfig = async (data) => {
    try {
      if (editingConfig) {
        await base44.entities.PaymentGatewayConfig.update(editingConfig.id, data);
        toast.success('Gateway config updated');
      } else {
        await base44.entities.PaymentGatewayConfig.create(data);
        toast.success('Gateway config created');
      }
      setConfigModalOpen(false);
      setEditingConfig(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save config');
    }
  };

  const handleDeleteTerminal = async (t) => {
    if (!confirm(`Delete terminal "${t.alias || t.terminal_id}"?`)) return;
    try {
      await base44.entities.PaymentTerminal.delete(t.id);
      toast.success('Terminal deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete terminal');
    }
  };

  const handleDeleteConfig = async (c) => {
    if (!confirm(`Delete gateway config "${c.name}"?`)) return;
    try {
      await base44.entities.PaymentGatewayConfig.delete(c.id);
      toast.success('Config deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete config');
    }
  };

  const toggleTerminalActive = async (t) => {
    try {
      await base44.entities.PaymentTerminal.update(t.id, { is_active: !t.is_active });
      toast.success(t.is_active ? 'Terminal deactivated (bricked)' : 'Terminal activated');
      loadData();
    } catch (err) {
      toast.error('Failed to toggle terminal');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payment Terminals</h1>
          <p className="text-sm text-muted-foreground">Register devices and configure gateway credentials</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('terminals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'terminals' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <CreditCard className="w-4 h-4" /> Terminals ({terminals.length})
        </button>
        <button
          onClick={() => setTab('configs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'configs' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <KeyRound className="w-4 h-4" /> Gateway Configs ({configs.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : tab === 'terminals' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingTerminal(null); setTerminalModalOpen(true); }}>
              <Plus className="w-4 h-4" /> Register Terminal
            </Button>
          </div>

          {terminals.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-lg">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No terminals registered yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Register a terminal to start accepting card payments.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Terminal</th>
                    <th className="px-4 py-3 font-semibold">Provider</th>
                    <th className="px-4 py-3 font-semibold">Store</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Paired</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {terminals.map(t => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.alias || t.terminal_id}</div>
                        <div className="text-xs text-muted-foreground font-mono">{t.terminal_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={PROVIDER_COLORS[t.provider] || 'bg-gray-100 text-gray-700'}>{t.provider}</Badge>
                      </td>
                      <td className="px-4 py-3">{t.store_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[t.status] || STATUS_COLORS.offline}>{t.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {t.is_paired
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <XCircle className="w-4 h-4 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingTerminal(t); setTerminalModalOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleTerminalActive(t)} title={t.is_active ? 'Deactivate (brick)' : 'Activate'}>
                            {t.is_active
                              ? <Activity className="w-3.5 h-3.5 text-green-600" />
                              : <Activity className="w-3.5 h-3.5 text-muted-foreground" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTerminal(t)}>
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingConfig(null); setConfigModalOpen(true); }}>
              <Plus className="w-4 h-4" /> Add Gateway Config
            </Button>
          </div>

          {configs.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-lg">
              <KeyRound className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No gateway configurations yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add your Stripe, Adyen, SumUp, MoniePoint, or Squad credentials to enable payments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configs.map(c => (
                <div key={c.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {c.name}
                        <Badge className={PROVIDER_COLORS[c.provider] || 'bg-gray-100'}>{c.provider}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.environment === 'sandbox' ? 'Sandbox (Test)' : 'Live (Production)'}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingConfig(c); setConfigModalOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(c)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  {c.merchant_code && (
                    <div className="text-xs text-muted-foreground">Merchant: <span className="font-mono">{c.merchant_code}</span></div>
                  )}
                  <div className="text-xs text-muted-foreground">Secret Key: <span className="font-mono">{'•'.repeat(12)}</span></div>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TerminalModal
        open={terminalModalOpen}
        onClose={() => { setTerminalModalOpen(false); setEditingTerminal(null); }}
        terminal={editingTerminal}
        stores={stores}
        gatewayConfigs={configs}
        onSave={handleSaveTerminal}
      />
      <GatewayConfigModal
        open={configModalOpen}
        onClose={() => { setConfigModalOpen(false); setEditingConfig(null); }}
        config={editingConfig}
        onSave={handleSaveConfig}
      />
    </div>
  );
}