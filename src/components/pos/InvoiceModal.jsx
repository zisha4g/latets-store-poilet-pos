import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Save, Download, Mail, Send, Plus, GripVertical, Receipt, Loader2, Printer } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import CustomerCombobox from '@/components/customers/CustomerCombobox';
import InvoiceItemPicker from '@/components/pos/invoices/InvoiceItemPicker';
import RecordPaymentDialog from '@/components/pos/invoices/RecordPaymentDialog';
import SendInvoiceDialog from '@/components/pos/invoices/SendInvoiceDialog';
import InvoicePaymentsList from '@/components/pos/invoices/InvoicePaymentsList';
import InvoiceAuditTimeline from '@/components/pos/invoices/InvoiceAuditTimeline';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import {
  buildInvoiceDoc, saveInvoiceDoc, invoiceDocBase64,
} from '@/lib/pdf/invoicePdf';
import { computeInvoiceTotals, formatMoney, parseMoney, currencySymbol, COMMON_CURRENCIES } from '@/lib/money';

const initialReducer = (invoice, settings, taxes) => {
  const defaultCurrency =
    invoice?.currency ||
    settings?.currency?.value ||
    settings?.defaultCurrency?.value ||
    'USD';
  const defaultTax = (Array.isArray(taxes) ? taxes : []).find((t) => t.is_default);
  return {
    ...invoice,
    items: Array.isArray(invoice?.items) ? invoice.items : [],
    currency: defaultCurrency,
    discount_type: invoice?.discount_type || 'none',
    discount_value: Number(invoice?.discount_value) || 0,
    status: invoice?.status || 'draft',
    notes: invoice?.notes || '',
    terms: invoice?.terms || '',
    // tax.rate in DB is already a percent (e.g. 8.375 means 8.375%) — DO NOT multiply by 100.
    default_tax_rate: defaultTax ? (Number(defaultTax.rate) || 0) : 0,
    default_tax_id: defaultTax?.id || null,
  };
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'reset': return initialReducer(action.payload, action.settings, action.taxes);
    case 'set': return { ...state, [action.field]: action.value };
    case 'addItem': return { ...state, items: [...state.items, { ...action.item }] };
    case 'updateItem': {
      const items = state.items.map((it, i) => i === action.index ? { ...it, ...action.patch } : it);
      return { ...state, items };
    }
    case 'removeItem': return { ...state, items: state.items.filter((_, i) => i !== action.index) };
    case 'moveItem': {
      const items = [...state.items];
      const [moved] = items.splice(action.from, 1);
      items.splice(action.to, 0, moved);
      return { ...state, items };
    }
    case 'applyTotals': return { ...state, ...action.totals };
    default: return state;
  }
};

const STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

const InvoiceLineRow = ({ index, item, currency, taxes, onUpdate, onRemove, onMoveUp, onMoveDown, disabled }) => {
  const total = Number(item.total) || 0;
  const symbol = currencySymbol(currency);
  const taxOptions = Array.isArray(taxes) ? taxes : [];
  // tax_id stored on the line for traceability; tax_rate is the % we charge.
  const currentTaxId = item.tax_id || (() => {
    const match = taxOptions.find((t) => Math.abs((Number(t.rate) || 0) - (Number(item.tax_rate) || 0)) < 0.001);
    return match?.id || (item.tax_rate > 0 ? '__custom' : '__none');
  })();
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-1 py-2 align-middle text-center text-muted-foreground">
        <div className="flex flex-col gap-0.5">
          <button type="button" disabled={disabled} onClick={onMoveUp} className="text-[10px] hover:text-foreground" aria-label="Move up">▲</button>
          <button type="button" disabled={disabled} onClick={onMoveDown} className="text-[10px] hover:text-foreground" aria-label="Move down">▼</button>
        </div>
      </td>
      <td className="px-2 py-2">
        <Input
          value={item.name || ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={disabled}
          placeholder="Item name"
          className="h-9"
          aria-label="Item name"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          type="number" min="1" step="1"
          value={item.quantity}
          onChange={(e) => {
            const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
            onUpdate({ quantity: n });
          }}
          disabled={disabled}
          className="h-9 w-20 text-right"
          aria-label="Quantity"
        />
      </td>
      <td className="px-2 py-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{symbol}</span>
          <Input
            inputMode="decimal"
            value={item.price}
            onChange={(e) => onUpdate({ price: parseMoney(e.target.value) })}
            disabled={disabled}
            className="h-9 w-28 pl-6 text-right"
            aria-label="Unit price"
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <select
            value={item.discount_type || 'none'}
            onChange={(e) => onUpdate({ discount_type: e.target.value })}
            disabled={disabled}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Discount type"
          >
            <option value="none">—</option>
            <option value="percent">%</option>
            <option value="fixed">{currency}</option>
          </select>
          <Input
            inputMode="decimal"
            value={item.discount_value || 0}
            onChange={(e) => onUpdate({ discount_value: parseMoney(e.target.value) })}
            disabled={disabled || (item.discount_type || 'none') === 'none'}
            className="h-9 w-20 text-right"
            aria-label="Discount value"
          />
        </div>
      </td>
      <td className="px-2 py-2">
        <select
          value={currentTaxId}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__none') onUpdate({ tax_id: null, tax_rate: 0 });
            else if (v === '__custom') onUpdate({ tax_id: null });
            else {
              const t = taxOptions.find((x) => x.id === v);
              if (t) onUpdate({ tax_id: t.id, tax_rate: Number(t.rate) || 0 });
            }
          }}
          disabled={disabled}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs max-w-[160px]"
          aria-label="Tax"
        >
          <option value="__none">No tax</option>
          {taxOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({(Number(t.rate) || 0).toFixed(3)}%)
            </option>
          ))}
          {currentTaxId === '__custom' && <option value="__custom">Custom %</option>}
        </select>
        {currentTaxId === '__custom' && (
          <Input
            inputMode="decimal"
            value={item.tax_rate || 0}
            onChange={(e) => onUpdate({ tax_rate: parseMoney(e.target.value) })}
            disabled={disabled}
            className="h-9 w-20 text-right mt-1"
            aria-label="Tax rate"
          />
        )}
      </td>
      <td className="px-2 py-2 text-right tabular-nums font-medium whitespace-nowrap">{formatMoney(total, currency)}</td>
      <td className="px-1 py-2">
        {!disabled && (
          <Button size="icon" variant="ghost" aria-label="Remove item" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </td>
    </tr>
  );
};

const InvoiceModal = ({
  isOpen, onClose, invoice, customers, products, onSave,
  initialMode = 'view', settings, taxes, handlers,
}) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialReducer(invoice, settings, taxes));
  const [mode, setMode] = useState(initialMode === 'edit' || !invoice?.id ? 'edit' : 'view');
  const [isSaving, setSaving] = useState(false);
  const [isSending, setSending] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const isReadOnly = mode === 'view';

  useEffect(() => {
    dispatch({ type: 'reset', payload: invoice, settings, taxes });
    setMode(initialMode === 'edit' || !invoice?.id ? 'edit' : 'view');
  }, [invoice, initialMode, settings, taxes]);

  // Recalculate totals whenever items / discount / currency change
  const totals = useMemo(() => computeInvoiceTotals({
    items: state.items,
    discount: { type: state.discount_type, value: state.discount_value },
    currency: state.currency,
  }), [state.items, state.discount_type, state.discount_value, state.currency]);

  // Mirror computed totals into the form state object (so save payload is consistent)
  useEffect(() => {
    dispatch({ type: 'applyTotals', totals: {
      items: totals.items,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      discount_amount: totals.invoice_discount_amount,
      total_discount: totals.total_discount,
      total: totals.total,
    } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.subtotal, totals.tax_amount, totals.total, totals.invoice_discount_amount]);

  const customerMap = useMemo(() => new Map((customers || []).map((c) => [c.id, c])), [customers]);
  const selectedCustomer = state.customer_id ? customerMap.get(state.customer_id) : null;

  const invoicePayments = useMemo(() => {
    if (!state.id || !handlers) return [];
    // Pull payments from data.invoicePayments if exposed via handlers.invoicePayments?
    // Fall back: read from window-injected state. We rely on the parent to pass them via prop.
    return state.__payments || [];
  }, [state.id, state.__payments, handlers]);

  const balanceDue = Math.max(0, (Number(state.total) || 0) - (Number(state.paid_amount) || 0));

  const allocateNumberIfNeeded = async () => {
    if (state.invoice_number || !handlers?.invoices?.allocateNumber) return state.invoice_number;
    try {
      const res = await handlers.invoices.allocateNumber();
      const nextNumber = res?.number || `INV-${Date.now()}`;
      const seq = res?.seq;
      dispatch({ type: 'set', field: 'invoice_number', value: nextNumber });
      if (seq != null) dispatch({ type: 'set', field: 'invoice_number_seq', value: seq });
      return nextNumber;
    } catch {
      const fallback = `INV-${Date.now()}`;
      dispatch({ type: 'set', field: 'invoice_number', value: fallback });
      return fallback;
    }
  };

  const validate = () => {
    if (!state.customer_id) {
      toast({ title: 'Customer required', description: 'Pick a customer before saving.', variant: 'destructive' });
      return false;
    }
    const items = state.items.filter((it) => (Number(it.quantity) || 0) > 0 && (it.product_id || (it.name || '').trim()));
    if (items.length === 0) {
      toast({ title: 'Add at least one item', variant: 'destructive' });
      return false;
    }
    if ((Number(state.total) || 0) <= 0) {
      toast({ title: 'Invoice total must be greater than zero', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const buildPayload = async () => {
    const number = await allocateNumberIfNeeded();
    return {
      ...state,
      invoice_number: number,
      issued_at: state.issued_at || new Date().toISOString(),
      tax_rate: undefined, // legacy field retired; per-line tax_rate now drives
    };
  };

  const handleSave = async (afterAction) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = await buildPayload();
      const saved = await onSave?.(payload);
      const finalInvoice = saved || payload;
      toast({ title: payload.id ? 'Invoice updated' : 'Invoice created' });
      if (afterAction === 'pdf') doDownload(finalInvoice);
      else if (afterAction === 'print') doPrint(finalInvoice);
      else if (afterAction === 'email') await doEmail(finalInvoice);
      else onClose?.();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const doDownload = (inv = state) => {
    try {
      const customer = customerMap.get(inv.customer_id) || selectedCustomer;
      const doc = buildInvoiceDoc({ invoice: inv, customer, settings, payments: invoicePayments });
      saveInvoiceDoc(doc, inv);
    } catch (e) {
      toast({ title: 'PDF generation failed', description: e.message, variant: 'destructive' });
    }
  };

  const doPrint = (inv = state) => {
    try {
      const customer = customerMap.get(inv.customer_id) || selectedCustomer;
      const doc = buildInvoiceDoc({ invoice: inv, customer, settings, payments: invoicePayments });
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (e) {
      toast({ title: 'Print failed', description: e.message, variant: 'destructive' });
    }
  };

  const doEmail = async (inv = state) => {
    const customer = customerMap.get(inv.customer_id) || selectedCustomer;
    if (!customer?.email) {
      toast({ title: 'Customer has no email', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const doc = buildInvoiceDoc({ invoice: inv, customer, settings, payments: invoicePayments });
      const pdfBase64 = invoiceDocBase64(doc);
      const storeName = settings?.storeName?.value || 'Your Store';
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          to: customer.email,
          subject: `Invoice ${inv.invoice_number} from ${storeName}`,
          html: `<p>Hi ${customer.name || ''},</p><p>Please find your invoice attached.</p><p>Thank you!</p>`,
          pdfBase64,
          filename: `Invoice-${inv.invoice_number}.pdf`,
        },
      });
      if (error) throw error;
      toast({ title: 'Email sent', description: customer.email });
    } catch (e) {
      toast({ title: 'Email failed', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleAddItem = (item) => dispatch({ type: 'addItem', item });

  if (!isOpen || !state) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose?.(); }}>
        <DialogContent className="max-w-[96vw] sm:max-w-4xl lg:max-w-5xl p-0 overflow-hidden">
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b px-6 pt-5 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <DialogTitle className="text-xl">
                      {state.id ? (isReadOnly ? `Invoice ${state.invoice_number || ''}` : `Edit invoice ${state.invoice_number || ''}`) : 'New invoice'}
                    </DialogTitle>
                    <DialogDescription className="mt-0.5">
                      {selectedCustomer ? `For ${selectedCustomer.name}` : 'Pick a customer and add items'}
                    </DialogDescription>
                  </div>
                </div>
                <InvoiceStatusBadge status={state.status} />
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {state.id ? (
                <Tabs defaultValue="details" className="w-full">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                  </TabsList>
                  <TabsContent value="details" className="pt-4">
                    <InvoiceDetailsForm
                      state={state} dispatch={dispatch} isReadOnly={isReadOnly}
                      customers={customers} products={products} handlers={handlers}
                      totals={totals} taxes={taxes} isExisting
                    />
                  </TabsContent>
                  <TabsContent value="payments" className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {balanceDue > 0
                          ? <>Balance due: <span className="font-medium text-foreground">{formatMoney(balanceDue, state.currency)}</span></>
                          : 'Fully paid'}
                      </div>
                      {balanceDue > 0 && state.status !== 'void' && (
                        <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
                          <Plus className="h-4 w-4 mr-1" /> Record payment
                        </Button>
                      )}
                    </div>
                    <InvoicePaymentsList
                      payments={invoicePayments}
                      currency={state.currency}
                    />
                  </TabsContent>
                  <TabsContent value="history" className="pt-4">
                    <InvoiceAuditTimeline invoiceId={state.id} />
                  </TabsContent>
                </Tabs>
              ) : (
                <InvoiceDetailsForm
                  state={state} dispatch={dispatch} isReadOnly={isReadOnly}
                  customers={customers} products={products} handlers={handlers}
                  totals={totals} taxes={taxes} isExisting={false}
                />
              )}
            </div>

            {/* Sticky totals + footer */}
            <div className="border-t bg-card px-6 py-3">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <div>Subtotal <span className="ml-2 tabular-nums text-foreground">{formatMoney(totals.subtotal, state.currency)}</span></div>
                  {totals.total_discount > 0 && (
                    <div>Discount <span className="ml-2 tabular-nums text-foreground">-{formatMoney(totals.total_discount, state.currency)}</span></div>
                  )}
                  {totals.tax_amount > 0 && (
                    <div>Tax <span className="ml-2 tabular-nums text-foreground">{formatMoney(totals.tax_amount, state.currency)}</span></div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold tabular-nums">{formatMoney(totals.total, state.currency)}</div>
                  {Number(state.paid_amount) > 0 && balanceDue > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Paid {formatMoney(state.paid_amount, state.currency)} · Balance {formatMoney(balanceDue, state.currency)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t bg-background px-6 py-3 gap-2 flex-row flex-wrap sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {state.id && isReadOnly && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => doDownload()}><Download className="h-4 w-4 mr-1" /> PDF</Button>
                    <Button variant="outline" size="sm" onClick={() => doPrint()}>Print</Button>
                    <Button variant="outline" size="sm" onClick={() => doEmail()} disabled={isSending}>
                      <Mail className="h-4 w-4 mr-1" /> {isSending ? 'Sending…' : 'Email'}
                    </Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2 ml-auto">
                {isReadOnly ? (
                  <>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {state.status !== 'void' && <Button onClick={() => setMode('edit')}>Edit</Button>}
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button variant="outline" onClick={() => setShowSendDialog(true)} disabled={isSaving}>
                      <Send className="h-4 w-4 mr-1" />
                      Save & Send
                    </Button>
                    <Button onClick={() => handleSave()} disabled={isSaving}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                  </>
                )}
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <RecordPaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        invoice={state}
        balance={balanceDue}
        currency={state.currency}
        handlers={handlers}
        customers={customers}
      />

      <SendInvoiceDialog
        isOpen={showSendDialog}
        onClose={() => setShowSendDialog(false)}
        invoice={state}
        customer={selectedCustomer}
        settings={settings}
        payments={invoicePayments}
        onSaveFirst={async () => {
          if (!validate()) return null;
          const payload = await buildPayload();
          // Mark as sent on the way out
          payload.status = 'sent';
          const saved = await onSave?.(payload);
          return saved || payload;
        }}
        onComplete={(action) => {
          toast({ title: 'Invoice sent', description: action || 'Saved as sent.' });
          setShowSendDialog(false);
          onClose?.();
        }}
      />
    </>
  );
};

const InvoiceDetailsForm = ({ state, dispatch, isReadOnly, customers, products, handlers, totals, taxes, isExisting }) => {
  const set = (field) => (value) => dispatch({ type: 'set', field, value });
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Customer</Label>
          <CustomerCombobox
            customers={customers}
            value={state.customer_id}
            onChange={(id) => dispatch({ type: 'set', field: 'customer_id', value: id })}
            handlers={handlers}
            disabled={isReadOnly}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="im-issued">Issued</Label>
            <Input
              id="im-issued"
              type="date"
              value={state.issued_at ? new Date(state.issued_at).toISOString().slice(0, 10) : ''}
              onChange={(e) => set('issued_at')(e.target.value ? new Date(e.target.value).toISOString() : null)}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="im-due">Due</Label>
            <Input
              id="im-due"
              type="date"
              value={state.due_date ? String(state.due_date).slice(0, 10) : ''}
              onChange={(e) => set('due_date')(e.target.value || null)}
              disabled={isReadOnly}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="im-status">Status</Label>
          <select
            id="im-status"
            value={state.status}
            onChange={(e) => set('status')(e.target.value)}
            disabled={isReadOnly}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="im-currency">Currency</Label>
          <select
            id="im-currency"
            value={state.currency}
            onChange={(e) => set('currency')(e.target.value)}
            disabled={isReadOnly}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {COMMON_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} - {c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Invoice discount</Label>
          <div className="flex items-center gap-1">
            <select
              value={state.discount_type}
              onChange={(e) => set('discount_type')(e.target.value)}
              disabled={isReadOnly}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="none">None</option>
              <option value="percent">%</option>
              <option value="fixed">{state.currency}</option>
            </select>
            <Input
              inputMode="decimal"
              value={state.discount_value}
              onChange={(e) => set('discount_value')(parseMoney(e.target.value))}
              disabled={isReadOnly || state.discount_type === 'none'}
              className="h-10 text-right"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          <span className="text-xs text-muted-foreground">{state.items.length} item{state.items.length === 1 ? '' : 's'}</span>
        </div>

        {!isReadOnly && (
          <InvoiceItemPicker
            products={products}
            currency={state.currency}
            defaultTaxRate={state.default_tax_rate || 0}
            defaultTaxId={state.default_tax_id || null}
            onAddItem={(item) => dispatch({ type: 'addItem', item })}
          />
        )}

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-1 py-2 w-8"></th>
                <th className="px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-left">Discount</th>
                <th className="px-2 py-2 text-right">Tax %</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-1 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {state.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No items yet. {isReadOnly ? '' : 'Use the search above to add items.'}
                  </td>
                </tr>
              )}
              {state.items.map((item, index) => (
                <InvoiceLineRow
                  key={index}
                  index={index}
                  item={item}
                  currency={state.currency}
                  taxes={taxes}
                  disabled={isReadOnly}
                  onUpdate={(patch) => dispatch({ type: 'updateItem', index, patch })}
                  onRemove={() => dispatch({ type: 'removeItem', index })}
                  onMoveUp={() => index > 0 && dispatch({ type: 'moveItem', from: index, to: index - 1 })}
                  onMoveDown={() => index < state.items.length - 1 && dispatch({ type: 'moveItem', from: index, to: index + 1 })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="im-notes">Notes</Label>
          <Textarea
            id="im-notes" rows={3}
            value={state.notes || ''}
            onChange={(e) => set('notes')(e.target.value)}
            disabled={isReadOnly}
            placeholder="Anything the customer should see on the invoice."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="im-terms">Terms</Label>
          <Textarea
            id="im-terms" rows={3}
            value={state.terms || ''}
            onChange={(e) => set('terms')(e.target.value)}
            disabled={isReadOnly}
            placeholder="Payment terms, late fees, etc."
          />
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
