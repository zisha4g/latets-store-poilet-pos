import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CurrencyInput from '../ui/CurrencyInput';

const ExpenseModal = ({ isOpen, onClose, expense, onSave, accounts, vendors }) => {
  const [formData, setFormData] = useState(expense);

  useEffect(() => {
    setFormData(expense);
  }, [expense]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  const expenseAccounts = accounts.filter(a => a.account_type === 'Expense');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{expense?.id ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="account_id">Expense Account</Label>
            <Select value={formData?.account_id || ''} onValueChange={(val) => handleChange('account_id', val)}>
              <SelectTrigger><SelectValue placeholder="Select expense account..." /></SelectTrigger>
              <SelectContent>
                {expenseAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_id">Vendor (Optional)</Label>
            <Select value={formData?.vendor_id || ''} onValueChange={(val) => handleChange('vendor_id', val)}>
              <SelectTrigger><SelectValue placeholder="Select vendor..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData?.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the expense..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <CurrencyInput
                value={formData?.amount || 0}
                onChange={(value) => handleChange('amount', value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData?.date || ''}
                onChange={(e) => handleChange('date', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Expense</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExpenseModal;