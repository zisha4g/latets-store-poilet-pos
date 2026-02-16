import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import CurrencyInput from '../ui/CurrencyInput';
import { useReactToPrint } from 'react-to-print';
import CheckPrintPreview from './CheckPrintPreview';
import { convertNumberToWords } from '@/utils/numberToWords';
import { toast } from '@/components/ui/use-toast';

const CheckWritingView = ({ data, handlers }) => {
  const [checkDetails, setCheckDetails] = useState({
    check_date: new Date().toISOString().slice(0, 10),
    payee_name: '',
    amount: 0,
    bank_account_id: '',
    memo: '',
    check_number: '',
  });

  const printRef = useRef();
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const { chartOfAccounts } = data;
  const bankAccounts = chartOfAccounts.filter(a => a.account_subtype === 'Bank');

  const handleChange = (field, value) => {
    setCheckDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAndPrint = async () => {
    if (!checkDetails.bank_account_id || !checkDetails.payee_name || checkDetails.amount <= 0) {
      toast({ title: 'Missing Information', description: 'Please fill out all required fields.', variant: 'destructive' });
      return;
    }
    
    const checkToSave = {
      ...checkDetails,
      amount_text: convertNumberToWords(checkDetails.amount),
    };

    // In a real scenario, you would save this to the database via a handler
    // await handlers.checks.add(checkToSave);
    toast({ title: 'Check Saved (Simulated)', description: 'Check is ready for printing.' });
    
    handlePrint();
  };

  return (
    <>
      <motion.div
        key="check-writing"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-primary">Write Check</h2>
          <Button onClick={handleSaveAndPrint}>Save & Print</Button>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md max-w-2xl mx-auto">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label>Bank Account</Label>
              <Select value={checkDetails.bank_account_id} onValueChange={(val) => handleChange('bank_account_id', val)}>
                <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={checkDetails.check_date} onChange={(e) => handleChange('check_date', e.target.value)} />
              </div>
              <div>
                <Label>Check No.</Label>
                <Input value={checkDetails.check_number} onChange={(e) => handleChange('check_number', e.target.value)} placeholder="To print" />
              </div>
            </div>
            <div className="col-span-2">
              <Label>Pay to the Order of</Label>
              <Input value={checkDetails.payee_name} onChange={(e) => handleChange('payee_name', e.target.value)} />
            </div>
            <div>
              <Label>Amount</Label>
              <CurrencyInput value={checkDetails.amount} onChange={(val) => handleChange('amount', val)} />
            </div>
            <div className="flex items-end">
              <p className="text-muted-foreground p-2 border-b w-full">{convertNumberToWords(checkDetails.amount)}</p>
            </div>
            <div className="col-span-2">
              <Label>Memo</Label>
              <Textarea value={checkDetails.memo} onChange={(e) => handleChange('memo', e.target.value)} />
            </div>
          </div>
        </div>
      </motion.div>
      <div className="hidden">
        <CheckPrintPreview ref={printRef} checkDetails={checkDetails} />
      </div>
    </>
  );
};

export default CheckWritingView;