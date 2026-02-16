import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const CreditCardForm = ({ onPaymentSuccess, onPaymentCancel, amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message);
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
        redirect: 'if_required',
    });


    if (confirmError) {
      setError(confirmError.message);
      toast({
        title: 'Payment Failed',
        description: confirmError.message,
        variant: 'destructive',
      });
      setProcessing(false);
    } else if (paymentIntent.status === 'succeeded') {
      toast({
        title: 'Payment Successful!',
        description: `Charged $${amount.toFixed(2)}.`,
      });
      onPaymentSuccess(paymentIntent);
    } else {
        setError(`Payment did not succeed. Status: ${paymentIntent.status}`);
        setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 border rounded-md bg-gray-50">
        <PaymentElement />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onPaymentCancel} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || processing}>
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${amount.toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
};

export default CreditCardForm;