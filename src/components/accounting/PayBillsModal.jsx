import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CurrencyInput from '../ui/CurrencyInput';

const PayBillsModal = ({ isOpen, onClose, onSave, billsToPay, accounts, vendors }) => {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('check');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [checkNumber, setCheckNumber] = useState('');

  const totalAmount = billsToPay.reduce((sum, bill) => sum + (bill.total_amount - bill.amount_paid), 0);
  const vendorName = vendors.find(v => v.id === billsToPay[0]?.vendor_id)?.name || 'Vendor';

  const bankAccounts = accounts.filter(a => a.account_subtype === 'Bank');

  const handleSubmit = () => {
    if (!paymentAccountId) {
      alert('Please select a payment account.');
      return;
    }
    onSave({
      bills: billsToPay,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      payment_account_id: paymentAccountId,
      check_number: checkNumber,
      total_amount: totalAmount,
      vendor_id: billsToPay[0]?.vendor_id,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay Bills</DialogTitle>
          <DialogDescription>
            Paying {billsToPay.length} bill(s) for {vendorName} totaling ${totalAmount.toFixed(2)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label>Payment Account</Label>
            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
              <SelectTrigger><SelectValue placeholder="Select a bank account..." /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          {paymentMethod === 'check' && (
            <div>
              <Label>Check Number</Label>
              <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="Enter check number" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Confirm Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PayBillsModal;