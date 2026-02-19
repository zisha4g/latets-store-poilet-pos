import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import SolaCardForm from './SolaCardForm';


const CheckoutModal = ({ isOpen, onOpenChange, cart, total = 0, subtotal = 0, onSave, taxes = [], serviceCharges = [], customer }) => {
  const [amountTendered, setAmountTendered] = useState('');
  const [change, setChange] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setAmountTendered('');
      setChange(0);
    }
  }, [isOpen]);

  const handleCashPayment = useCallback(() => {
    const tendered = parseFloat(amountTendered);
    if (isNaN(tendered) || tendered < total) {
      toast({
        title: 'Insufficient Amount',
        description: 'Amount tendered is less than the total.',
        variant: 'destructive',
      });
      return;
    }
    onSave({
      paymentMethod: 'cash',
      amountTendered: tendered,
      change: tendered - total,
    });
  }, [amountTendered, total, onSave, toast]);

  const calculateChange = (tenderedValue) => {
    const tenderedAmount = parseFloat(tenderedValue);
    if (!isNaN(tenderedAmount)) {
      setAmountTendered(tenderedValue);
      if (tenderedAmount >= total) {
        setChange(tenderedAmount - total);
      } else {
        setChange(0);
      }
    } else {
      setAmountTendered('');
      setChange(0);
    }
  };

  const handleQuickCash = (amount) => {
    calculateChange(amount.toFixed(2));
  };
  
  const getQuickCashValues = () => {
    const values = new Set();
    if (total > 0) {
        const next5 = Math.ceil(total / 5) * 5;
        const next10 = Math.ceil(total / 10) * 10;
        const next20 = Math.ceil(total / 20) * 20;
        const next50 = Math.ceil(total / 50) * 50;
        const next100 = Math.ceil(total / 100) * 100;
        
        values.add(Math.ceil(total));
        if (next5 > total) values.add(next5);
        if (next10 > total) values.add(next10);
        if (next20 > total) values.add(next20);
        if (next50 > total) values.add(next50);
        if (next100 > total) values.add(next100);
    }
    return Array.from(values).sort((a,b) => a-b).slice(0, 5);
  };
  
  const quickCashValues = getQuickCashValues();
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-xl lg:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold">Checkout</DialogTitle>
          <DialogDescription>
            Total due: <span className="font-bold text-primary text-2xl">${total.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
          <div className="space-y-6 rounded-2xl border border-border bg-background p-6 shadow-sm">
            <Tabs defaultValue="cash" className="space-y-5">
              <TabsList className="grid grid-cols-2 rounded-xl bg-muted/70 p-1">
                <TabsTrigger value="cash" className="rounded-lg text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Cash
                </TabsTrigger>
                <TabsTrigger value="card" className="rounded-lg text-sm font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Card
                </TabsTrigger>
              </TabsList>
              <TabsContent value="cash" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount-tendered" className="text-base font-semibold">Amount Tendered</Label>
                  <Input
                    id="amount-tendered"
                    type="number"
                    value={amountTendered}
                    onChange={(e) => calculateChange(e.target.value)}
                    className="text-2xl h-14 rounded-xl"
                    placeholder="0.00"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {quickCashValues.map(value => (
                    <Button
                      size="sm"
                      variant="outline"
                      key={value}
                      onClick={() => handleQuickCash(value)}
                      className="h-10 rounded-lg font-semibold"
                    >
                      ${value.toFixed(2)}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickCash(total)}
                    className="h-10 rounded-lg font-semibold"
                  >
                    Exact
                  </Button>
                </div>
                <div className="text-2xl font-semibold">
                  Change: <span className="text-green-600">${change.toFixed(2)}</span>
                </div>
                <Button
                  onClick={handleCashPayment}
                  className="w-full text-lg py-6 rounded-xl shadow-sm"
                  size="lg"
                >
                  Finalize Cash Payment
                </Button>
              </TabsContent>
              <TabsContent value="card">
                <SolaCardForm
                  amount={total}
                  customer={customer}
                  onPaymentSuccess={(details) => {
                    onSave({
                      paymentMethod: 'card',
                      refNum: details?.refNum,
                      token: details?.token,
                    });
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
          <div className="bg-secondary p-6 rounded-lg space-y-2">
            <h3 className="font-bold text-lg mb-4">Order Summary</h3>
            <div className="flex justify-between"><span>Subtotal</span> <span>${subtotal.toFixed(2)}</span></div>
            {taxes.map(t => (
                 <div key={t.name} className="flex justify-between">
                    <span>Tax ({t.name} @ {t.rate}%)</span>
                    <span>${t.amount.toFixed(2)}</span>
                </div>
            ))}
            {serviceCharges.map(sc => (
                 <div key={sc.name} className="flex justify-between">
                    <span>{sc.name} ({sc.type === 'percentage' ? `${sc.value}%` : ''})</span>
                    <span>${sc.amount.toFixed(2)}</span>
                </div>
            ))}
            <hr className="my-2 border-border"/>
            <div className="flex justify-between font-bold text-xl pt-2">
                <span>Total</span> <span>${total.toFixed(2)}</span>
            </div>
            <div className="pt-4 space-y-1">
                <p className="font-semibold text-sm">Items:</p>
                {cart && cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm text-muted-foreground">
                        <span>{item.quantity} x {item.name}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;