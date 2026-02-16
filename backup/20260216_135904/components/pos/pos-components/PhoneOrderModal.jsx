import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

const PhoneOrderModal = ({ isOpen, onClose, customer, onSubmit }) => {
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setAddress(customer?.address || '');
      setInstructions('');
      setSaveToProfile(true);
    }
  }, [isOpen, customer]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!address?.trim()) return;
    onSubmit({ address: address.trim(), instructions: instructions.trim(), saveToProfile: !!saveToProfile });
  };

  const noCustomer = !customer;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Create Phone Order</DialogTitle>
          <DialogDescription>
            Collect delivery address and special instructions. This will be linked to the current customer and sent to checkout.
          </DialogDescription>
        </DialogHeader>

        {noCustomer && (
          <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm">
            A customer isn\'t assigned to this sale. Please assign a customer first to save the address to their profile.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="address">Delivery Address</Label>
            <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={4} placeholder="Street, City, State, ZIP" />
          </div>

          <div>
            <Label htmlFor="instructions">Delivery Instructions (optional)</Label>
            <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="Gate code, leave with front desk, etc." />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="saveToProfile" checked={!!saveToProfile} onCheckedChange={(v) => setSaveToProfile(!!v)} disabled={noCustomer} />
            <Label htmlFor="saveToProfile">Save this address to the customer\'s profile</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!address?.trim()}>Continue to Payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneOrderModal;
