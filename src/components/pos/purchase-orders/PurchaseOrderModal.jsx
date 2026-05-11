import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Printer } from 'lucide-react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { toast } from '@/components/ui/use-toast';
import VendorModal from '../VendorModal';
import ProductDetailModal from '../ProductDetailModal';
import PrintLabelsModal from '../PrintLabelsModal';
import VendorCombobox from './VendorCombobox';
import PurchaseOrderItemPicker from './PurchaseOrderItemPicker';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const PurchaseOrderModal = ({ isOpen, onClose, purchaseOrder, vendors, products, handlers, onRefresh }) => {
  const [po, setPo] = useState(null);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPrintLabelsModalOpen, setIsPrintLabelsModalOpen] = useState(false);
  const [productsToPrint, setProductsToPrint] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (purchaseOrder) {
      setPo({ ...purchaseOrder, items: purchaseOrder.items || [] });
    } else {
      setPo({
        vendor_id: null,
        po_number: `PO-${Date.now()}`,
        status: 'Draft',
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
        notes: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: null,
      });
    }
  }, [purchaseOrder]);

  useEffect(() => {
    if (po) {
      const subtotal = po.items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);
      const total = subtotal + (po.tax || 0) + (po.shipping || 0);
      setPo(prev => ({ ...prev, subtotal, total }));
    }
  }, [po?.items, po?.tax, po?.shipping]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...po.items];
    newItems[index][field] = value;
    setPo(prev => ({ ...prev, items: newItems }));
  };

  const handleAddItem = (product) => {
    if (po.items.some(item => item.product_id === product.id)) {
      toast({ title: "Product already in PO", variant: "destructive" });
      return;
    }
    const newItem = {
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      quantity: 1,
      cost_price: product.cost_price || 0,
    };
    setPo(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const handleRemoveItem = (index) => {
    const newItems = po.items.filter((_, i) => i !== index);
    setPo(prev => ({ ...prev, items: newItems }));
  };

  const handleSave = async (newStatus) => {
    const dataToSave = { ...po };
    if (newStatus) {
      dataToSave.status = newStatus;
    }
    try {
      let savedPO;
      if (dataToSave.id) {
        savedPO = await handlers.purchase_orders.update(dataToSave);
      } else {
        savedPO = await handlers.purchase_orders.add(dataToSave);
      }
      toast({ title: "Purchase Order Saved" });
      onRefresh();
      if (newStatus !== 'Received') {
        onClose();
      }
      return savedPO;
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleReceiveOrder = async () => {
    if (!window.confirm("Are you sure you want to mark this order as received? This will update stock levels and cannot be undone.")) return;

    try {
      const { error: rpcError } = await supabase.rpc('update_product_stock_from_po', {
        po_id: po.id,
        p_user_id: user.id
      });

      if (rpcError) {
        throw rpcError;
      }

      await handleSave('Received');
      
      handleOpenPrintLabels();

      toast({ title: "Order Received", description: "Stock levels have been updated." });
      onRefresh();
    } catch (error) {
      toast({ title: "Error Receiving Order", description: error.message, variant: "destructive" });
    }
  };

  const handleOpenPrintLabels = () => {
    const receivedProducts = po.items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        ...product,
        quantity: item.quantity,
      };
    }).filter(Boolean);

    setProductsToPrint(receivedProducts);
    setIsPrintLabelsModalOpen(true);
  };

  const handleSaveVendor = async (vendorData) => {
    try {
      const newVendor = await handlers.vendors.add(vendorData);
      setPo(prev => ({ ...prev, vendor_id: newVendor.id }));
      setIsVendorModalOpen(false);
      onRefresh();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveProduct = async (productData) => {
    try {
      const newProduct = await handlers.products.add(productData);
      handleAddItem(newProduct);
      setIsProductModalOpen(false);
      onRefresh();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (!po) return null;

  const isReceived = po.status === 'Received';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{po.id ? `Edit Purchase Order #${po.po_number}` : 'Create Purchase Order'}</DialogTitle>
            <DialogDescription>Manage items to order from your vendors.</DialogDescription>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto pr-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <Label>Vendor</Label>
                <VendorCombobox
                  vendors={vendors}
                  value={po.vendor_id || null}
                  onChange={(id) => setPo((p) => ({ ...p, vendor_id: id }))}
                  onAddNew={() => setIsVendorModalOpen(true)}
                  disabled={isReceived}
                />
              </div>
              <div><Label>PO Number</Label><Input value={po.po_number} onChange={e => setPo(p => ({ ...p, po_number: e.target.value }))} disabled={isReceived} /></div>
              <div><Label>Order Date</Label><Input type="date" value={po.order_date} onChange={e => setPo(p => ({ ...p, order_date: e.target.value }))} disabled={isReceived} /></div>
              <div><Label>Status</Label><Input value={po.status} disabled /></div>
            </div>

            <div className="mb-4">
              <Label>Add Items</Label>
              <PurchaseOrderItemPicker
                products={products}
                onAddItem={handleAddItem}
                onAddNew={() => setIsProductModalOpen(true)}
                disabled={isReceived}
                selectedProductIds={po.items.map((it) => it.product_id).filter(Boolean)}
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-secondary"><tr className="text-left text-xs font-medium text-muted-foreground uppercase">
                  <th className="p-2">Product</th><th className="p-2 w-24">Quantity</th><th className="p-2 w-32">Cost Price</th><th className="p-2 w-32">Total</th><th className="p-2 w-12"></th>
                </tr></thead>
                <tbody>
                  {po.items.map((item, index) => (
                    <tr key={item.product_id} className="border-b">
                      <td className="p-2">{item.name} <span className="text-xs text-muted-foreground">({item.sku})</span></td>
                      <td className="p-2"><Input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))} className="h-8" disabled={isReceived} /></td>
                      <td className="p-2"><CurrencyInput value={item.cost_price} onChange={val => handleItemChange(index, 'cost_price', val)} className="h-8" disabled={isReceived} /></td>
                      <td className="p-2">${(item.quantity * item.cost_price).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        {!isReceived && <Button size="icon" variant="ghost" onClick={() => handleRemoveItem(index)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="md:col-span-2"></div>
              <div className="space-y-2">
                <div className="flex justify-between"><Label>Subtotal</Label><span>${po.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between items-center"><Label>Shipping</Label><CurrencyInput value={po.shipping} onChange={val => setPo(p => ({ ...p, shipping: val }))} className="h-8 w-32" disabled={isReceived} /></div>
                <div className="flex justify-between items-center"><Label>Tax</Label><CurrencyInput value={po.tax} onChange={val => setPo(p => ({ ...p, tax: val }))} className="h-8 w-32" disabled={isReceived} /></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><Label>Total</Label><span>${po.total.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          <DialogFooter>
            {isReceived && (
              <Button variant="outline" onClick={handleOpenPrintLabels}>
                <Printer className="w-4 h-4 mr-2" />
                Print Labels
              </Button>
            )}
            {!isReceived && (
              <>
                <Button variant="outline" onClick={() => handleSave('Draft')}>Save as Draft</Button>
                <Button onClick={() => handleSave('Ordered')}>Mark as Ordered</Button>
              </>
            )}
            {po.status === 'Ordered' && <Button className="bg-green-600 hover:bg-green-700" onClick={handleReceiveOrder}>Receive Order</Button>}
            <Button onClick={onClose}>{isReceived ? 'Close' : 'Cancel'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isVendorModalOpen && <VendorModal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} onSave={handleSaveVendor} />}
      {isProductModalOpen && <ProductDetailModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} product={{}} categories={[]} onSave={handleSaveProduct} handlers={handlers} initialMode="edit" />}
      {isPrintLabelsModalOpen && <PrintLabelsModal isOpen={isPrintLabelsModalOpen} onClose={() => setIsPrintLabelsModalOpen(false)} selectedProducts={productsToPrint} source="po" />}
    </>
  );
};

export default PurchaseOrderModal;