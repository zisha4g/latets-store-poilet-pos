import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { chargeSolaSwipe } from '@/api/solaPayments';
import { Loader2, CreditCard, CheckCircle2, XCircle } from 'lucide-react';

const MIN_LENGTH = 6;

const parseCardData = (raw) => {
  const cleaned = raw.replace(/[\r\n]+$/, '').trim();
  // Track 1: %B{card}^{name}^{YYMM}... (% may be stripped by reader)
  const t1 = cleaned.match(/%?B(\d{13,19})\^([^^]*)\^(\d{4})/);
  // Track 2 with sentinel: ;{card}={YYMM}...?
  const t2 = cleaned.match(/;(\d{13,19})=(\d{4})/);
  // Track 2 without sentinel (some readers strip ; and ?): {card}={YYMM}...
  const t2bare = !t1 && !t2 ? cleaned.match(/(\d{13,19})=(\d{4})/) : null;
  // Plain card number
  const plain = cleaned.match(/^(\d{13,19})$/);

  let cardNumber = '', name = '', exp = '';
  if (t1) { cardNumber = t1[1]; name = t1[2].replace(/\//g, ' ').trim(); exp = t1[3]; }
  else if (t2) { cardNumber = t2[1]; exp = t2[2]; }
  else if (t2bare) { cardNumber = t2bare[1]; exp = t2bare[2]; }
  else if (plain) { cardNumber = plain[1]; }

  return {
    cardNumber,
    name,
    exp,
    masked: cardNumber ? `****${cardNumber.slice(-4)}` : '',
    hasTrack: !!(t1 || t2 || t2bare),
    raw: cleaned,
  };
};

const CardReaderSwipe = ({ amount, customer, onPaymentSuccess }) => {
  const { toast } = useToast();
  const [status, setStatus] = useState('waiting');
  const [cardInfo, setCardInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  // Keep focus on the input field so card reader keystrokes go into it
  useEffect(() => {
    if (status !== 'waiting') return;
    const focus = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    };
    // Immediate focus + short interval to recapture quickly
    focus();
    const t = setTimeout(focus, 50);
    const interval = setInterval(focus, 300);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [status]);

  const processCard = useCallback(async (rawData) => {
    const parsed = parseCardData(rawData);
    if (!parsed.cardNumber) {
      setStatus('error');
      setErrorMsg('Could not read card. Please try swiping again.');
      return;
    }

    setCardInfo(parsed);
    setStatus('processing');

    try {
      const invoice = `POS-${Date.now()}`;
      const payload = {
        amount,
        invoice,
        customer: {
          name: parsed.name || customer?.name,
          email: customer?.email,
          phone: customer?.phone,
        },
        customerId: customer?.id,
      };

      // Send raw data as magstripe + parsed card details as fallback
      payload.magstripe = parsed.raw;
      payload.cardNum = parsed.cardNumber;
      payload.cardExp = parsed.exp;

      const response = await chargeSolaSwipe(payload);

      if (!response?.ok) {
        throw new Error(response?.result?.xError || 'Payment declined');
      }

      setStatus('success');
      toast({
        title: 'Payment Approved',
        description: `Ref: ${response.result?.xRefNum || 'N/A'} — ${parsed.masked}`,
      });

      onPaymentSuccess?.({
        method: 'card_reader',
        refNum: response.result?.xRefNum,
        token: response.result?.xToken,
        maskedCard: parsed.masked,
      });
    } catch (error) {
      setStatus('error');
      setErrorMsg(error?.message || 'Payment failed. Try again.');
    }
  }, [amount, customer, onPaymentSuccess, toast]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = (inputRef.current?.value || '').trim();
      if (value.length >= MIN_LENGTH) {
        processCard(value);
        if (inputRef.current) inputRef.current.value = '';
      }
    }
  }, [processCard]);

  const handleRetry = () => {
    setStatus('waiting');
    setCardInfo(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col items-center justify-center py-5 space-y-4">

      {status === 'waiting' && (
        <>
          <div className="relative">
            <CreditCard className="h-14 w-14 text-muted-foreground animate-pulse" />
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-ping" />
          </div>
          <h3 className="text-xl font-semibold">Swipe or Tap Card</h3>
          <div className="text-3xl font-bold text-primary">${amount.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Swipe, insert, or tap the card on your reader. It will be captured automatically.
          </p>

          {/* Hidden input that receives card reader keystrokes */}
          <input
            ref={inputRef}
            type="text"
            className="absolute opacity-0 h-0 w-0 pointer-events-none"
            onKeyDown={(e) => { e.stopPropagation(); handleKeyDown(e); }}
            onInput={(e) => e.stopPropagation()}
            autoFocus
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            tabIndex={-1}
          />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Listening for card reader...
          </div>
        </>
      )}

      {status === 'processing' && (
        <>
          <Loader2 className="h-14 w-14 text-primary animate-spin" />
          <h3 className="text-xl font-semibold">Processing Payment</h3>
          {cardInfo?.masked && <p className="text-sm text-muted-foreground">Card: {cardInfo.masked}</p>}
          <div className="text-2xl font-bold">${amount.toFixed(2)}</div>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="h-14 w-14 text-green-500" />
          <h3 className="text-xl font-semibold text-green-600">Payment Approved</h3>
          {cardInfo?.masked && <p className="text-sm text-muted-foreground">Card: {cardInfo.masked}</p>}
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle className="h-14 w-14 text-destructive" />
          <h3 className="text-xl font-semibold text-destructive">Failed</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">{errorMsg}</p>
          <Button onClick={handleRetry} variant="outline" size="sm" className="mt-2">
            Try Again
          </Button>
        </>
      )}
    </div>
  );
};

export default CardReaderSwipe;
