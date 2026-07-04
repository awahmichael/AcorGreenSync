import { useState } from 'react';
import { Clock, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ParkedTransactions({ parkedTxns, onResume, onDelete }) {
  const [open, setOpen] = useState(false);

  if (!parkedTxns || parkedTxns.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
      >
        <Clock className="w-3.5 h-3.5" />
        Parked ({parkedTxns.length})
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Parked Transactions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {parkedTxns.map((pt, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30">
                <div>
                  <div className="text-sm font-medium text-foreground">{pt.items?.length || 0} items · £{(pt.total || 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{pt.reason || 'Parked'}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => { onResume(i); setOpen(false); }}>
                    Resume <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                  <button onClick={() => onDelete(i)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}