import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Leaf, AlertTriangle, ShieldCheck, GitBranch, Loader2 } from 'lucide-react';
import { complianceEngine } from '@/lib/rml';
import { useAuth } from '@/lib/AuthContext';
import VersionHistory from '@/components/products/VersionHistory';

const SOURCES = ['DEFRA', 'Climatiq', 'Manual'];

export default function CarbonCoefficientUpdater({ product, onClose, onSaved }) {
  const [newCoefficient, setNewCoefficient] = useState('');
  const [source, setSource] = useState(product?.emission_factor_source || 'Manual');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const { user } = useAuth();

  const currentCoefficient = product?.emission_factor_defra ?? 0;
  const baseProductId = product?.base_product_id || product?.id;
  const currentVersion = product?.version || 1;

  useEffect(() => {
    complianceEngine.fetchVersionHistory(baseProductId).then(setHistory).finally(() => setLoadingHistory(false));
  }, [baseProductId]);

  const handleSave = async () => {
    const coef = parseFloat(newCoefficient);
    if (isNaN(coef) || coef < 0) {
      toast.error('Enter a valid carbon coefficient');
      return;
    }
    if (coef === currentCoefficient) {
      toast.error('New coefficient is identical to current — no change needed');
      return;
    }

    setSaving(true);
    try {
      await complianceEngine.updateSkuCarbonCoefficient(product.id, coef, source, user);
      toast.success(`New version created: v${currentVersion + 1} (${coef.toFixed(4)} kg CO₂e)`);
      onSaved();
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const delta = parseFloat(newCoefficient) - currentCoefficient;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            Update Carbon Coefficient
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current state */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium text-foreground">{product?.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Version</span>
              <span className="font-medium text-foreground">v{currentVersion}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Coefficient</span>
              <span className="font-bold text-primary">{currentCoefficient.toFixed(4)} kg CO₂e/{product?.unit || 'unit'}</span>
            </div>
          </div>

          {/* Immutability warning */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <strong>Non-destructive update (SCD Type 2).</strong> The current version (v{currentVersion}) will be preserved for historic transactions. A new version (v{currentVersion + 1}) will be created with the updated coefficient. All future sales use v{currentVersion + 1}; past sales remain locked to their original version.
            </div>
          </div>

          {/* New coefficient input */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New Carbon Coefficient (kg CO₂e/{product?.unit || 'unit'})</Label>
              <Input
                type="number"
                step="0.0001"
                value={newCoefficient}
                onChange={e => setNewCoefficient(e.target.value)}
                placeholder="e.g. 0.4500"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Delta preview */}
            {newCoefficient && !isNaN(parseFloat(newCoefficient)) && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                delta < 0 ? 'bg-green-50 text-green-700' : delta > 0 ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {delta < 0
                  ? `Coefficient decreases by ${Math.abs(delta).toFixed(4)} kg CO₂e (${((Math.abs(delta) / currentCoefficient) * 100).toFixed(1)}% reduction)`
                  : delta > 0
                    ? `Coefficient increases by ${delta.toFixed(4)} kg CO₂e (${((delta / currentCoefficient) * 100).toFixed(1)}% increase)`
                    : 'No change'}
              </div>
            )}
          </div>

          {/* Version history */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
              Version History
            </div>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <VersionHistory versions={history} currentVersion={currentVersion} />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !newCoefficient} className="flex-1 bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Leaf className="w-4 h-4 mr-2" />Create v{currentVersion + 1}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}