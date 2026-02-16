import React, { useState, useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import { Plus, Trash2, Edit, Save, X, Download, Mail, Check, ChevronsUpDown } from 'lucide-react';
    import CurrencyInput from '../ui/CurrencyInput';
    import { generateInvoicePdf } from '@/utils/pdfGenerator';
    import { supabase } from '@/lib/customSupabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
    import { cn } from '@/lib/utils';

    const Combobox = ({ options, value, onSelect, placeholder, searchPlaceholder, emptyText }) => {
      const [open, setOpen] = useState(false);
      const selectedOption = options.find(option => option.value === value);

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedOption ? selectedOption.label : placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(currentValue) => {
                        onSelect(currentValue === value ? "" : currentValue);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    };

    const InvoiceModal = ({ isOpen, onClose, invoice, customers, products, onSave, initialMode = 'view', settings }) => {
      const [formData, setFormData] = useState(invoice);
      const [isEditing, setIsEditing] = useState(initialMode === 'edit');
      const [isSending, setIsSending] = useState(false);

      useEffect(() => {
        setFormData(invoice);
        setIsEditing(initialMode === 'edit' || !invoice?.id);
      }, [invoice, initialMode]);

      if (!isOpen || !formData) return null;

      const customerOptions = customers.map(c => ({ value: c.id, label: `${c.name} (${c.phone})` }));
      const productOptions = products.map(p => ({ value: p.id, label: `${p.name} - $${p.price}` }));

      const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
      };

      const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        
        if (field === 'quantity' || field === 'price') {
          newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].price || 0);
        }
        
        setFormData(prev => ({ ...prev, items: newItems }));
        calculateTotals(newItems);
      };

      const addItem = () => {
        const newItems = [...formData.items, { product_id: '', name: '', quantity: 1, price: 0, total: 0 }];
        setFormData(prev => ({ ...prev, items: newItems }));
      };

      const removeItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, items: newItems }));
        calculateTotals(newItems);
      };

      const calculateTotals = (items) => {
        const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
        const taxAmount = subtotal * ((formData.tax_rate || 0) / 100);
        const total = subtotal + taxAmount;
        
        setFormData(prev => ({
          ...prev,
          subtotal,
          tax_amount: taxAmount,
          total
        }));
      };

      const handleProductSelect = (index, productId) => {
        const product = products.find(p => p.id === productId);
        if (product) {
          const newItems = [...formData.items];
          newItems[index] = {
            ...newItems[index],
            product_id: productId,
            name: product.name,
            price: product.price,
            total: product.price * (newItems[index].quantity || 1)
          };
          setFormData(prev => ({ ...prev, items: newItems }));
          calculateTotals(newItems);
        }
      };

      const handleSave = () => {
        onSave(formData);
        setIsEditing(false);
      };

      const handleDownload = () => {
        const customer = customers.find(c => c.id === formData.customer_id);
        const doc = generateInvoicePdf(formData, customer, settings);
        doc.save(`Invoice-${formData.invoice_number}.pdf`);
      };

      const handleSendEmail = async () => {
        const customer = customers.find(c => c.id === formData.customer_id);
        if (!customer || !customer.email) {
          toast({ title: "Error", description: "Customer has no email address.", variant: "destructive" });
          return;
        }

        setIsSending(true);
        try {
          const doc = generateInvoicePdf(formData, customer, settings);
          const pdfBase64 = doc.output('datauristring').split(',')[1];

          const { error } = await supabase.functions.invoke('send-invoice-email', {
            body: {
              to: customer.email,
              subject: `Invoice ${formData.invoice_number} from ${settings.storeName?.value || 'Your Store'}`,
              html: `<p>Hi ${customer.name},</p><p>Please find your invoice attached.</p><p>Thank you!</p>`,
              pdfBase64,
              filename: `Invoice-${formData.invoice_number}.pdf`,
            },
          });

          if (error) throw error;

          toast({ title: "Email Sent", description: `Invoice sent to ${customer.email}` });
        } catch (error) {
          toast({ title: "Failed to Send Email", description: error.message, variant: "destructive" });
        } finally {
          setIsSending(false);
        }
      };

      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-[96vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{formData.id ? (isEditing ? 'Edit Invoice' : 'Invoice Details') : 'Create New Invoice'}</DialogTitle>
              <DialogDescription>Manage invoice details, items, and actions.</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Invoice Number</Label>
                  <Input id="invoice_number" value={formData.invoice_number} onChange={(e) => handleChange('invoice_number', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer</Label>
                  {isEditing ? (
                    <Combobox
                      options={customerOptions}
                      value={formData.customer_id}
                      onSelect={(val) => handleChange('customer_id', val)}
                      placeholder="Select a customer..."
                      searchPlaceholder="Search customers..."
                      emptyText="No customer found."
                    />
                  ) : (
                    <Input value={customers.find(c => c.id === formData.customer_id)?.name || 'N/A'} disabled />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select id="status" value={formData.status} onChange={(e) => handleChange('status', e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={!isEditing}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" type="date" value={formData.due_date} onChange={(e) => handleChange('due_date', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input id="tax_rate" type="number" step="0.01" value={formData.tax_rate || 0} onChange={(e) => { const rate = parseFloat(e.target.value) || 0; handleChange('tax_rate', rate); calculateTotals(formData.items); }} disabled={!isEditing} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <Label>Invoice Items</Label>
                  {isEditing && (<Button onClick={addItem} size="sm"><Plus className="w-4 h-4 mr-2" /> Add Item</Button>)}
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-secondary rounded-lg">
                      <div className="col-span-4"><Label>Product</Label>
                      {isEditing ? (
                        <Combobox
                            options={productOptions}
                            value={item.product_id}
                            onSelect={(val) => handleProductSelect(index, val)}
                            placeholder="Select a product..."
                            searchPlaceholder="Search products..."
                            emptyText="No product found."
                        />
                      ) : (
                        <Input value={item.name} disabled />
                      )}
                      </div>
                      <div className="col-span-2"><Label>Quantity</Label><Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} disabled={!isEditing} /></div>
                      <div className="col-span-2"><Label>Price</Label><CurrencyInput value={item.price} onChange={(value) => handleItemChange(index, 'price', value)} disabled={!isEditing} /></div>
                      <div className="col-span-2"><Label>Total</Label><Input value={`${(item.total || 0).toFixed(2)}`} disabled /></div>
                      {isEditing && (<div className="col-span-2"><Button size="icon" variant="ghost" onClick={() => removeItem(index)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button></div>)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={formData.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Additional notes or terms..." disabled={!isEditing} /></div>
              <div className="bg-secondary p-4 rounded-lg"><div className="space-y-2 text-right"><div className="flex justify-between"><span>Subtotal:</span><span>${(formData.subtotal || 0).toFixed(2)}</span></div><div className="flex justify-between"><span>Tax ({formData.tax_rate || 0}%):</span><span>${(formData.tax_amount || 0).toFixed(2)}</span></div><div className="flex justify-between text-lg font-bold"><span>Total:</span><span>${(formData.total || 0).toFixed(2)}</span></div></div></div>
            </div>

            <DialogFooter className="sm:justify-between">
              <div>
                {!isEditing && (
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={handleDownload}><Download className="w-4 h-4 mr-2" /> Download PDF</Button>
                    <Button variant="outline" onClick={handleSendEmail} disabled={isSending}><Mail className="w-4 h-4 mr-2" /> {isSending ? 'Sending...' : 'Send Email'}</Button>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                {isEditing ? (
                  <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" />Save Invoice</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button onClick={() => setIsEditing(true)}><Edit className="w-4 h-4 mr-2" />Edit</Button>
                  </>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };

    export default InvoiceModal;