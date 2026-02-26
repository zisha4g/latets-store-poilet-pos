import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Trash2, Plus, Minus, Package, Search, UserCog, UserPlus } from 'lucide-react';

const OrderEditModal = ({ open, onClose, delivery, customer, sale, handlers, products = [], customers = [] }) => {
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState('pending');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Customer update mode: 'profile' = update globally, 'order' = pick/create different customer
  const [customerMode, setCustomerMode] = useState('profile');

  // Customer search for 'order' mode (pick existing customer)
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedNewCustomer, setSelectedNewCustomer] = useState(null);
  const customerSearchRef = useRef(null);

  // Create new customer sub-mode
  const [creatingNewCustomer, setCreatingNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Add item search
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchRef = useRef(null);

  // Initialize form when delivery changes
  useEffect(() => {
    if (delivery) {
      setAddress(delivery.address || '');
      setInstructions(delivery.instructions || '');
      setStatus(delivery.status || 'pending');
    }
    if (customer) {
      setCustomerName(customer.name || '');
      setCustomerPhone(customer.phone || '');
    }
    if (sale?.items) {
      setItems(
        (Array.isArray(sale.items) ? sale.items : []).map((item, i) => ({
          ...item,
          _key: `${item.product_id || i}-${i}`,
        }))
      );
    } else {
      setItems([]);
    }
    setCustomerMode('profile');
    setProductSearch('');
    setShowProductDropdown(false);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setSelectedNewCustomer(null);
    setDeleteConfirmOpen(false);
    setCreatingNewCustomer(false);
    setNewCustName('');
    setNewCustPhone('');
  }, [delivery, customer, sale]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowProductDropdown(false);
      }
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Recompute totals from items
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  }, [items]);

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 20);
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [products, productSearch]);

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 15);
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    ).slice(0, 15);
  }, [customers, customerSearch]);

  const updateItemQty = (index, delta) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newQty = Math.max(0, (item.quantity || 0) + delta);
      return { ...item, quantity: newQty };
    }).filter(item => item.quantity > 0));
  };

  const updateItemPrice = (index, price) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, price: parseFloat(price) || 0 } : item
    ));
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addProduct = (product) => {
    // Check if already in items
    const existingIndex = items.findIndex(i => i.product_id === product.id);
    if (existingIndex >= 0) {
      updateItemQty(existingIndex, 1);
    } else {
      setItems(prev => [...prev, {
        product_id: product.id,
        name: product.name,
        sku: product.sku || '',
        price: product.price || 0,
        cost_price: product.cost_price || 0,
        quantity: 1,
        _key: `${product.id}-${Date.now()}`,
      }]);
    }
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update delivery (address, instructions, status)
      if (delivery?.id) {
        await handlers.deliveries.update({
          id: delivery.id,
          address,
          instructions,
          status,
        });
      }

      // 2. Handle customer update based on mode
      if (customerMode === 'profile') {
        // Update customer record globally — all orders with this customer see the change
        const nameChanged = customerName !== (customer?.name || '');
        const phoneChanged = customerPhone !== (customer?.phone || '');
        if (customer?.id && (nameChanged || phoneChanged)) {
          await handlers.customers.update({
            id: customer.id,
            name: customerName,
            phone: customerPhone,
          });
        }
      } else if (customerMode === 'order') {
        let targetCustomerId = null;

        if (selectedNewCustomer) {
          // Picked an existing customer
          targetCustomerId = selectedNewCustomer.id;
        } else if (creatingNewCustomer && newCustName.trim()) {
          // Create a brand new customer
          const created = await handlers.customers.add({
            name: newCustName.trim(),
            phone: newCustPhone.trim() || null,
          });
          if (created?.id) targetCustomerId = created.id;
        }

        // Reassign delivery & sale to the new/picked customer
        if (targetCustomerId && targetCustomerId !== customer?.id) {
          await handlers.deliveries.update({ id: delivery.id, customer_id: targetCustomerId });
          if (sale?.id) {
            await handlers.sales.update({ id: sale.id, customer_id: targetCustomerId });
          }
        }
      }

      // 3. Update sale items & total
      if (sale?.id) {
        const updatedItems = items.map(({ _key, ...item }) => item);
        await handlers.sales.update({
          id: sale.id,
          items: updatedItems,
          subtotal,
          total: subtotal + (sale.tax_amount || 0) + (sale.service_charge || 0),
        });
      }

      toast({ title: 'Order Updated', description: 'All changes saved.' });
      onClose();
    } catch (e) {
      console.error('Save error:', e);
      toast({ title: 'Save Failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      if (delivery?.id) await handlers.deliveries.delete(delivery.id);
      if (sale?.id) await handlers.sales.delete(sale.id);
      toast({ title: 'Order Deleted' });
      onClose();
    } catch (e) {
      console.error('Delete error:', e);
      toast({ title: 'Delete Failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const pickExistingCustomer = (c) => {
    setSelectedNewCustomer(c);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="out-for-delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="space-y-3">
            <Label>Customer</Label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant={customerMode === 'profile' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 text-xs h-8"
                onClick={() => { setCustomerMode('profile'); setSelectedNewCustomer(null); }}
              >
                <UserCog className="w-3.5 h-3.5 mr-1.5" />
                Update Customer Profile
              </Button>
              <Button
                type="button"
                variant={customerMode === 'order' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 text-xs h-8"
                onClick={() => setCustomerMode('order')}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Change Customer for This Order
              </Button>
            </div>

            {customerMode === 'profile' ? (
              <>
                <p className="text-[11px] text-muted-foreground">Edit name/phone below — changes apply to the customer profile across all orders.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground">Pick an existing customer or create a new one. The original customer stays unchanged.</p>

                {/* Already selected a customer */}
                {selectedNewCustomer ? (
                  <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{selectedNewCustomer.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedNewCustomer.phone || '—'}</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setSelectedNewCustomer(null); setCreatingNewCustomer(false); }}>Change</Button>
                  </div>
                ) : creatingNewCustomer ? (
                  /* Create new customer form */
                  <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">New Customer</p>
                      <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setCreatingNewCustomer(false)}>Back to Search</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Customer name" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Phone</Label>
                        <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="Phone number" className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Search existing customers */
                  <div className="space-y-2">
                    <div className="relative" ref={customerSearchRef}>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search customers by name or phone…"
                          value={customerSearch}
                          onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                      {showCustomerDropdown && filteredCustomers.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left ${c.id === customer?.id ? 'opacity-50' : ''}`}
                              onClick={() => c.id !== customer?.id && pickExistingCustomer(c)}
                              disabled={c.id === customer?.id}
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-medium truncate block">{c.name}</span>
                                <span className="text-xs text-muted-foreground">{c.phone || '—'}</span>
                              </div>
                              {c.id === customer?.id && <span className="text-[10px] text-muted-foreground ml-2">(current)</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => { setCreatingNewCustomer(true); setShowCustomerDropdown(false); }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Create New Customer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label>Delivery Address</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label>Instructions / Notes</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Leave at door, ring bell..."
            />
          </div>

          {/* Order Items */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Order Items
            </Label>

            {/* Add item search */}
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search products to add…"
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                      onClick={() => addProduct(p)}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium truncate block">{p.name}</span>
                        {p.sku && <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>}
                      </div>
                      <span className="text-xs font-medium ml-2 shrink-0">${(p.price || 0).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Card className="divide-y">
              {items.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No items</div>
              ) : (
                items.map((item, index) => (
                  <div key={item._key} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name || 'Unknown Item'}</p>
                      <p className="text-xs text-muted-foreground">SKU: {item.sku || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateItemQty(index, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateItemQty(index, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItemPrice(index, e.target.value)}
                        className="h-8 text-sm text-right"
                      />
                    </div>
                    <span className="w-20 text-sm font-medium text-right">
                      ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
              {items.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 bg-muted/50 font-medium">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              )}
            </Card>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? 'Deleting…' : 'Delete Order'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default OrderEditModal;
