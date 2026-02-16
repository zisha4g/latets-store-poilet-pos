import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Edit, Save, X } from 'lucide-react';

const CustomerDetailModal = ({ customer, isOpen, onClose, onSave, onStartCall, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState(null);

  useEffect(() => {
    if (customer) {
      setEditedCustomer(customer);
      setIsEditing(false);
    } else {
      setEditedCustomer(null);
    }
  }, [customer]);

  if (!isOpen || !editedCustomer) return null;

  const handleSave = async () => {
    try {
      await onSave(editedCustomer);
      toast({ title: "Customer Saved", description: `${editedCustomer.name} has been updated.` });
      setIsEditing(false);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedCustomer(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] sm:max-w-xl lg:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Customer' : 'Customer Details'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the customer information below.' : `Viewing details for ${editedCustomer.name}.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={editedCustomer.name || ''} onChange={handleChange} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" value={editedCustomer.phone || ''} onChange={handleChange} disabled={!isEditing} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={editedCustomer.email || ''} onChange={handleChange} disabled={!isEditing} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" value={editedCustomer.address || ''} onChange={handleChange} disabled={!isEditing} />
          </div>
          {!isEditing && (
            <div className="bg-secondary p-4 rounded-lg grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-xl font-bold text-primary">${(editedCustomer.totalSpent || 0).toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Visits</p>
                <p className="text-xl font-bold text-primary">{editedCustomer.visits || 0}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          {!!onDelete && !isEditing && (
            <Button
              variant="destructive"
              onClick={async () => {
                if (window.confirm(`Delete customer \"${editedCustomer.name}\"? This cannot be undone.`)) {
                  try {
                    await onDelete(editedCustomer.id);
                    onClose();
                    toast({ title: 'Customer Deleted', description: `${editedCustomer.name} has been removed.` });
                  } catch (error) {
                    toast({ title: 'Error', description: error.message, variant: 'destructive' });
                  }
                }
              }}
            >
              Delete
            </Button>
          )}
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)}><X className="w-4 h-4 mr-2" />Cancel</Button>
              <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" />Save Changes</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => setIsEditing(true)}><Edit className="w-4 h-4 mr-2" />Edit</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailModal;