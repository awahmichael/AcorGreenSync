import { Printer, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Receipt from './Receipt';

export default function ReceiptModal({ transaction, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[380px] p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Leaf className="w-4 h-4 text-primary" />
            Transaction Receipt
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[60vh] flex justify-center bg-gray-50 py-4">
          <Receipt transaction={transaction} />
        </div>
        <div className="flex gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
          <Button onClick={handlePrint} className="flex-1 bg-primary hover:bg-primary/90">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}