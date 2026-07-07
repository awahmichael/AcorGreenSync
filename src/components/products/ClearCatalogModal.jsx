import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Trash2, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ClearCatalogModal({ organizationId, onClose, onCleared }) {
  const [phase, setPhase] = useState('confirm'); // confirm -> scanning -> preview -> deleting -> done
  const [summary, setSummary] = useState(null);

  const handleDryRun = async () => {
    setPhase('scanning');
    try {
      const res = await base44.functions.invoke('clearProductCatalog', {
        organization_id: organizationId,
        dry_run: true,
      });
      setSummary(res.data);
      setPhase('preview');
    } catch (err) {
      toast.error(`Scan failed: ${err.message}`);
      setPhase('confirm');
    }
  };

  const handleDelete = async () => {
    setPhase('deleting');
    try {
      const res = await base44.functions.invoke('clearProductCatalog', {
        organization_id: organizationId,
        dry_run: false,
      });
      setSummary(res.data);
      setPhase('done');
      toast.success(`${res.data.deleted_count} products removed`);
    } catch (err) {
      toast.error(`Clear failed: ${err.message}`);
      setPhase('preview');
    }
  };

  const handleClose = () => {
    if (phase === 'scanning' || phase === 'deleting') return;
    if (phase === 'done' && onCleared) onCleared();
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Clear Product Catalog
          </DialogTitle>
          <DialogDescription>
            Remove all products from your catalog that have never been sold. Products with transaction history are protected and cannot be deleted.
          </DialogDescription>
        </DialogHeader>

        {phase === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                This will permanently delete products from your catalog. Products that appear in any past transaction will be automatically protected. A scan will run first before any deletion.
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={handleDryRun} className="flex-1 bg-primary hover:bg-primary/90">Scan Catalog</Button>
            </div>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <div className="text-sm font-medium">Scanning catalog and transaction history...</div>
            <div className="text-xs text-muted-foreground">Checking which products have been sold</div>
          </div>
        )}

        {phase === 'preview' && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-700">{summary.deletable_count}</div>
                <div className="text-xs text-red-600 mt-0.5">Can Delete</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <div className="text-2xl font-bold text-green-700">{summary.protected_count}</div>
                </div>
                <div className="text-xs text-green-600 mt-0.5">Protected</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Total products in catalog: <strong className="text-foreground">{summary.total_products}</strong>
            </div>
            {summary.protected_count > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                <ShieldCheck className="w-3 h-3 inline mr-1" />
                {summary.protected_count} product(s) with sales history will be kept.
              </div>
            )}
            {summary.deletable_count === 0 ? (
              <div className="bg-muted rounded-lg px-3 py-3 text-sm text-muted-foreground text-center">
                No products can be deleted — all products have transaction history.
              </div>
            ) : null}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPhase('confirm')} className="flex-1">Back</Button>
              <Button
                onClick={handleDelete}
                disabled={summary.deletable_count === 0}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {summary.deletable_count} Product{summary.deletable_count !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {phase === 'deleting' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-destructive" />
            <div className="text-sm font-medium">Deleting products...</div>
            <div className="text-xs text-muted-foreground">Removing unsold items from catalog</div>
          </div>
        )}

        {phase === 'done' && summary && (
          <div className="py-4 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <div className="text-lg font-bold">Catalog Cleared</div>
              <div className="text-sm text-muted-foreground mt-1">
                {summary.deleted_count} product{summary.deleted_count !== 1 ? 's' : ''} deleted. {summary.protected_count} protected product{summary.protected_count !== 1 ? 's' : ''} retained.
              </div>
            </div>
            <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 px-8">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}