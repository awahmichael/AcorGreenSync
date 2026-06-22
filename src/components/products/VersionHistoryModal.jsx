import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Leaf, GitBranch, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VersionHistory from '@/components/products/VersionHistory';
import { toast } from 'sonner';

/**
 * VersionHistoryModal — Read-only viewer for a product's SCD Type 2 version timeline.
 * 
 * Carbon coefficient updates are performed AUTOMATICALLY by the system's
 * DEFRA auto-sync function — users cannot manually edit coefficients.
 * This modal shows the full version history for audit transparency.
 */
export default function VersionHistoryModal({ product, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const baseProductId = product?.base_product_id || product?.id;

  const loadHistory = () => {
    setLoading(true);
    base44.entities.Product.filter({ base_product_id: baseProductId })
      .then(versions => setHistory(versions.sort((a, b) => (a.version || 1) - (b.version || 1))))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadHistory(); }, [baseProductId]);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncDefraFactors', {});
      const data = res.data || res;
      if (data.updated > 0) {
        toast.success(`DEFRA sync: ${data.updated} product(s) updated with new coefficients`);
        loadHistory();
      } else {
        toast.info(`DEFRA sync: all coefficients are current (${data.checked} checked, 0 updated)`);
      }
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const currentCoefficient = product?.emission_factor_defra ?? 0;
  const currentVersion = product?.version || 1;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" />
            Version History
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product summary */}
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
              <span className="text-muted-foreground">Active Coefficient</span>
              <span className="font-bold text-primary flex items-center gap-1">
                <Leaf className="w-3 h-3" />
                {currentCoefficient.toFixed(4)} kg CO₂e/{product?.unit || 'unit'}
              </span>
            </div>
          </div>

          {/* Auto-sync notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
            <strong>Automated versioning.</strong> Carbon coefficients are updated automatically by the system's DEFRA auto-sync engine — not by manual user edits. When DEFRA publishes updated factors, the system detects the change and creates a new product version using SCD Type 2, preserving all historic transaction data.
          </div>

          {/* Version timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                Version Timeline
              </div>
              <Button size="sm" variant="outline" onClick={triggerSync} disabled={syncing} className="text-xs h-7">
                {syncing ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Sync Now
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <VersionHistory versions={history} currentVersion={currentVersion} />
            )}
          </div>

          <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}