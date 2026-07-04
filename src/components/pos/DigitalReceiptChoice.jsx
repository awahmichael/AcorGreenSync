import { useState } from 'react';
import { Printer, Leaf, Mail, QrCode, MessageCircle, X, Send, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { getPrintSettings } from '@/lib/printSettings';
import { toast } from 'sonner';

export default function DigitalReceiptChoice({ transaction, onPrint, onSkip, onClose }) {
  const [view, setView] = useState('choice');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const printSettings = getPrintSettings();
  const digitalOnly = printSettings.receipt_mode === 'digital_only';
  const businessName = printSettings.business_name || 'AcorCloud Green-Sync';

  const receiptUrl = `${window.location.origin}/receipt/${transaction?.transaction_ref}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiptUrl)}`;

  const tipText = transaction?.tip_amount ? `\nTip: \u00A3${(transaction.tip_amount || 0).toFixed(2)}` : '';
  const offsetText = transaction?.carbon_offset_amount ? `\nCarbon Offset: \u00A3${(transaction.carbon_offset_amount || 0).toFixed(2)}` : '';
  const whatsappText = `Your receipt from ${businessName}\nTransaction: ${transaction?.transaction_ref}\nTotal: \u00A3${(transaction?.total_amount || 0).toFixed(2)}${tipText}${offsetText}\nCarbon: ${(transaction?.total_kg_co2e || 0).toFixed(3)} kg CO\u2082e\nView: ${receiptUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  const sendEmail = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    setSending(true);
    try {
      const items = (transaction?.items || []).map(i =>
        `${i.product_name} x${i.quantity} \u2014 \u00A3${((i.unit_price || 0) * (i.quantity || 1)).toFixed(2)}`
      ).join('\n');

      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `Your receipt \u2014 ${transaction?.transaction_ref}`,
        body: `Thank you for shopping with us!\n\nTransaction: ${transaction?.transaction_ref}\nDate: ${new Date(transaction?.transaction_date).toLocaleString('en-GB')}\nTotal: \u00A3${(transaction?.total_amount || 0).toFixed(2)}${transaction?.tip_amount ? `\nTip: \u00A3${(transaction.tip_amount || 0).toFixed(2)}` : ''}${transaction?.carbon_offset_amount ? `\nCarbon Offset: \u00A3${(transaction.carbon_offset_amount || 0).toFixed(2)}` : ''}\n\nItems:\n${items}\n\nCarbon Footprint: ${(transaction?.total_kg_co2e || 0).toFixed(3)} kg CO\u2082e\n\nView online: ${receiptUrl}\n\n${businessName} \u2014 The UK's First Carbon-Native POS`
      });
      toast.success(`Receipt sent to ${email}`);
      setView('choice');
      setEmail('');
    } catch (err) {
      toast.error('Failed to send email \u2014 please try again');
    }
    setSending(false);
  };

  const sendWhatsApp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number with country code');
      return;
    }
    setSending(true);
    try {
      const resp = await base44.functions.invoke('sendWhatsAppReceipt', {
        phone,
        transaction_ref: transaction?.transaction_ref,
        total_amount: transaction?.total_amount,
        business_name: businessName,
        items: transaction?.items,
        total_kg_co2e: transaction?.total_kg_co2e,
        receipt_url: receiptUrl,
      });
      if (resp.data?.success) {
        toast.success('WhatsApp receipt sent');
        setView('choice');
        setPhone('');
      } else {
        toast.error(resp.data?.error || 'WhatsApp send failed');
      }
    } catch (err) {
      toast.error('Failed to send WhatsApp — check API configuration');
    }
    setSending(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(receiptUrl);
    toast.success('Receipt link copied');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            {view === 'qr' ? 'Scan QR Code' : view === 'email' ? 'Email Receipt' : 'Digital Receipt'}
          </DialogTitle>
        </DialogHeader>

        {view === 'choice' && (
          <div className="space-y-2 pt-2">
            <div className="text-xs text-muted-foreground text-center mb-3 flex items-center justify-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-primary" />
              Go paperless — save the planet, one receipt at a time
            </div>
            <Button onClick={() => setView('qr')} className="w-full bg-primary hover:bg-primary/90 justify-start">
              <QrCode className="w-4 h-4 mr-2" /> QR Code
            </Button>
            <Button onClick={() => setView('email')} variant="outline" className="w-full justify-start">
              <Mail className="w-4 h-4 mr-2" /> Email Receipt
            </Button>
            <Button onClick={() => setView('whatsapp')} variant="outline" className="w-full justify-start">
              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
            </Button>
            {!digitalOnly && (
              <Button onClick={onPrint} variant="outline" className="w-full justify-start">
                <Printer className="w-4 h-4 mr-2" /> Print Paper Receipt
              </Button>
            )}
            <Button onClick={onSkip} variant="ghost" className="w-full text-muted-foreground">
              <X className="w-4 h-4 mr-2" /> No Receipt
            </Button>
          </div>
        )}

        {view === 'whatsapp' && (
          <div className="space-y-3 pt-2">
            <div className="text-xs text-muted-foreground text-center">
              Enter the customer's WhatsApp number (with country code) to send an official Business API receipt
            </div>
            <Input
              type="tel"
              placeholder="+44 7700 900123"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="text-sm"
            />
            <Button onClick={sendWhatsApp} disabled={sending} className="w-full bg-primary hover:bg-primary/90">
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
              ) : (
                <><MessageCircle className="w-4 h-4 mr-2" /> Send via WhatsApp</>
              )}
            </Button>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-primary hover:underline">
              Or send via WhatsApp app →
            </a>
            <Button onClick={() => setView('choice')} variant="ghost" className="w-full text-muted-foreground">
              Back
            </Button>
          </div>
        )}

        {view === 'qr' && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="text-xs text-muted-foreground text-center">
              Customer scans this code to view their receipt on their phone
            </div>
            <div className="p-3 bg-white border-2 border-border rounded-xl">
              <img src={qrUrl} alt="Receipt QR Code" width={200} height={200} className="rounded-lg" />
            </div>
            <div className="text-xs text-muted-foreground font-mono break-all text-center max-w-[250px]">
              {transaction?.transaction_ref}
            </div>
            <Button onClick={copyLink} variant="outline" size="sm" className="w-full">
              <Copy className="w-3.5 h-3.5 mr-2" /> Copy Receipt Link
            </Button>
            <Button onClick={onSkip} className="w-full bg-primary hover:bg-primary/90">Done</Button>
          </div>
        )}

        {view === 'email' && (
          <div className="space-y-3 pt-2">
            <div className="text-xs text-muted-foreground text-center">
              Enter the customer's email to send a digital copy
            </div>
            <Input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="text-sm"
            />
            <Button onClick={sendEmail} disabled={sending} className="w-full bg-primary hover:bg-primary/90">
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Send Receipt</>
              )}
            </Button>
            <Button onClick={() => setView('choice')} variant="ghost" className="w-full text-muted-foreground">
              Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}