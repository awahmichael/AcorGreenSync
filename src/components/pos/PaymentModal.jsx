import { CreditCard, Banknote, Smartphone, Globe, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const METHODS = [
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'contactless', label: 'Contactless', icon: Smartphone },
  { id: 'online', label: 'Online', icon: Globe },
];

export default function PaymentModal({ total, co2e, onConfirm, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center space-y-1">
            <div className="text-3xl font-bold text-foreground">£{total.toFixed(2)}</div>
            <div className="flex items-center justify-center gap-1.5 text-sm text-primary">
              <Leaf className="w-3.5 h-3.5" />
              <span>{co2e.toFixed(3)} kg CO₂e this transaction</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-3 font-medium">Select payment method</p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => onConfirm(id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-green-50 transition-all active:scale-95"
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" onClick={onClose} className="w-full">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}