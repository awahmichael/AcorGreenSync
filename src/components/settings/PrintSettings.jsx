import { useState } from 'react';
import { Printer, Leaf, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPrintSettings, savePrintSettings } from '@/lib/printSettings';
import { toast } from 'sonner';

const RECEIPT_MODES = [
  { value: 'always_print', label: 'Always Print', icon: Printer, desc: 'Print paper receipt for every transaction' },
  { value: 'digital_first', label: 'Digital-First', icon: Leaf, desc: 'Offer digital delivery first, print on request' },
  { value: 'digital_only', label: 'Digital Only', icon: Monitor, desc: 'No paper — digital delivery only' },
];

const RECEIPT_STYLES = [
  { value: 'standard', label: 'Standard', desc: 'Full detail with carbon footprint summary' },
  { value: 'minimalist', label: 'Minimalist', desc: 'Compact format focused on carbon impact' },
];

export default function PrintSettings() {
  const [settings, setSettings] = useState(getPrintSettings());

  const update = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const save = () => {
    savePrintSettings(settings);
    toast.success('Print settings saved');
  };

  return (
    <div className="bg-white rounded-xl border border-border p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
          <Printer className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Printer & Receipt Settings</h2>
          <p className="text-xs text-muted-foreground">Configure receipt delivery and paper-saving defaults</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Receipt Delivery Mode</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {RECEIPT_MODES.map(mode => {
            const Icon = mode.icon;
            const selected = settings.receipt_mode === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => update('receipt_mode', mode.value)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                {selected && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-sm font-semibold text-foreground">{mode.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{mode.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Receipt Style</Label>
        <div className="grid grid-cols-2 gap-3">
          {RECEIPT_STYLES.map(style => {
            const selected = settings.receipt_style === style.value;
            return (
              <button
                key={style.value}
                onClick={() => update('receipt_style', style.value)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                {selected && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <div className="text-sm font-semibold text-foreground">{style.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{style.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Business Name (on receipt)</Label>
          <Input value={settings.business_name} onChange={e => update('business_name', e.target.value)} placeholder="e.g. AcorCloud Green-Sync" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">VAT Number (on receipt)</Label>
          <Input value={settings.vat_number} onChange={e => update('vat_number', e.target.value)} placeholder="e.g. GB350396892" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Footer Message</Label>
          <Input value={settings.footer_message} onChange={e => update('footer_message', e.target.value)} placeholder="e.g. Thank you for shopping with us" />
        </div>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-start gap-2">
        <Leaf className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-green-800">
          <strong>Go green:</strong> Switch to <strong>Digital-First</strong> or <strong>Digital Only</strong> to reduce paper waste.
          Customers receive receipts via QR code, email, or WhatsApp — eliminating paper entirely.
        </div>
      </div>

      <Button onClick={save} className="w-full bg-primary hover:bg-primary/90">Save Print Settings</Button>
    </div>
  );
}