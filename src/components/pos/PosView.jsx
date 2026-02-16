import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Search, ShoppingCart, CreditCard, Receipt, Save, UserPlus, Edit, Percent, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useHotkeys } from '@/hooks/use-hotkeys';
import CustomerLookup from './pos-components/CustomerLookup';
import CartItem from './pos-components/CartItem';
import CheckoutModal from './pos-components/CheckoutModal';
import ProductSearch from './pos-components/ProductSearch';
import CustomerDetailModal from './CustomerDetailModal';
import ProductDetailModal from './ProductDetailModal';
import AddCustomerModal from './pos-components/AddCustomerModal';
import SaveCartModal from './pos-components/SaveCartModal';
import DiscountModal from './pos-components/DiscountModal';
import AssignCustomerModal from './pos-components/AssignCustomerModal';
import PhoneOrderModal from './pos-components/PhoneOrderModal';
import { printDeliveryLabel } from '@/utils/deliveryLabel';

const PosView = ({ products, handlers, settings, savedCarts = [] }) => {
  const [loadedCartId, setLoadedCartId] = useState(null);
  const [saleState, setSaleState] = useState({ stage: 'customer_lookup', customer: null, cart: [], discount: { type: 'none', value: 0 } });
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [isAddCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [isAssignCustomerModalOpen, setAssignCustomerModalOpen] = useState(false);
  const [isSaveCartModalOpen, setSaveCartModalOpen] = useState(false);
  const [isDiscountModalOpen, setDiscountModalOpen] = useState(false);
  const [isPhoneOrderModalOpen, setPhoneOrderModalOpen] = useState(false);
  const [phoneOrderDraft, setPhoneOrderDraft] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);
  const [showSavedCarts, setShowSavedCarts] = useState(false);

  const [isAddProductModalOpen, setAddProductModalOpen] = useState(false);
  const [productNameToAdd, setProductNameToAdd] = useState('');
  const [addToLibrary, setAddToLibrary] = useState(true);

  useHotkeys([['f2', (e) => { e.preventDefault(); searchInputRef.current?.focus(); }]]);

  useEffect(() => {
    const handleGlobalKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length === 1 || e.key === 'Backspace') {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (e.key === 'Backspace') {
          setSearchValue(prev => prev.slice(0, -1));
        } else {
          setSearchValue(prev => prev + e.key);
        }
      }
    };
    if (saleState.stage !== 'customer_lookup' && saleState.stage !== 'completed') {
      document.addEventListener('keydown', handleGlobalKeyPress);
      return () => document.removeEventListener('keydown', handleGlobalKeyPress);
    }
  }, [saleState.stage]);

  // Get default tax from settings
  const defaultTax = useMemo(() => {
    return settings?.taxes?.find(tax => tax.is_default);
  }, [settings?.taxes]);

  const handleAddToCart = useCallback((product) => {
    if (product.isCustom) {
       setSaleState(prev => ({ 
         ...prev, 
         cart: [...prev.cart, { 
           ...product, 
           quantity: 1, 
           id: `custom-${Date.now()}`,
           taxable: true // Set taxable by default
         }] 
       }));
       // Removed success toast on add-to-cart per request
       return;
    }

    if (product.stock <= 0) {
      toast({ title: "Out of Stock", description: `${product.name} is currently unavailable.`, variant: "destructive" });
      return;
    }
    setSaleState(prev => {
      const existingItem = prev.cart.find(item => item.id === product.id);
      let newCart;
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          toast({ title: "Stock Limit Reached", description: `You cannot add more of ${product.name}.`, variant: "destructive" });
          return prev;
        }
        newCart = prev.cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        newCart = [...prev.cart, { ...product, quantity: 1, taxable: true }];
      }
      return { ...prev, cart: newCart };
    });
  // Removed success toast on add-to-cart per request
    
    setSearchValue('');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  const handleToggleItemTaxable = useCallback((itemId) => {
    setSaleState(prev => ({
      ...prev,
      cart: prev.cart.map(item => 
        item.id === itemId 
          ? { ...item, taxable: !item.taxable }
          : item
      )
    }));
  }, []);

  const handleUpdateCartQuantity = useCallback((productId, newQuantity) => {
    setSaleState(prev => {
      let newCart;
      if (newQuantity <= 0) {
        newCart = prev.cart.filter(item => item.id !== productId);
      } else {
        const product = products.find(p => p.id === productId);
        if (product && !product.isCustom && newQuantity > product.stock) {
          toast({ title: "Stock Limit Reached", description: `Only ${product.stock} of ${product.name} available.`, variant: "destructive" });
          newCart = prev.cart.map(item => item.id === productId ? { ...item, quantity: product.stock } : item);
        } else {
          newCart = prev.cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item);
        }
      }
      return { ...prev, cart: newCart };
    });
  }, [products]);

  const { subtotal, discountAmount, totalAfterDiscount, appliedTaxes, appliedServiceCharges, total } = useMemo(() => {
    const sub = saleState.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    let discountAmt = 0;
    if (saleState.discount.type === 'percentage') {
      discountAmt = sub * (saleState.discount.value / 100);
    } else if (saleState.discount.type === 'fixed') {
      discountAmt = saleState.discount.value;
    }
    
    const totalAfterDisc = Math.max(0, sub - discountAmt);

    const taxes = (handlers?.taxes && handlers.taxes.getApplicable) ? handlers.taxes.getApplicable(totalAfterDisc, saleState.cart) : [];
    
    const taxAmount = taxes.reduce((sum, t) => sum + t.amount, 0);

    const serviceCharges = (handlers?.serviceCharges && handlers.serviceCharges.getApplicable) ? handlers.serviceCharges.getApplicable(totalAfterDisc) : [];
    const serviceChargeAmount = serviceCharges.reduce((sum, sc) => sum + sc.amount, 0);
    const finalTotal = totalAfterDisc + taxAmount + serviceChargeAmount;

    return {
      subtotal: sub,
      discountAmount: discountAmt,
      totalAfterDiscount: totalAfterDisc,
      appliedTaxes: taxes,
      appliedServiceCharges: serviceCharges,
      total: finalTotal,
    };
  }, [saleState.cart, saleState.discount, handlers?.taxes, handlers?.serviceCharges]);

  // Check if taxes are configured and show warning if not
  useEffect(() => {
    if (handlers?.taxes && saleState.cart.length > 0) {
      const taxes = handlers.taxes.getApplicable(subtotal, saleState.cart);
      if (taxes.length === 0 && subtotal > 0) {
        // Only show warning once per session
        const warningShown = sessionStorage.getItem('taxWarningShown');
        if (!warningShown) {
          toast({
            title: "⚠️ No Tax Configured",
            description: "Sales tax is not configured. Go to Settings > Financials to add a default tax rate.",
            variant: "default",
            duration: 8000,
          });
          sessionStorage.setItem('taxWarningShown', 'true');
        }
      }
    }
  }, [handlers?.taxes, saleState.cart.length, subtotal]);

  const handleProcessSale = async (paymentDetails) => {
    console.log('💰 Processing sale...');
    console.log('💰 Applied taxes:', appliedTaxes);
    console.log('💰 Applied service charges:', appliedServiceCharges);
    
    // Calculate total tax amount for legacy column
    const totalTaxAmount = appliedTaxes.reduce((sum, t) => sum + t.amount, 0);
    const totalServiceAmount = appliedServiceCharges.reduce((sum, sc) => sum + sc.amount, 0);
    const primaryTaxRate = appliedTaxes.length > 0 ? appliedTaxes[0].rate : 0;
    
    const saleData = {
        items: saleState.cart.map(({...item}) => {
          // Ensure product_id is set (use id as fallback for custom items)
          return {
            product_id: item.product_id || item.id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            cost_price: item.cost_price,
            sku: item.sku,
            isCustom: item.isCustom
          };
        }),
        total: total,
        subtotal: subtotal,
        customer_id: saleState.customer?.id || null,
        payment_method: paymentDetails.paymentMethod,
        // New JSONB format (primary)
        taxes: appliedTaxes.map(t => ({ name: t.name, rate: t.rate, amount: t.amount })),
        service_charges_applied: appliedServiceCharges.map(sc => ({ name: sc.name, type: sc.type, value: sc.value, amount: sc.amount })),
        // Legacy columns for backward compatibility
        tax_rate: primaryTaxRate,
        tax_amount: totalTaxAmount,
        service_charge: totalServiceAmount,
        timestamp: new Date().toISOString(),
    };
    
    console.log('💰 Sale data being saved:', saleData);
    
    try {
        const newSale = await handlers.sales.add(saleData);
        console.log('💰 Sale saved, returned data:', newSale);
        // If this was a phone order, create a delivery record and optionally update customer address
        if (phoneOrderDraft?.address) {
          // Update customer profile address if requested
          if (phoneOrderDraft.saveToProfile && saleState.customer?.id && handlers?.customers?.update) {
            try {
              await handlers.customers.update({ ...saleState.customer, address: phoneOrderDraft.address });
            } catch {}
          }
          // Create delivery record
          try {
            const delivery = await handlers.deliveries.add({
              sale_id: newSale.id,
              customer_id: saleState.customer?.id || null,
              address: phoneOrderDraft.address,
              instructions: phoneOrderDraft.instructions || '',
              status: 'pending',
            });
            console.log('📦 Delivery record created:', delivery);
          } catch (err) {
            console.error('❌ Failed to create delivery:', err);
            toast({
              title: 'Delivery Error',
              description: 'Sale completed but delivery record failed to save.',
              variant: 'destructive',
            });
          }
          // Print delivery label - use items from saved sale or cart
          const saleItems = newSale.items || saleState.cart || [];
          try {
            console.log('📦 Printing delivery label with items:', saleItems);
            printDeliveryLabel({
              order: newSale,
              customer: saleState.customer,
              address: phoneOrderDraft.address,
              instructions: phoneOrderDraft.instructions,
              items: saleItems,
            });
          } catch (err) {
            console.error('❌ Failed to print delivery label:', err);
          }
        }
        
        // If this sale was from a loaded cart, delete the saved cart
        if (loadedCartId) {
          await handlers.savedCarts.delete(loadedCartId);
          setLoadedCartId(null);
        }
        
        setLastSale(newSale);
        setSaleState({ ...saleState, stage: 'completed' });
        setPhoneOrderModalOpen(false);
        setPhoneOrderDraft(null);
        setCheckoutOpen(false);
        
        // Log sale data for debugging receipt
        console.log('🧾 Sale completed. Last sale set to:', {
          id: newSale.id,
          items: newSale.items,
          total: newSale.total,
          taxes: newSale.taxes,
          customer: saleState.customer
        });
        
        toast({ title: 'Sale Completed!', description: `Total: $${total.toFixed(2)}` });
    } catch (error) {
        console.error("Error processing sale:", error);
        toast({ title: 'Error Processing Sale', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveCart = async (cartData) => {
    try {
      const saveData = {
        customer_id: saleState.customer?.id || null,
        items: saleState.cart,
        total: total,
        name: cartData.name,
        notes: cartData.notes
      };
      const savedCart = await handlers.savedCarts.add(saveData);
      toast({ title: "Cart Saved", description: "Your cart has been saved successfully!" });
      setSaveCartModalOpen(false);
    } catch (error) {
      console.error('Error saving cart:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLoadSavedCart = (cart) => {
    const customer = cart.customer_id ? {
      id: cart.customer_id,
      name: cart.customers?.name || 'Unknown Customer',
      phone: cart.customers?.phone || ''
    } : null;
    
    setSaleState({
      stage: 'scanning',
      customer: customer,
      cart: cart.items,
      discount: { type: 'none', value: 0 }
    });
    setLoadedCartId(cart.id);
    setShowSavedCarts(false);
    toast({ title: "Cart Loaded", description: `Loaded cart "${cart.name || 'Unnamed Cart'}".` });
  };

  const handleDeleteSavedCart = async (cartId) => {
    if (window.confirm("Are you sure you want to delete this saved cart?")) {
      try {
        await handlers.savedCarts.delete(cartId);
        toast({ title: "Cart Deleted", description: "The saved cart has been removed." });
      } catch (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleAssignCustomerToSale = (customer) => {
    setSaleState(prev => ({ ...prev, customer }));
    toast({ title: "Customer Assigned", description: `${customer.name} has been assigned to this sale.` });
    setAssignCustomerModalOpen(false);
  };

  const handleAddCustomerToSale = async (customerData) => {
    try {
      const phoneDigits = (customerData.phone || '').replace(/\D/g, '');
      if (phoneDigits) {
        const found = await handlers.customers.findByPhone(phoneDigits);
        let matches = [];
        if (found) {
          matches = found.multiple ? found.matches : [found];
          matches = matches.filter(m => (m.phone || '').replace(/\D/g, '') === phoneDigits);
        }
        if (matches.length > 0) {
          const names = matches.map(m => m.name).join(', ');
          if (window.confirm(`A customer with this phone already exists: ${names}.\nUse existing for this sale?`)) {
            handleAssignCustomerToSale(matches[0]);
            setAddCustomerModalOpen(false);
            return;
          }
          if (window.confirm('Merge new details into the existing customer and use that? (OK = merge, Cancel = create new)')) {
            const base = matches[0];
            const merged = {
              ...base,
              name: customerData.name || base.name,
              email: customerData.email || base.email,
              address: customerData.address || base.address,
              phone: base.phone || customerData.phone
            };
            const updated = await handlers.customers.update(merged);
            handleAssignCustomerToSale(updated);
            setAddCustomerModalOpen(false);
            return;
          }
        }
      }
      const newCustomer = await handlers.customers.add(customerData);
      handleAssignCustomerToSale(newCustomer);
      setAddCustomerModalOpen(false);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handleAddNewProduct = useCallback((productName) => {
    setProductNameToAdd(productName);
    setAddToLibrary(true);
    setAddProductModalOpen(true);
  }, []);

  const resetSale = () => {
    setSaleState({ stage: 'customer_lookup', customer: null, cart: [], discount: { type: 'none', value: 0 } });
    setLastSale(null);
  };

  // Simple receipt printing function
  const handlePrintReceipt = () => {
    console.log('🖨️ Print Receipt button clicked');
    console.log('🖨️ lastSale:', lastSale);
    
    if (!lastSale) {
      console.log('❌ No lastSale data available');
      toast({ 
        title: "No Receipt Available", 
        description: "Cannot print - no sale data found.",
        variant: "destructive"
      });
      return;
    }

    console.log('✅ lastSale exists, generating receipt HTML');
    
    // Create receipt HTML
    const storeName = settings?.storeName?.value || 'StorePilot';
    const storeAddress = settings?.storeAddress?.value || '';
    const storePhone = settings?.storePhone?.value || '';
    
    console.log('🏪 Store info:', { storeName, storeAddress, storePhone });
    console.log('📦 Sale items:', lastSale.items);
    
    const subtotal = typeof lastSale.subtotal === 'number' ? lastSale.subtotal : 
      lastSale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const taxes = Array.isArray(lastSale.taxes) && lastSale.taxes.length > 0 
      ? lastSale.taxes 
      : (lastSale.tax_amount > 0 ? [{ name: 'Sales Tax', rate: lastSale.tax_rate || 0, amount: lastSale.tax_amount }] : []);
    
    const totalTax = taxes.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const serviceCharges = Array.isArray(lastSale.service_charges_applied) && lastSale.service_charges_applied.length > 0
      ? lastSale.service_charges_applied
      : (lastSale.service_charge > 0 ? [{ name: 'Service Charge', amount: lastSale.service_charge }] : []);
    
    const totalServiceCharge = serviceCharges.reduce((sum, sc) => sum + (sc.amount || 0), 0);
    
    console.log('💰 Calculated values:', { subtotal, totalTax, totalServiceCharge, total: lastSale.total });
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            width: 80mm;
            padding: 5mm;
            margin: 0;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .receipt-header { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #000; }
          .receipt-items { margin: 10px 0; }
          .item-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .item-name { flex: 1; }
          .item-qty { width: 40px; text-align: center; }
          .item-price { width: 70px; text-align: right; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .totals { margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .total-label { flex: 1; }
          .total-value { width: 70px; text-align: right; }
          .grand-total { font-weight: bold; font-size: 14px; margin-top: 5px; padding-top: 5px; border-top: 2px solid #000; }
          .receipt-footer { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #000; text-align: center; font-size: 11px; }
          @media print {
            body { width: 80mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-header center">
          <div class="bold" style="font-size: 16px;">${storeName}</div>
          ${storeAddress ? `<div>${storeAddress}</div>` : ''}
          ${storePhone ? `<div>${storePhone}</div>` : ''}
          <div style="margin-top: 8px;">${new Date(lastSale.created_at || Date.now()).toLocaleString()}</div>
          ${lastSale.customer ? `<div>Customer: ${lastSale.customer.name || 'Guest'}</div>` : '<div>Guest Sale</div>'}
        </div>

        <div class="receipt-items">
          ${lastSale.items.map(item => `
            <div class="item-row">
              <div class="item-name">${item.name}</div>
              <div class="item-qty">x${item.quantity}</div>
              <div class="item-price">$${(item.price * item.quantity).toFixed(2)}</div>
            </div>
          `).join('')}
        </div>

        <div class="divider"></div>

        <div class="totals">
          <div class="total-row">
            <div class="total-label">Subtotal:</div>
            <div class="total-value">$${subtotal.toFixed(2)}</div>
          </div>
          ${taxes.map(tax => `
            <div class="total-row">
              <div class="total-label">${tax.name} (${(tax.rate * 100).toFixed(2)}%):</div>
              <div class="total-value">$${tax.amount.toFixed(2)}</div>
            </div>
          `).join('')}
          ${serviceCharges.map(sc => `
            <div class="total-row">
              <div class="total-label">${sc.name}:</div>
              <div class="total-value">$${sc.amount.toFixed(2)}</div>
            </div>
          `).join('')}
          ${lastSale.discount_amount > 0 ? `
            <div class="total-row">
              <div class="total-label">Discount:</div>
              <div class="total-value">-$${lastSale.discount_amount.toFixed(2)}</div>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <div class="total-label">TOTAL:</div>
            <div class="total-value">$${lastSale.total.toFixed(2)}</div>
          </div>
          <div class="total-row">
            <div class="total-label">Payment Method:</div>
            <div class="total-value">${lastSale.payment_method || 'Cash'}</div>
          </div>
        </div>

        <div class="receipt-footer">
          <div>Thank you for your business!</div>
          <div style="margin-top: 5px;">Receipt #${lastSale.id?.slice(-8) || 'N/A'}</div>
        </div>
      </body>
      </html>
    `;

    console.log('📄 Receipt HTML generated, length:', receiptHTML.length);
    
    // Open print window
    console.log('🪟 Opening print window...');
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      console.log('❌ Print window blocked by browser');
      toast({ 
        title: "Print Blocked", 
        description: "Please allow popups for this site to print receipts.",
        variant: "destructive"
      });
      return;
    }
    
    console.log('✅ Print window opened successfully');
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    console.log('📝 HTML written to print window');
    
    // Wait for content to load then print
    printWindow.onload = () => {
      console.log('✅ Print window loaded, triggering print dialog');
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        toast({ 
          title: "Receipt Printed", 
          description: "Receipt sent to printer successfully" 
        });
        console.log('✅ Print dialog triggered');
      }, 250);
    };
  };

  const handleApplyDiscount = (type, value) => {
    setSaleState(prev => ({ ...prev, discount: { type, value } }));
    setDiscountModalOpen(false);
  };

  const handleRemoveDiscount = () => {
    setSaleState(prev => ({ ...prev, discount: { type: 'none', value: 0 } }));
    toast({ title: "Discount Removed" });
  };

  if (saleState.stage === 'customer_lookup') {
    return <CustomerLookup
      handlers={handlers}
      savedCarts={savedCarts}
      onCustomerSelect={(customer) => {
        setSaleState({ ...saleState, stage: 'scanning', customer });
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }}
      onSkip={() => {
        setSaleState({ ...saleState, stage: 'scanning', customer: null });
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }}
      onLoadSavedCart={handleLoadSavedCart}
      onDeleteSavedCart={handleDeleteSavedCart}
      showSavedCarts={showSavedCarts}
      setShowSavedCarts={setShowSavedCarts}
    />;
  }

  if (saleState.stage === 'completed') {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-6 sm:p-8 bg-card rounded-2xl shadow-xl w-full max-w-md"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-green-500 mb-3 sm:mb-4">Sale Successful!</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">What would you like to do next?</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button onClick={handlePrintReceipt} variant="outline" className="w-full sm:w-auto">
              <Receipt className="w-4 h-4 mr-2" /> Print Receipt
            </Button>
            <Button onClick={resetSale} className="w-full sm:w-auto">Start New Sale</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const MainContent = () => (
    <>
      {saleState.customer && (
        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-secondary rounded-lg flex justify-between items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground">Customer:</p>
            <button 
              onClick={() => setCustomerModalOpen(true)}
              className="text-base sm:text-lg font-medium text-primary hover:underline cursor-pointer truncate block"
            >
              {saleState.customer.name} <Edit className="w-3 h-3 sm:w-4 sm:h-4 inline ml-1" />
            </button>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{saleState.customer.phone}</p>
          </div>
        </div>
      )}

      {!saleState.customer && (
        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-secondary rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <div>
            <p className="text-base sm:text-lg font-medium">Guest Sale</p>
            <p className="text-xs sm:text-sm text-muted-foreground">No customer assigned</p>
          </div>
          <Button onClick={() => setAssignCustomerModalOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto">
            <UserPlus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      )}

      <div className="flex-grow overflow-hidden flex flex-col bg-secondary rounded-xl">
        {saleState.cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <ShoppingCart className="w-16 h-16 sm:w-24 sm:h-24 text-muted-foreground/10 mx-auto mb-4" />
            <p className="text-sm sm:text-base text-muted-foreground font-medium">Cart is empty</p>
            <p className="text-xs sm:text-sm text-muted-foreground/50">Start typing to search for products</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3">
            <AnimatePresence>
              {saleState.cart.map((item) => (
                                <CartItem 
                  key={item.id} 
                  item={item} 
                  onUpdateQuantity={handleUpdateCartQuantity}
                  onToggleTaxable={handleToggleItemTaxable}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <div className="pt-3 sm:pt-4 mt-auto">
        <ProductSearch
          ref={searchInputRef}
          products={products}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          onAddToCart={handleAddToCart}
          onAddNewProduct={handleAddNewProduct}
        />

        <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center">
                Discount
                {saleState.discount.type === 'percentage' && ` (${saleState.discount.value}%)`}
                <Button variant="ghost" size="icon" className="w-5 h-5 sm:w-6 sm:h-6 ml-1 text-destructive" onClick={handleRemoveDiscount}><Trash2 className="w-3 h-3" /></Button>
              </span>
              <span className="font-medium">-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          {appliedTaxes.map(t => (
            <div key={t.name} className="flex justify-between">
              <span className="text-muted-foreground">Tax ({t.name} @ {t.rate}%)</span>
              <span className="font-medium">${t.amount.toFixed(2)}</span>
            </div>
          ))}
          {appliedServiceCharges.map(sc => (
            <div key={sc.name} className="flex justify-between">
              <span className="text-muted-foreground">{sc.name}</span>
              <span className="font-medium">${sc.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-3 sm:mt-4 gap-3">
          <div className="order-2 sm:order-1">
            <span className="text-base sm:text-lg font-bold block sm:inline">Total:</span>
            <span className="text-xl sm:text-2xl font-bold text-primary ml-0 sm:ml-2 block sm:inline">${total.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap gap-2 order-1 sm:order-2">
             <Button
              onClick={() => setSaveCartModalOpen(true)}
              disabled={saleState.cart.length === 0}
              variant="outline"
              className="font-semibold py-2 sm:py-3 px-3 sm:px-6 rounded-xl text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Save className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
              onClick={() => setDiscountModalOpen(true)}
              disabled={saleState.cart.length === 0}
              variant="outline"
              className="font-semibold py-2 sm:py-3 px-3 sm:px-6 rounded-xl text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Percent className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
              <span className="hidden sm:inline">Discount</span>
            </Button>
            <Button
              onClick={() => setPhoneOrderModalOpen(true)}
              disabled={saleState.cart.length === 0}
              variant="outline"
              className="font-semibold py-2 sm:py-3 px-3 sm:px-6 rounded-xl text-xs sm:text-sm hidden md:flex"
              title="Create Phone Order"
            >
              Phone Order
            </Button>
            <Button
              onClick={() => setCheckoutOpen(true)}
              disabled={saleState.cart.length === 0}
              className="pos-button font-semibold py-2 sm:py-3 px-4 sm:px-8 rounded-xl text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              Checkout
            </Button>
          </div>
        </div>
      </div>
    </>
  );
  
  const posLayout = settings?.posLayout?.value || 'default';

  return (
    <>
      <motion.div
        key="pos-scanning"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex flex-col p-3 sm:p-4 md:p-6"
      >
        <div className="mb-3 sm:mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary">Point of Sale</h2>
        </div>

        {posLayout === 'compact' ? (
           <div className="flex-grow flex flex-col lg:flex-row gap-3 sm:gap-4 overflow-hidden">
              <div className="lg:w-1/2 flex flex-col">
                <div className="flex-grow bg-secondary rounded-xl flex items-center justify-center">
                  Product grid coming soon...
                </div>
              </div>
              <div className="lg:w-1/2 flex flex-col">
                <MainContent />
              </div>
          </div>
        ) : (
          <MainContent />
        )}

        <CheckoutModal 
            isOpen={isCheckoutOpen} 
            onOpenChange={setCheckoutOpen} 
            onSave={handleProcessSale}
            total={total}
            subtotal={subtotal}
            cart={saleState.cart}
            taxes={appliedTaxes}
            serviceCharges={appliedServiceCharges}
        />
      </motion.div>

      <CustomerDetailModal
        isOpen={isCustomerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        customer={saleState.customer}
        onSave={async (updatedCustomer) => {
          await handlers.customers.update(updatedCustomer);
          setSaleState(prev => ({ ...prev, customer: updatedCustomer }));
        }}
      />

      <AssignCustomerModal
        isOpen={isAssignCustomerModalOpen}
        onClose={() => setAssignCustomerModalOpen(false)}
        onAssignCustomer={handleAssignCustomerToSale}
        onAddNewCustomer={() => {
          setAssignCustomerModalOpen(false);
          setAddCustomerModalOpen(true);
        }}
        handlers={handlers}
      />

      <AddCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setAddCustomerModalOpen(false)}
        onSave={handleAddCustomerToSale}
      />

      <SaveCartModal
        isOpen={isSaveCartModalOpen}
        onClose={() => setSaveCartModalOpen(false)}
        onSave={handleSaveCart}
        customer={saleState.customer}
        cartTotal={total}
        itemCount={saleState.cart.length}
      />
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setDiscountModalOpen(false)}
        onApplyDiscount={handleApplyDiscount}
        onAddCustomItem={handleAddToCart}
        subtotal={subtotal}
      />
      <PhoneOrderModal
        isOpen={isPhoneOrderModalOpen}
        onClose={() => setPhoneOrderModalOpen(false)}
        customer={saleState.customer}
        onSubmit={({ address, instructions, saveToProfile }) => {
          setPhoneOrderDraft({ address, instructions, saveToProfile });
          // Open checkout after capturing delivery details
          setCheckoutOpen(true);
          setPhoneOrderModalOpen(false);
        }}
      />
      {isAddProductModalOpen && (
        <ProductDetailModal 
          isOpen={isAddProductModalOpen}
          onClose={() => {
            setAddProductModalOpen(false);
            setProductNameToAdd('');
            setAddToLibrary(true);
          }}
          product={{ name: productNameToAdd, price: 0, stock: 0 }}
          categories={[]}
          handlers={handlers}
          initialMode="edit"
          onSave={async (editedProduct) => {
            try {
              // If "Add to library" is checked, save to database
              if (addToLibrary && handlers?.products?.add) {
                await handlers.products.add(editedProduct);
                toast({ 
                  title: "Product Saved", 
                  description: `"${editedProduct.name}" has been added to your library and cart.` 
                });
              } else {
                // Otherwise just add as custom item to cart
                toast({ 
                  title: "Product Added", 
                  description: `"${editedProduct.name}" has been added to cart (not saved to library).` 
                });
              }
              
              // Add to cart
              const cartItem = {
                ...editedProduct,
                id: editedProduct.id || `custom-${Date.now()}`,
                quantity: 1,
                taxable: editedProduct.taxable !== false,
                isCustom: !addToLibrary
              };
              setSaleState(prev => ({
                ...prev,
                cart: [...prev.cart, cartItem]
              }));
              
              setAddProductModalOpen(false);
              setProductNameToAdd('');
              setAddToLibrary(true);
              setSearchValue('');
              setTimeout(() => searchInputRef.current?.focus(), 100);
            } catch (error) {
              toast({ 
                title: "Error", 
                description: error.message, 
                variant: "destructive" 
              });
            }
          }}
          onDelete={() => {
            setAddProductModalOpen(false);
            setProductNameToAdd('');
            setAddToLibrary(true);
          }}
          addToLibraryCheckbox={true}
          addToLibrary={addToLibrary}
          setAddToLibrary={setAddToLibrary}
        />
      )}

    </>
  );
};

export default PosView;