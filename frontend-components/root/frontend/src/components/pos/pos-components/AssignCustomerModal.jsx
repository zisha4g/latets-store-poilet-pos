import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, UserPlus, UserCheck } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const AssignCustomerModal = ({ isOpen, onClose, onAssignCustomer, onAddNewCustomer, handlers }) => {
  const [phone, setPhone] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const phoneInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setSearchResults([]);
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleFindCustomer = async () => {
    if (!phone) return;
    setIsLoading(true);
    try {
      const result = await handlers.customers.findByPhone(phone);
      if (result?.multiple) {
        setSearchResults(result.matches);
      } else if (result) {
        setSearchResults([result]);
      } else {
        setSearchResults([]);
        toast({ title: "No Customer Found", description: "No customer matches this phone number. You can add a new one." });
      }
    } catch (error) {
      toast({ title: "Error", description: `Failed to find customer: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    onAssignCustomer(customer);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Assign Customer to Sale</DialogTitle>
          <DialogDescription>
            Search for an existing customer by phone number or create a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-center space-x-2">
            <Phone className="text-muted-foreground" />
            <Input
              ref={phoneInputRef}
              type="tel"
              placeholder="Customer's Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleFindCustomer()}
            />
            <Button onClick={handleFindCustomer} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Find'}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <h4 className="font-medium text-sm">Search Results</h4>
              {searchResults.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary cursor-pointer"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div>
                    <p className="font-semibold">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  </div>
                  <Button size="sm" variant="ghost">
                    <UserCheck className="w-4 h-4 mr-2" />
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onAddNewCustomer}>
            <UserPlus className="w-4 h-4 mr-2" /> Create New Customer
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignCustomerModal;