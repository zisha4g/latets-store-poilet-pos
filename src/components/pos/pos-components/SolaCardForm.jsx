import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { chargeSolaCard, getSolaConfig } from '@/api/solaPayments';
import { Loader2 } from 'lucide-react';

const SOFTWARE_NAME = 'StorePilot POS';
const SOFTWARE_VERSION = '1.0.0';

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load iFields'));
    document.head.appendChild(script);
  });
};

const formatExp = (digits) => {
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
};

const SolaCardForm = ({ amount, customer, onPaymentSuccess }) => {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [exp, setExp] = useState('');
  const [zip, setZip] = useState('');
  const [processing, setProcessing] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cardNumberError, setCardNumberError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const cfg = await getSolaConfig();
        if (!active) return;
        setConfig(cfg);
      } catch (error) {
        toast({
          title: 'Sola not configured',
          description: error?.message || 'Add your Sola keys first.',
          variant: 'destructive',
        });
      } finally {
        if (active) setLoadingConfig(false);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    const setupIfields = async () => {
      if (!config?.ifieldsKey || !config?.ifieldsVersion) return;
      const src = `https://cdn.cardknox.com/ifields/${config.ifieldsVersion}/ifields.min.js`;
      await loadScript(src);
      if (window.setAccount) {
        window.setAccount(config.ifieldsKey, SOFTWARE_NAME, SOFTWARE_VERSION);
      }
      const baseStyle = {
        border: '0px solid transparent',
        'border-radius': '0px',
        'font-size': '14px',
        padding: '8px 12px',
        width: '100%',
        height: '100%',
        'line-height': '20px',
        'box-sizing': 'border-box',
        color: '#111827',
        'background-color': 'transparent',
        'font-family': 'Inter, sans-serif',
      };

      if (window.setIfieldStyle) {
        window.setIfieldStyle('card-number', baseStyle);
        window.setIfieldStyle('cvv', baseStyle);
      }

      if (window.addiFieldKeyPressCallback) {
        window.addiFieldKeyPressCallback((data) => {
          const formattedLength = data?.cardNumberFormattedLength || 0;
          const maxLength = data?.issuer === 'amex' ? 17 : 19;
          if (formattedLength > maxLength) {
            setCardNumberError('Card number is too long.');
          } else {
            setCardNumberError('');
          }
        });
      }

      if (window.enableAutoFormatting) {
        window.enableAutoFormatting(' ');
      } else if (window.enableAutoFormat) {
        window.enableAutoFormat(' ');
      }
    };

    setupIfields().catch(() => {
      setLoadError('Unable to load iFields. Check SOLA_IFIELDS_VERSION in Supabase secrets.');
      toast({
        title: 'iFields unavailable',
        description: 'Failed to load secure card fields.',
        variant: 'destructive',
      });
    });
  }, [config, toast]);

  const canSubmit = useMemo(() => {
    return !loadingConfig && config?.ifieldsKey && exp.trim().length >= 4 && !processing;
  }, [loadingConfig, config, exp, processing]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!window.getTokens) {
      toast({
        title: 'Card fields not ready',
        description: 'Please wait for iFields to load.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    window.getTokens(
      async () => {
        try {
          const cardToken = document.querySelector('[data-ifields-id="card-number-token"]')?.value;
          const cvvToken = document.querySelector('[data-ifields-id="cvv-token"]')?.value;

          if (!cardToken || !cvvToken) {
            throw new Error('Missing card tokens');
          }

          const invoice = `POS-${Date.now()}`;
          const response = await chargeSolaCard({
            amount,
            exp,
            cardSut: cardToken,
            cvvSut: cvvToken,
            invoice,
            customer: {
              name: customer?.name,
              email: customer?.email,
              phone: customer?.phone,
              zip,
            },
            customerId: customer?.id,
          });

          if (!response?.ok) {
            throw new Error(response?.result?.xError || 'Payment failed');
          }

          toast({
            title: 'Payment approved',
            description: `Ref: ${response.result?.xRefNum || 'N/A'}`,
          });

          onPaymentSuccess?.({
            method: 'card',
            refNum: response.result?.xRefNum,
            token: response.result?.xToken,
          });
        } catch (error) {
          toast({
            title: 'Payment failed',
            description: error?.message || 'Please try again.',
            variant: 'destructive',
          });
        } finally {
          setProcessing(false);
        }
      },
      () => {
        setProcessing(false);
        toast({
          title: 'Card data error',
          description: 'Check the card fields and try again.',
          variant: 'destructive',
        });
      },
      30000
    );
  };

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading payment form...
      </div>
    );
  }

  if (!config?.ifieldsKey) {
    return (
      <div className="text-sm text-muted-foreground">Configure your Sola account to enable card payments.</div>
    );
  }

  if (loadError) {
    return (
      <div className="text-sm text-muted-foreground">{loadError}</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-muted-foreground">Card Details</h4>
        <p className="text-xs text-muted-foreground">Secure fields powered by Cardknox</p>
      </div>

      <div className="space-y-2">
        <Label>Card Number</Label>
        <div
          className={`ifields-field ${focusedField === 'card-number' ? 'ifields-field--focused' : ''} ${cardNumberError ? 'ifields-field--error' : ''}`}
        >
          <iframe
            title="Card Number"
            data-ifields-id="card-number"
            data-ifields-placeholder="Card Number"
            src={`https://cdn.cardknox.com/ifields/${config.ifieldsVersion}/ifield.htm`}
            className="ifields-frame"
            onFocus={() => setFocusedField('card-number')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        <input name="xCardNum" type="hidden" data-ifields-id="card-number-token" />
        {cardNumberError && (
          <p className="text-xs text-destructive">{cardNumberError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>CVV</Label>
        <div className={`ifields-field ${focusedField === 'cvv' ? 'ifields-field--focused' : ''}`}>
          <iframe
            title="CVV"
            data-ifields-id="cvv"
            data-ifields-placeholder="CVV"
            src={`https://cdn.cardknox.com/ifields/${config.ifieldsVersion}/ifield.htm`}
            className="ifields-frame"
            onFocus={() => setFocusedField('cvv')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
        <input name="xCVV" type="hidden" data-ifields-id="cvv-token" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exp">Exp (MMYY)</Label>
          <Input
            id="exp"
            value={formatExp(exp)}
            onChange={(event) => setExp(event.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="MM/YY"
            className="h-11 rounded-lg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">Zip</Label>
          <Input
            id="zip"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
            placeholder="Postal code"
            className="h-11 rounded-lg"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit} className="rounded-lg">
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            `Charge $${amount.toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
};

export default SolaCardForm;
