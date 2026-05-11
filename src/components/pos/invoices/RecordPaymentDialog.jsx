import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, parseMoney } from '@/lib/money';
import SolaCardForm from '@/components/pos/pos-components/SolaCardForm';
import CardReaderSwipe from '@/components/pos/pos-components/CardReaderSwipe';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit card' },
  { value: 'card_reader', label: 'Card reader (swipe)' },
  { value: 'check', label: 'Check' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

export const RecordPaymentDialog = ({
  isOpen, onClose, invoice, balance, currency = 'USD', handlers, customers = [], onRecorded,
}) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(balance > 0 ? String(balance) : '');
      setMethod('cash');
      setReference('');
      setNotes('');
      setPaidAt(new Date().toISOString().slice(0, 10));
    }
  }, [isOpen, balance]);

  const customer = useMemo(
    () => customers.find((c) => c.id === invoice?.customer_id) || null,
    [customers, invoice?.customer_id],
  );

  const numericAmount = parseMoney(amount);

  const recordPayment = async ({ paymentMethod, refNum, token } = {}) => {
    if (numericAmount <= 0) {
      toast({ title: 'Enter a payment amount', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await handlers.invoices.recordPayment({
        invoiceId: invoice.id,
        amount: numericAmount,
        method: paymentMethod || method,
        reference: refNum || reference.trim() || null,
        notes: notes.trim() || (token ? `token:${token}` : null),
        paidAt: new Date(paidAt).toISOString(),
      });
      toast({ title: 'Payment recorded', description: formatMoney(numericAmount, currency) });
      onRecorded?.();
      onClose?.();
    } catch (e) {
      toast({ title: 'Failed to record payment', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = () => recordPayment();

  const isCardKeyed = method === 'card';
  const isCardSwipe = method === 'card_reader';
  const isCard = isCardKeyed || isCardSwipe;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoice?.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Invoice'}
            {balance > 0 ? ` · Balance ${formatMoney(balance, currency)}` : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rp-amount">Amount</Label>
            <Input
              id="rp-amount"
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rp-method">Method</Label>
              <select
                id="rp-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-date">Date</Label>
              <Input id="rp-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>

          {!isCard && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rp-ref">Reference</Label>
                <Input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check #, transaction id…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-notes">Notes</Label>
                <Textarea id="rp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </>
          )}

          {isCardKeyed && (
            <div className="rounded-lg border bg-muted/30 p-3">
              {numericAmount > 0 ? (
                <SolaCardForm
                  amount={numericAmount}
                  customer={customer}
                  onPaymentSuccess={(details) =>
                    recordPayment({
                      paymentMethod: 'card',
                      refNum: details?.refNum,
                      token: details?.token,
                    })
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">Enter an amount above to charge the card.</p>
              )}
            </div>
          )}

          {isCardSwipe && (
            <div className="rounded-lg border bg-muted/30 p-3">
              {numericAmount > 0 ? (
                <CardReaderSwipe
                  amount={numericAmount}
                  customer={customer}
                  onPaymentSuccess={(details) =>
                    recordPayment({
                      paymentMethod: 'card_reader',
                      refNum: details?.refNum,
                      token: details?.token,
                    })
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">Enter an amount above to swipe the card.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          {!isCard && (
            <Button onClick={handleManualSave} disabled={saving || numericAmount <= 0}>
              {saving ? 'Recording…' : 'Record payment'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentDialog;
