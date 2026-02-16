import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

const SaveCartModal = ({ isOpen, onClose, onSave, customer, cartTotal, itemCount }) => {
  const [cartName, setCartName] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    onSave({ name: cartName, notes });
    setCartName('');
    setNotes('');
  };

  const handleClose = () => {
    setCartName('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[96vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Save Cart</DialogTitle>
          <DialogDescription>
            Save this cart to continue later. You can load it from the customer lookup screen.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-secondary p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Customer:</span>
              <span className="font-medium">{customer?.name || 'Guest'}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Items:</span>
              <span className="font-medium">{itemCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="font-bold text-primary">${cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cartName">Cart Name*</Label>
              <Input
                id="cartName"
                value={cartName}
                onChange={(e) => setCartName(e.target.value)}
                placeholder="Enter a name for this cart..."
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this cart..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!cartName.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Save Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveCartModal;