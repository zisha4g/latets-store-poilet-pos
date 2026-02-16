import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const VendorModal = ({ isOpen, onClose, vendor, onSave }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (vendor) {
      setFormData(vendor);
    } else {
      setFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });
    }
  }, [vendor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{vendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
          <DialogDescription>
            {vendor ? 'Update the details for this vendor.' : 'Enter the details for the new vendor.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Vendor Name*</Label>
            <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Person</Label>
            <Input id="contact_person" name="contact_person" value={formData.contact_person || ''} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" value={formData.phone || ''} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" value={formData.address || ''} onChange={handleChange} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Vendor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VendorModal;