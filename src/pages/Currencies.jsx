import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, RefreshCw, Globe, PoundSterling } from 'lucide-react';
import { toast } from 'sonner';

const presetCurrencies = [
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 1, base: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1.27, base: false },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 1.17, base: false },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 195.5, base: false },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate: 1.93, base: false },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rate: 1.74, base: false },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', rate: 1.11, base: false },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 9.24, base: false },
];

export default function Currencies() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [convertAmount, setConvertAmount] = useState('100');
  const [convertFrom, setConvertFrom] = useState('GBP');
  const [convertTo, setConvertTo] = useState('USD');

  const load = async () => { setLoading(true); try { let r = await base44.entities.CurrencyRate.list('-last_updated', 50); if (r.length === 0) { r = await base44.entities.CurrencyRate.bulkCreate(presetCurrencies.map(c => ({ currency_code: c.code, currency_name: c.name, symbol: c.symbol, exchange_rate: c.rate, is_base_currency: c.base, is_active: true, last_updated: new Date().toISOString() }))); } setRates(r); } catch { toast.error('Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const updateRate = async (rate, newRate) => { try { await base44.entities.CurrencyRate.update(rate.id, { exchange_rate: parseFloat(newRate), last_updated: new Date().toISOString() }); toast.success(`${rate.currency_code} rate updated`); load(); } catch (e) { toast.error(e.message); } };

  const fromRate = rates.find(r => r.currency_code === convertFrom);
  const toRate = rates.find(r => r.currency_code === convertTo);
  const convertResult = (() => { const amt = parseFloat(convertAmount) || 0; if (!fromRate || !toRate) return 0; const inGBP = amt / (fromRate.exchange_rate || 1); return inGBP * (toRate.exchange_rate || 1); })();

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Multi-Currency</h1><p className="text-sm text-muted-foreground mt-0.5">Exchange rates and currency conversion — base currency: GBP</p></div>
        <Button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />Add Currency</Button>
      </div>

      {/* Currency Converter */}
      <div className="bg-white border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4"><Globe className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Currency Converter</span></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={convertAmount} onChange={e => setConvertAmount(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>From</Label><select value={convertFrom} onChange={e => setConvertFrom(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">{rates.map(r => <option key={r.id} value={r.currency_code}>{r.currency_code} — {r.currency_name}</option>)}</select></div>
          <div className="space-y-1.5"><Label>To</Label><select value={convertTo} onChange={e => setConvertTo(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">{rates.map(r => <option key={r.id} value={r.currency_code}>{r.currency_code} — {r.currency_name}</option>)}</select></div>
          <div className="bg-primary/10 rounded-lg p-3"><div className="text-xs text-muted-foreground">Result</div><div className="text-lg font-bold text-primary">{toRate?.symbol}{convertResult.toFixed(2)}</div></div>
        </div>
      </div>

      {/* Rate table */}
      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div> : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border"><tr><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Code</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Currency</th><th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Symbol</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Rate (vs GBP)</th><th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Last Updated</th><th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th><th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rates.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-bold font-mono">{r.currency_code}{r.is_base_currency && <span className="ml-1 text-xs text-primary">BASE</span>}</td>
                  <td className="px-4 py-3 text-sm">{r.currency_name}</td>
                  <td className="px-4 py-3 text-sm text-center text-lg">{r.symbol}</td>
                  <td className="px-4 py-3 text-right"><input type="number" step="0.0001" defaultValue={r.exchange_rate} onBlur={e => { if (parseFloat(e.target.value) !== r.exchange_rate) updateRate(r, e.target.value); }} className="w-24 text-right text-sm rounded border border-transparent hover:border-border focus:border-input focus:ring-1 focus:ring-ring bg-transparent px-2 py-1" /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.last_updated ? new Date(r.last_updated).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3 text-right">{!r.is_base_currency && <button onClick={async () => { await base44.entities.CurrencyRate.delete(r.id); toast.success('Currency removed'); load(); }} className="p-1.5 hover:bg-muted rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <CurrencyModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function CurrencyModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ currency_code: '', currency_name: '', symbol: '', exchange_rate: 1 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.currency_code || !form.currency_name) { toast.error('Code and name required'); return; }
    setSaving(true);
    try { await base44.entities.CurrencyRate.create({ ...form, currency_code: form.currency_code.toUpperCase(), exchange_rate: parseFloat(form.exchange_rate) || 1, is_base_currency: false, is_active: true, last_updated: new Date().toISOString() }); toast.success('Currency added'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Add Currency</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Code (ISO)</Label><Input value={form.currency_code} onChange={e => set('currency_code', e.target.value.toUpperCase())} placeholder="USD" maxLength={3} /></div><div className="space-y-1.5"><Label>Symbol</Label><Input value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="$" /></div></div>
        <div className="space-y-1.5"><Label>Currency Name</Label><Input value={form.currency_name} onChange={e => set('currency_name', e.target.value)} placeholder="US Dollar" /></div>
        <div className="space-y-1.5"><Label>Exchange Rate (vs £1 GBP)</Label><Input type="number" step="0.0001" value={form.exchange_rate} onChange={e => set('exchange_rate', e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Add Currency'}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}