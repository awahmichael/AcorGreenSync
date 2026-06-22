import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ReceiptChoice({ onPrint, onSkip, onClose }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center">Print Receipt?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <Button onClick={onPrint} className="w-full bg-primary hover:bg-primary/90">
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
          <Button variant="outline" onClick={onSkip} className="w-full">
            <X className="w-4 h-4 mr-2" />
            No Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}