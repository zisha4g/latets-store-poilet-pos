import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus } from 'lucide-react';

const AddCustomerModal = ({ isOpen, onClose, onSave }) => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomerData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!customerData.name.trim()) {
      return;
    }
    onSave(customerData);
    setCustomerData({ name: '', phone: '', email: '', address: '' });
  };

  const handleClose = () => {
    setCustomerData({ name: '', phone: '', email: '', address: '' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[96vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Add Customer to Sale</DialogTitle>
          <DialogDescription>
            Add a new customer and assign them to this sale.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name*</Label>
            <Input 
              id="name" 
              name="name" 
              value={customerData.name} 
              onChange={handleChange} 
              placeholder="Customer name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input 
              id="phone" 
              name="phone" 
              value={customerData.phone} 
              onChange={handleChange} 
              placeholder="Phone number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              value={customerData.email} 
              onChange={handleChange} 
              placeholder="Email address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea 
              id="address" 
              name="address" 
              value={customerData.address} 
              onChange={handleChange} 
              placeholder="Customer address"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!customerData.name.trim()}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;