import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Percent, DollarSign, PlusCircle } from 'lucide-react';
import CurrencyInput from '@/components/ui/CurrencyInput';

const DiscountModal = ({ isOpen, onClose, onApplyDiscount, onAddCustomItem, subtotal }) => {
  const [activeTab, setActiveTab] = useState('percentage');
  const [percentage, setPercentage] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  const handleApplyPercentage = () => {
    const value = parseFloat(percentage);
    if (!isNaN(value) && value > 0) {
      onApplyDiscount('percentage', value);
    }
  };

  const handleApplyFixed = () => {
    const value = parseFloat(fixedAmount);
    if (!isNaN(value) && value > 0) {
      onApplyDiscount('fixed', value);
    }
  };

  const handleAddCustomItem = () => {
    const price = parseFloat(customItemPrice);
    if (customItemName.trim() && !isNaN(price) && price >= 0) {
      onAddCustomItem({
        name: customItemName,
        price: price,
        isCustom: true,
      });
      onClose();
    }
  };

  const handleClose = () => {
    setPercentage('');
    setFixedAmount('');
    setCustomItemName('');
    setCustomItemPrice('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Discounts & Custom Items</DialogTitle>
          <DialogDescription>Apply a discount to the subtotal or add a custom item to the cart.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="percentage"><Percent className="mr-2 h-4 w-4" /> Percentage</TabsTrigger>
            <TabsTrigger value="fixed"><DollarSign className="mr-2 h-4 w-4" /> Fixed</TabsTrigger>
            <TabsTrigger value="custom"><PlusCircle className="mr-2 h-4 w-4" /> Custom</TabsTrigger>
          </TabsList>
          <TabsContent value="percentage" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="percentage">Discount Percentage (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="e.g., 10"
                  autoFocus
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Discount amount: <span className="font-medium text-primary">${((subtotal * parseFloat(percentage || 0)) / 100).toFixed(2)}</span>
              </p>
              <Button onClick={handleApplyPercentage} className="w-full">Apply Percentage Discount</Button>
            </div>
          </TabsContent>
          <TabsContent value="fixed" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fixed-amount">Fixed Discount Amount ($)</Label>
                <CurrencyInput
                  id="fixed-amount"
                  value={fixedAmount}
                  onChange={setFixedAmount}
                  placeholder="e.g., 5.00"
                />
              </div>
              <Button onClick={handleApplyFixed} className="w-full">Apply Fixed Discount</Button>
            </div>
          </TabsContent>
          <TabsContent value="custom" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-name">Custom Item Name</Label>
                <Input
                  id="custom-name"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  placeholder="e.g., Service Fee"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-price">Price ($)</Label>
                <CurrencyInput
                  id="custom-price"
                  value={customItemPrice}
                  onChange={setCustomItemPrice}
                  placeholder="e.g., 25.00"
                />
              </div>
              <Button onClick={handleAddCustomItem} className="w-full">Add Custom Item to Cart</Button>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountModal;