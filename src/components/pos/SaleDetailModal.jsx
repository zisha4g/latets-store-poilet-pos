import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const SaleDetailModal = ({ sale, customer, isOpen, onClose, footerContent }) => {
  if (!sale) return null;

  const itemsSubtotal = Array.isArray(sale.items)
    ? sale.items.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 0), 0)
    : (sale.subtotal || 0);
  const taxesArray = Array.isArray(sale.taxes)
    ? sale.taxes
    : (typeof sale.tax_amount === 'number' ? [{ name: 'Tax', rate: sale.tax_rate || null, amount: sale.tax_amount }] : []);
  const taxAmount = taxesArray.reduce((s, t) => s + (t.amount || 0), 0);
  const serviceCharges = Array.isArray(sale.service_charges_applied)
    ? sale.service_charges_applied
    : (typeof sale.service_charge === 'number' && sale.service_charge > 0 ? [{ name: 'Service', type: 'flat', value: sale.service_charge, amount: sale.service_charge }] : []);
  const serviceAmount = serviceCharges.reduce((s, sc) => s + (sc.amount || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Sale Details</DialogTitle>
          <DialogDescription>
            Sale #{sale.id.slice(0, 8)} on {new Date(sale.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {customer && (
            <div className="bg-secondary p-3 rounded-lg">
              <h4 className="font-semibold">Customer</h4>
              <p>{customer.name}</p>
              <p className="text-sm text-muted-foreground">{customer.phone}</p>
            </div>
          )}
          <div>
            <h4 className="font-semibold mb-2">Items</h4>
            <ScrollArea className="h-48 border rounded-lg p-2">
              <div className="space-y-2">
                {sale.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold">${(item.quantity * item.price).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="bg-secondary p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${itemsSubtotal.toFixed(2)}</span>
            </div>
            {taxesArray.length > 0 ? (
              taxesArray.map((t, idx) => (
                <div className="flex justify-between" key={`tax-${idx}`}>
                  <span>Tax{t.name ? ` - ${t.name}` : ''}{typeof t.rate === 'number' ? ` (${t.rate}%)` : ''}:</span>
                  <span>${(t.amount || 0).toFixed(2)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>$0.00</span>
              </div>
            )}
            {serviceCharges.length > 0 ? (
              serviceCharges.map((sc, idx) => (
                <div className="flex justify-between" key={`svc-${idx}`}>
                  <span>Service Charge{sc.name ? ` - ${sc.name}` : ''}:</span>
                  <span>${(sc.amount || 0).toFixed(2)}</span>
                </div>
              ))
            ) : (
              <div className="flex justify-between">
                <span>Service Charge:</span>
                <span>$0.00</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
              <span>Total:</span>
              <span>${sale.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Payment Method:</span>
              <span className="capitalize">{sale.payment_method}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <div>{footerContent}</div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaleDetailModal;