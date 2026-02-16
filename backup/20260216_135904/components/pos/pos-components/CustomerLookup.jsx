import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, User, Mail, Home, UserPlus, SkipForward, Archive, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useHotkeys } from '@/hooks/use-hotkeys';

const CustomerLookup = ({ onCustomerSelect, onSkip, handlers, savedCarts = [], onLoadSavedCart, onDeleteSavedCart, showSavedCarts, setShowSavedCarts }) => {
  const [phone, setPhone] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [multipleCustomers, setMultipleCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', address: '' });
  const phoneInputRef = useRef(null);

  useEffect(() => {
    phoneInputRef.current?.focus();
  }, []);
  
  useHotkeys([['enter', () => !isNewCustomer && !showSavedCarts && multipleCustomers.length === 0 && handleFindCustomer()]]);

  const handleFindCustomer = async () => {
    if (!phone) return;
    
    try {
      const result = await handlers.customers.findByPhone(phone);
      
      if (result?.multiple) {
        setMultipleCustomers(result.matches);
      } else if (result) {
        onCustomerSelect(result);
        toast({ title: "Customer Found", description: `Welcome back, ${result.name}!` });
      } else {
        setIsNewCustomer(true);
        setNewCustomer(prev => ({ ...prev, phone }));
        toast({ title: "No Customer Found", description: "This phone number is not registered. Add as a new customer." });
      }
    } catch (error) {
      toast({ title: "Error", description: `Failed to find customer: ${error.message}`, variant: "destructive" });
    }
  };

  const handleSelectCustomer = (customer) => {
    onCustomerSelect(customer);
    toast({ title: "Customer Selected", description: `Welcome back, ${customer.name}!` });
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast({ title: "Name Required", description: "Please enter the customer's full name.", variant: "destructive" });
      return;
    }
    try {
      const customerToAdd = { ...newCustomer, phone };
      const addedCustomer = await handlers.customers.add(customerToAdd);
      onCustomerSelect(addedCustomer);
      toast({ title: "Customer Added", description: `${addedCustomer.name} added and selected.` });
    } catch (error) {
      toast({ title: "Error", description: `Failed to add customer: ${error.message}`, variant: "destructive" });
    }
  };

  const handleLoadSavedCart = async (cart) => {
    onLoadSavedCart(cart);
  };

  if (showSavedCarts) {
    console.log('Rendering saved carts view, carts:', savedCarts);
    return (
      <div className="w-full h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl p-8 bg-card rounded-2xl shadow-xl"
        >
          <h2 className="text-2xl font-bold text-center text-primary mb-2">Saved Carts ({savedCarts.length})</h2>
          <p className="text-center text-muted-foreground mb-6">Select a saved cart to continue.</p>
          
          <div className="max-h-96 overflow-y-auto space-y-3 mb-6">
            {savedCarts.length === 0 ? ( 
              <p className="text-center text-muted-foreground py-8">No saved carts found.</p>
            ) : (
              savedCarts.map((cart) => (
                <div key={cart.id} className="p-4 border rounded-lg hover:bg-secondary flex justify-between items-center">
                  <div onClick={() => handleLoadSavedCart(cart)} className="flex-1 cursor-pointer">
                    <p className="font-medium">{cart.name || 'Unnamed Cart'}</p>
                    <p className="text-sm text-muted-foreground">{cart.customers?.name || 'Guest'} • {cart.items.length} items • ${cart.total.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(cart.created_at).toLocaleDateString()}</p>
                    {cart.notes && <p className="text-xs text-muted-foreground italic mt-1">{cart.notes}</p>}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleLoadSavedCart(cart); }}>
                      Load Cart
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteSavedCart(cart.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <Button onClick={() => setShowSavedCarts(false)} variant="ghost" className="w-full">
            Back to Customer Lookup
          </Button>
        </motion.div>
      </div>
    );
  }

  if (multipleCustomers.length > 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 bg-card rounded-2xl shadow-xl"
        >
          <h2 className="text-2xl font-bold text-center text-primary mb-2">Multiple Customers Found</h2>
          <p className="text-center text-muted-foreground mb-6">Select the correct customer:</p>
          
          <div className="space-y-3 mb-6">
            {multipleCustomers.map((customer) => (
              <Button
                key={customer.id}
                onClick={() => handleSelectCustomer(customer)}
                variant="outline"
                className="w-full justify-start p-4 h-auto"
              >
                <div className="text-left">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                  {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                </div>
              </Button>
            ))}
          </div>
          
          <Button onClick={() => { setMultipleCustomers([]); setPhone(''); }} variant="ghost" className="w-full">
            Back to Search
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-card rounded-2xl shadow-xl"
      >
        {!isNewCustomer ? (
          <>
            <h2 className="text-2xl font-bold text-center text-primary mb-2">Start New Sale</h2>
            <p className="text-center text-muted-foreground mb-6">Enter customer's phone number to begin.</p>
            <div className="flex items-center space-x-2 mb-4">
              <Phone className="text-muted-foreground" />
              <Input
                ref={phoneInputRef}
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <Button onClick={handleFindCustomer} className="w-full mb-2">Find Customer</Button>
            <div className="flex space-x-2 mb-2">
              <Button onClick={onSkip} variant="ghost" className="flex-1">
                <SkipForward className="w-4 h-4 mr-2" /> Continue as Guest
              </Button>
              <Button 
                onClick={() => {
                  console.log('Setting showSavedCarts to true');
                  setShowSavedCarts(true);
                }} 
                variant="outline" 
                className="flex-1"
              >
                <Archive className="w-4 h-4 mr-2" /> Saved Carts ({savedCarts.length})
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center text-primary mb-2">Add New Customer</h2>
            <p className="text-center text-muted-foreground mb-6">This phone number was not found. Add them below.</p>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Phone className="text-muted-foreground" />
                <Input value={phone} disabled />
              </div>
              <div className="flex items-center space-x-2">
                <User className="text-muted-foreground" />
                <Input placeholder="Full Name*" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} autoFocus />
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="text-muted-foreground" />
                <Input type="email" placeholder="Email Address" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
              </div>
              <div className="flex items-center space-x-2">
                <Home className="text-muted-foreground" />
                <Input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="ghost" onClick={() => setIsNewCustomer(false)}>Back</Button>
              <Button onClick={handleAddCustomer}><UserPlus className="w-4 h-4 mr-2" /> Add and Start Sale</Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default CustomerLookup;