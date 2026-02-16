import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const accountTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
const subTypes = {
  Asset: ['Bank', 'Accounts Receivable', 'Current Asset', 'Fixed Asset', 'Inventory'],
  Liability: ['Accounts Payable', 'Credit Card', 'Current Liability', 'Long-Term Liability'],
  Equity: ["Owner's Equity", 'Retained Earnings'],
  Revenue: ['Sales', 'Service Revenue', 'Other Income'],
  Expense: ['Cost of Goods Sold', 'Advertising', 'Rent', 'Utilities', 'Salaries'],
};

const AccountModal = ({ isOpen, onClose, onSave, account, accounts }) => {
  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    account_type: '',
    account_subtype: '',
    parent_id: '',
    description: '',
  });

  useEffect(() => {
    if (account) {
      setFormData({
        id: account.id,
        name: account.name || '',
        account_number: account.account_number || '',
        account_type: account.account_type || '',
        account_subtype: account.account_subtype || '',
        parent_id: account.parent_id || '',
        description: account.description || '',
      });
    } else {
      setFormData({
        name: '', account_number: '', account_type: '', account_subtype: '', parent_id: '', description: '',
      });
    }
  }, [account]);

  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    if (field === 'account_type') {
      newFormData.account_subtype = '';
    }
    setFormData(newFormData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (dataToSave.parent_id === 'none' || dataToSave.parent_id === '') {
        dataToSave.parent_id = null;
    }
    onSave(dataToSave);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Create New Account'}</DialogTitle>
          <DialogDescription>
            Fill in the details for your account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="account_number" className="text-right">Number</Label>
            <Input id="account_number" value={formData.account_number} onChange={(e) => handleChange('account_number', e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="account_type" className="text-right">Type</Label>
            <Select onValueChange={(value) => handleChange('account_type', value)} value={formData.account_type}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a type" /></SelectTrigger>
              <SelectContent>{accountTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {formData.account_type && subTypes[formData.account_type] && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="account_subtype" className="text-right">Sub-Type</Label>
              <Select onValueChange={(value) => handleChange('account_subtype', value)} value={formData.account_subtype}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a sub-type" /></SelectTrigger>
                <SelectContent>{subTypes[formData.account_type].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="parent_id" className="text-right">Parent Account</Label>
            <Select onValueChange={(value) => handleChange('parent_id', value)} value={formData.parent_id || ''}>
              <SelectTrigger className="col-span-3"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {accounts.filter(a => a.id !== account?.id).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => handleChange('description', e.target.value)} className="col-span-3" />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountModal;