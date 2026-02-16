import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Save } from 'lucide-react';

const BulkEditModal = ({ isOpen, onClose, selectedIds, handlers, categories }) => {
  const [changes, setChanges] = useState({
    category_id: { active: false, value: '' },
    brand: { active: false, value: '' },
  });

  const handleActiveChange = (field, isActive) => {
    setChanges(prev => ({ ...prev, [field]: { ...prev[field], active: isActive } }));
  };

  const handleValueChange = (field, value) => {
    setChanges(prev => ({ ...prev, [field]: { ...prev[field], value } }));
  };

  const handleSave = async () => {
    const updatePayload = {};
    if (changes.category_id.active) {
      updatePayload.category_id = changes.category_id.value || null;
    }
    if (changes.brand.active) {
      updatePayload.brand = changes.brand.value;
    }

    if (Object.keys(updatePayload).length === 0) {
      toast({ title: "No changes selected", description: "Please check a box to apply a change.", variant: "destructive" });
      return;
    }

    const productsToUpdate = Array.from(selectedIds).map(id => ({
      id,
      ...updatePayload
    }));

    try {
      await handlers.products.batchUpdate(productsToUpdate);
      toast({ title: "Success", description: `${selectedIds.size} products have been updated.` });
      onClose();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Bulk Edit Products</DialogTitle>
          <DialogDescription>
            Apply changes to {selectedIds.size} selected products. Check the box next to a field to update it.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-category"
              checked={changes.category_id.active}
              onCheckedChange={(checked) => handleActiveChange('category_id', checked)}
            />
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                disabled={!changes.category_id.active}
                onValueChange={(value) => handleValueChange('category_id', value)}
                defaultValue={changes.category_id.value}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-brand"
              checked={changes.brand.active}
              onCheckedChange={(checked) => handleActiveChange('brand', checked)}
            />
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="edit-brand">Brand</Label>
              <Input
                id="brand"
                disabled={!changes.brand.active}
                value={changes.brand.value}
                onChange={(e) => handleValueChange('brand', e.target.value)}
                placeholder="Enter brand name"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkEditModal;