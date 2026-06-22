import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Gift, CreditCard, Ban, History } from 'lucide-react';
import { toast } from 'sonner';
import GiftCardModal from '@/components/giftcards/GiftCardModal';

const statusColors = {
  active: 'bg-green-100 text-green-700',
  redeemed: 'bg-gray-100 text-gray-700',
  expired: 'bg-amber-100 text-amber-700',
  voided: 'bg-red-100 text-red-700',
};

export default function GiftCards() {
  const [cards, setCards] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [topupCard, setTopupCard] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [historyCard, setHistoryCard] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, custs] = await Promise.all([
        base44.entities.GiftCard.list('-issued_date', 100),
        base44.entities.Customer.list(),
      ]);
      setCards(data);
      setCustomers(custs);
    } catch (err) { toast.error('Failed to load gift cards'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      const txns = [...(topupCard.transactions || []), { date: new Date().toISOString(), amount, type: 'topup', reference: 'Manual top-up' }];
      await base44.entities.GiftCard.update(topupCard.id, {
        balance: (topupCard.balance || 0) + amount,
        transactions: txns,
      });
      toast.success(`Topped up £${amount.toFixed(2)}`);
      setTopupCard(null);
      setTopupAmount('');
      load();
    } catch (err) { toast.error(`Failed: ${err.message}`); }
  };

  const voidCard = async (card) => {
    try {
      await base44.entities.GiftCard.update(card.id, { status: 'voided', balance: 0 });
      toast.success('Gift card voided');
      load();
    } catch (err) { toast.error(`Failed: ${err.message}`); }
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gift Cards</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Issue, top up, and track gift card balances</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />Issue Gift Card
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-16">
          <Gift className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No gift cards issued yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => (
            <div key={card.id} className="bg-white border border-border rounded-xl p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs text-muted-foreground font-mono">{card.code}</div>
                  <div className="text-2xl font-bold text-foreground mt-1">£{(card.balance || 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">of £{(card.initial_balance || 0).toFixed(2)} issued</div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[card.status] || 'bg-gray-100'}`}>{card.status}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                {card.customer_name && <div>👤 {card.customer_name}</div>}
                <div>📅 Issued: {card.issued_date ? new Date(card.issued_date).toLocaleDateString() : '—'}</div>
                {card.expiry_date && <div>⏰ Expires: {new Date(card.expiry_date).toLocaleDateString()}</div>}
              </div>
              <div className="flex gap-1.5">
                {card.status === 'active' && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => { setTopupCard(card); setTopupAmount(''); }}>
                      <CreditCard className="w-3 h-3 mr-1" />Top Up
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setHistoryCard(card)} title="History">
                      <History className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500" onClick={() => voidCard(card)} title="Void">
                      <Ban className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                {card.status !== 'active' && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => setHistoryCard(card)}>
                    <History className="w-3.5 h-3.5 mr-1" />History
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <GiftCardModal customers={customers} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}

      {topupCard && (
        <Dialog open onOpenChange={() => setTopupCard(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Top Up Gift Card</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Card: <span className="font-mono font-medium text-foreground">{topupCard.code}</span></div>
              <div className="text-sm text-muted-foreground">Current balance: <span className="font-bold text-foreground">£{(topupCard.balance || 0).toFixed(2)}</span></div>
              <Input type="number" step="0.01" min="0.01" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="Top-up amount (£)" autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTopupCard(null)}>Cancel</Button>
              <Button onClick={handleTopup}>Top Up</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {historyCard && (
        <Dialog open onOpenChange={() => setHistoryCard(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Transaction History — {historyCard.code}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {(historyCard.transactions || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No transactions recorded.</p>
              ) : (
                [...(historyCard.transactions || [])].reverse().map((txn, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium capitalize">{txn.type}</div>
                      <div className="text-xs text-muted-foreground">{new Date(txn.date).toLocaleString()}</div>
                      {txn.reference && <div className="text-xs text-muted-foreground">{txn.reference}</div>}
                    </div>
                    <div className={`text-sm font-bold ${txn.type === 'redeem' ? 'text-red-600' : 'text-green-600'}`}>
                      {txn.type === 'redeem' ? '-' : '+'}£{(txn.amount || 0).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}