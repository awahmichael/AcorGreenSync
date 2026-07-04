import { useState } from 'react';
import { CreditCard, Banknote, Smartphone, Globe, Leaf, Split, Plus, X, ShieldCheck, Loader2, Heart, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const METHODS = [
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'contactless', label: 'Contactless', icon: Smartphone },
  { id: 'online', label: 'Online', icon: Globe },
];

const TIP_PRESETS = [0, 1, 2, 3, 5];

export default function PaymentModal({ total, co2e, onConfirm, onClose, needsAgeVerification, ageRestrictionType }) {
  const [mode, setMode] = useState('single'); // 'single' | 'split'
  const [splitPayments, setSplitPayments] = useState([{ method: 'card', amount: total.toFixed(2) }]);
  const [tipAmount, setTipAmount] = useState(0);
  const [carbonOffset, setCarbonOffset] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [showManagerPin, setShowManagerPin] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [customTip, setCustomTip] = useState('');

  const carbonOffsetAmount = carbonOffset ? Math.ceil(co2e * 0.05 * 100) / 100 : 0; // ~5p per kg CO2e
  const grandTotal = total + tipAmount + carbonOffsetAmount;

  const requiresManagerOverride = total > 0 && (total < (grandTotal - tipAmount - carbonOffsetAmount) * 0.5);

  const addSplit = () => {
    const remaining = (grandTotal - splitPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)).toFixed(2);
    setSplitPayments([...splitPayments, { method: 'cash', amount: remaining }]);
  };

  const removeSplit = (idx) => setSplitPayments(splitPayments.filter((_, i) => i !== idx));

  const updateSplit = (idx, field, value) => {
    setSplitPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const splitTotal = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const splitRemaining = grandTotal - splitTotal;

  const handleConfirm = async () => {
    // Age verification check
    if (needsAgeVerification && !ageVerified) {
      toast.error('Age verification required — Challenge 25');
      return;
    }

    // Manager override check for large discounts
    if (requiresManagerOverride && managerPin !== '1234') {
      setShowManagerPin(true);
      if (managerPin !== '1234') {
        toast.error('Manager PIN required for this discount level');
        return;
      }
    }

    setProcessing(true);

    if (mode === 'split') {
      if (Math.abs(splitRemaining) > 0.01) {
        toast.error(`Split payments must total £${grandTotal.toFixed(2)} — remaining: £${splitRemaining.toFixed(2)}`);
        setProcessing(false);
        return;
      }
      onConfirm({
        method: 'split',
        splitPayments: splitPayments.map(p => ({ method: p.method, amount: parseFloat(p.amount) })),
        tipAmount,
        carbonOffset: carbonOffsetAmount,
        ageVerified,
      });
    } else {
      onConfirm({
        method: splitPayments[0].method,
        tipAmount,
        carbonOffset: carbonOffsetAmount,
        ageVerified,
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Process Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total display */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center space-y-1">
            <div className="text-3xl font-bold text-foreground">£{grandTotal.toFixed(2)}</div>
            {tipAmount > 0 && <div className="text-xs text-muted-foreground">incl. £{tipAmount.toFixed(2)} tip</div>}
            {carbonOffsetAmount > 0 && <div className="text-xs text-primary flex items-center justify-center gap-1"><Leaf className="w-3 h-3" /> incl. £{carbonOffsetAmount.toFixed(2)} carbon offset</div>}
            <div className="flex items-center justify-center gap-1.5 text-sm text-primary pt-1">
              <Leaf className="w-3.5 h-3.5" />
              <span>{co2e.toFixed(3)} kg CO₂e this transaction</span>
            </div>
          </div>

          {/* Age verification banner */}
          {needsAgeVerification && (
            <div className={`rounded-xl p-3 border ${ageVerified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${ageVerified ? 'text-green-600' : 'text-amber-600'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">Age Restricted — {ageRestrictionType}</div>
                  <div className="text-xs text-muted-foreground">Challenge 25: Verify customer is 18+</div>
                </div>
                {!ageVerified ? (
                  <Button size="sm" variant="outline" onClick={() => setAgeVerified(true)}>
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-green-700">✓ Verified</span>
                )}
              </div>
            </div>
          )}

          {/* Tip selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-2 font-medium flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" /> Add a tip
            </p>
            <div className="flex gap-2">
              {TIP_PRESETS.map(t => (
                <button
                  key={t}
                  onClick={() => { setTipAmount(t); setCustomTip(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    tipAmount === t && !customTip
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-muted-foreground border-border hover:border-primary'
                  }`}
                >
                  {t === 0 ? 'No tip' : `£${t}`}
                </button>
              ))}
              <div className="flex-1 relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                <Input
                  type="number"
                  step="0.50"
                  value={customTip}
                  onChange={e => { setCustomTip(e.target.value); setTipAmount(parseFloat(e.target.value) || 0); }}
                  placeholder="Custom"
                  className="h-9 pl-5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Carbon offset */}
          {co2e > 0 && (
            <button
              onClick={() => setCarbonOffset(!carbonOffset)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                carbonOffset ? 'bg-green-50 border-green-300' : 'bg-white border-border hover:border-primary'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${carbonOffset ? 'bg-primary text-white' : 'bg-green-50 text-primary'}`}>
                <Leaf className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">Offset carbon footprint</div>
                <div className="text-xs text-muted-foreground">Add £{carbonOffsetAmount.toFixed(2)} to plant trees</div>
              </div>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${carbonOffset ? 'bg-primary border-primary' : 'border-border'}`}>
                {carbonOffset && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
            </button>
          )}

          {/* Payment mode toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition ${mode === 'single' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              <CreditCard className="w-3.5 h-3.5" /> Single
            </button>
            <button
              onClick={() => setMode('split')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition ${mode === 'split' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              <Split className="w-3.5 h-3.5" /> Split
            </button>
          </div>

          {/* Payment methods */}
          {mode === 'single' ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2 font-medium">Select payment method</p>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSplitPayments([{ method: id, amount: total.toFixed(2) }])}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all active:scale-95 ${
                      splitPayments[0].method === id
                        ? 'border-primary bg-green-50'
                        : 'border-border hover:border-primary'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Split payments (£{grandTotal.toFixed(2)} total)</p>
              {splitPayments.map((sp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={sp.method}
                    onChange={e => updateSplit(idx, 'method', e.target.value)}
                    className="h-9 rounded-lg border border-border text-sm px-2 bg-white"
                  >
                    {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <div className="flex-1 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={sp.amount}
                      onChange={e => updateSplit(idx, 'amount', e.target.value)}
                      className="pl-6 h-9"
                    />
                  </div>
                  {splitPayments.length > 1 && (
                    <button onClick={() => removeSplit(idx)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {splitPayments.length < 4 && (
                <button onClick={addSplit} className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add payment method
                </button>
              )}
              <div className={`text-sm font-medium px-3 py-1.5 rounded-lg ${Math.abs(splitRemaining) < 0.01 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                Remaining: £{splitRemaining.toFixed(2)}
              </div>
            </div>
          )}

          {/* Manager PIN override */}
          {showManagerPin && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <ShieldCheck className="w-4 h-4" /> Manager PIN required for discount override
              </div>
              <Input
                type="password"
                value={managerPin}
                onChange={e => setManagerPin(e.target.value)}
                placeholder="Enter 4-digit PIN"
                className="h-9 tracking-widest text-center"
                maxLength={4}
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={processing || (needsAgeVerification && !ageVerified)}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
              {processing ? 'Processing...' : `Pay £${grandTotal.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}