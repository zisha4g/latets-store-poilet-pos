import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Search, Receipt, MoreHorizontal, FileDown, Trash2, Eye, Edit,
  CreditCard, Copy, Mail, XOctagon, Download, FilterX, ChevronUp, ChevronDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/Skeleton';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';

import InvoiceModal from '@/components/pos/InvoiceModal';
import RecordPaymentDialog from '@/components/pos/invoices/RecordPaymentDialog';
import CustomerCombobox from '@/components/customers/CustomerCombobox';
import { formatMoney } from '@/lib/money';
import { buildInvoiceDoc, saveInvoiceDoc } from '@/lib/pdf/invoicePdf';
import { toCsv, downloadCsv } from '@/lib/csv';

const STATUS_FILTERS = ['all', 'draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

const isOverdue = (inv) => {
  if (!inv.due_date) return false;
  if (['paid', 'void'].includes(inv.status)) return false;
  return new Date(inv.due_date) < new Date(new Date().toDateString());
};

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); }
  catch { return '—'; }
};

const sortInvoices = (rows, sort) => {
  const { key, dir } = sort;
  const copy = [...rows];
  copy.sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (key === 'customer') { av = a.__customerName || ''; bv = b.__customerName || ''; }
    if (key === 'due_date' || key === 'created_at' || key === 'issued_at') {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
    }
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return copy;
};

const InvoicesView = ({ data, handlers, settings, taxes, isLoading }) => {
  const invoices = data?.invoices || [];
  const customers = data?.customers || [];
  const products = data?.products || [];
  const invoicePayments = data?.invoicePayments || [];

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const paymentsByInvoice = useMemo(() => {
    const map = new Map();
    invoicePayments.forEach((p) => {
      const arr = map.get(p.invoice_id) || [];
      arr.push(p);
      map.set(p.invoice_id, arr);
    });
    return map;
  }, [invoicePayments]);

  const enriched = useMemo(() => invoices.map((inv) => {
    const c = customerMap.get(inv.customer_id);
    return {
      ...inv,
      __customerName: c?.name || 'Walk-in',
      __customerPhone: c?.phone || '',
      __customerEmail: c?.email || '',
      __balance: Math.max(0, (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)),
      __overdue: isOverdue(inv),
    };
  }), [invoices, customerMap]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((inv) => {
      if (statusFilter === 'overdue') {
        if (!inv.__overdue) return false;
      } else if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (customerFilter && inv.customer_id !== customerFilter) return false;
      if (from) {
        const d = new Date(inv.created_at);
        if (d < new Date(from)) return false;
      }
      if (to) {
        const d = new Date(inv.created_at);
        const end = new Date(to); end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      if (q) {
        const hay = `${inv.invoice_number || ''} ${inv.__customerName} ${inv.__customerPhone} ${inv.__customerEmail} ${inv.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, search, statusFilter, customerFilter, from, to]);

  const sorted = useMemo(() => sortInvoices(filtered, sort), [filtered, sort]);

  const counts = useMemo(() => {
    const c = { all: enriched.length };
    STATUS_FILTERS.slice(1).forEach((s) => { c[s] = 0; });
    enriched.forEach((inv) => {
      if (inv.__overdue) c.overdue += 1;
      if (c[inv.status] != null) c[inv.status] += 1;
    });
    return c;
  }, [enriched]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInvoice, setModalInvoice] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [paymentDialog, setPaymentDialog] = useState({ open: false, invoice: null });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmVoid, setConfirmVoid] = useState(null);

  const openNew = () => {
    const defaultCurrency =
      data?.settings?.currency?.value ||
      data?.settings?.defaultCurrency?.value ||
      'USD';
    setModalInvoice({
      customer_id: null, items: [], status: 'draft', currency: defaultCurrency,
      issued_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
      notes: '', terms: '',
      subtotal: 0, tax_amount: 0, total: 0, paid_amount: 0,
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const openInvoice = (inv, mode = 'view') => {
    const payments = paymentsByInvoice.get(inv.id) || [];
    setModalInvoice({ ...inv, __payments: payments });
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    // Strip transient/UI-only keys + computed fields not in DB schema.
    const {
      __payments, __customerName, __customerPhone, __customerEmail,
      __balance, __overdue,
      default_tax_rate, default_tax_id,
      total_discount,
      tax_rate, // legacy invoice-level rate retired in v2
      ...clean
    } = payload || {};
    if (clean.id) return handlers.invoices.update(clean);
    return handlers.invoices.add(clean);
  };

  const handleDelete = async (inv) => {
    try {
      await handlers.invoices.delete(inv.id);
      toast({ title: 'Invoice deleted' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleVoid = async (inv, reason) => {
    try {
      await handlers.invoices.voidInvoice(inv.id, reason || null);
      toast({ title: 'Invoice voided' });
    } catch (e) {
      toast({ title: 'Void failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDuplicate = async (inv) => {
    try {
      await handlers.invoices.duplicate(inv.id);
      toast({ title: 'Invoice duplicated', description: 'A new draft was created.' });
    } catch (e) {
      toast({ title: 'Duplicate failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDownloadPdf = (inv) => {
    try {
      const customer = customerMap.get(inv.customer_id);
      const payments = paymentsByInvoice.get(inv.id) || [];
      const doc = buildInvoiceDoc({ invoice: inv, customer, settings, payments });
      saveInvoiceDoc(doc, inv);
    } catch (e) {
      toast({ title: 'PDF failed', description: e.message, variant: 'destructive' });
    }
  };

  const exportCsv = () => {
    const rows = (selected.size > 0 ? sorted.filter((r) => selected.has(r.id)) : sorted);
    const csv = toCsv(rows, [
      { key: 'invoice_number', label: 'Invoice #' },
      { key: '__customerName', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'currency', label: 'Currency' },
      { label: 'Issued', value: (r) => formatDate(r.issued_at || r.created_at) },
      { label: 'Due', value: (r) => formatDate(r.due_date) },
      { label: 'Total', value: (r) => Number(r.total || 0).toFixed(2) },
      { label: 'Paid', value: (r) => Number(r.paid_amount || 0).toFixed(2) },
      { label: 'Balance', value: (r) => Number(r.__balance || 0).toFixed(2) },
    ]);
    downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const toggleSort = (key) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const toggleSelected = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));
  const someSelected = !allSelected && sorted.some((r) => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((r) => r.id)));
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setCustomerFilter(null);
    setFrom(''); setTo('');
  };

  const hasFilters = search || statusFilter !== 'all' || customerFilter || from || to;
  const isEmptyState = enriched.length === 0;
  const isNoResults = !isEmptyState && sorted.length === 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              Invoices
              <span className="text-sm font-normal text-muted-foreground">({enriched.length})</span>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={sorted.length === 0}>
                <FileDown className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> New invoice
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice #, customer, phone, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="min-w-[200px] flex-1 max-w-xs">
              <CustomerCombobox
                customers={customers}
                value={customerFilter}
                onChange={setCustomerFilter}
                handlers={handlers}
                placeholder="Filter by customer…"
              />
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <FilterX className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-3">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}{' '}
                <span className={`ml-1 inline-block min-w-[1.25rem] text-center ${
                  statusFilter === s ? 'text-primary-foreground/80' : 'text-muted-foreground'
                }`}>
                  {counts[s] || 0}
                </span>
              </button>
            ))}
          </div>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-3 px-3 py-2 -mx-2 rounded-md bg-primary/5 border border-primary/20">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : isEmptyState ? (
            <div className="px-6 py-16 text-center">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-base font-medium">No invoices yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first invoice to start tracking what you're owed.</p>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> New invoice
              </Button>
            </div>
          ) : isNoResults ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">No invoices match your filters.</p>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
                <FilterX className="h-4 w-4 mr-1" /> Clear filters
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                          data-state={someSelected ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
                        />
                      </th>
                      <SortHeader sortKey="invoice_number" sort={sort} onSort={toggleSort}>Invoice #</SortHeader>
                      <SortHeader sortKey="customer" sort={sort} onSort={toggleSort}>Customer</SortHeader>
                      <SortHeader sortKey="status" sort={sort} onSort={toggleSort}>Status</SortHeader>
                      <SortHeader sortKey="created_at" sort={sort} onSort={toggleSort}>Issued</SortHeader>
                      <SortHeader sortKey="due_date" sort={sort} onSort={toggleSort}>Due</SortHeader>
                      <SortHeader sortKey="total" sort={sort} onSort={toggleSort} align="right">Total</SortHeader>
                      <SortHeader sortKey="__balance" sort={sort} onSort={toggleSort} align="right">Balance</SortHeader>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => openInvoice(inv, 'view')}
                      >
                        <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(inv.id)}
                            onCheckedChange={() => toggleSelected(inv.id)}
                            aria-label={`Select ${inv.invoice_number}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{inv.invoice_number || '—'}</td>
                        <td className="px-3 py-2">
                          <div>{inv.__customerName}</div>
                          {inv.__customerPhone && <div className="text-xs text-muted-foreground">{inv.__customerPhone}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <InvoiceStatusBadge status={inv.__overdue && !['paid', 'void'].includes(inv.status) ? 'overdue' : inv.status} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(inv.issued_at || inv.created_at)}</td>
                        <td className={`px-3 py-2 whitespace-nowrap ${inv.__overdue ? 'text-destructive font-medium' : ''}`}>
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(inv.total, inv.currency)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {inv.__balance > 0
                            ? <span className="text-destructive">{formatMoney(inv.__balance, inv.currency)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            invoice={inv}
                            onView={() => openInvoice(inv, 'view')}
                            onEdit={() => openInvoice(inv, 'edit')}
                            onPay={() => setPaymentDialog({ open: true, invoice: inv })}
                            onDuplicate={() => handleDuplicate(inv)}
                            onPdf={() => handleDownloadPdf(inv)}
                            onVoid={() => setConfirmVoid(inv)}
                            onDelete={() => setConfirmDelete(inv)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {sorted.map((inv) => (
                  <div key={inv.id} className="p-3 flex flex-col gap-1.5" onClick={() => openInvoice(inv, 'view')}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{inv.invoice_number || '—'}</span>
                      <InvoiceStatusBadge status={inv.__overdue && !['paid', 'void'].includes(inv.status) ? 'overdue' : inv.status} />
                    </div>
                    <div className="text-sm">{inv.__customerName}</div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Due {formatDate(inv.due_date)}</span>
                      <span className="tabular-nums font-medium">{formatMoney(inv.total, inv.currency)}</span>
                    </div>
                    {inv.__balance > 0 && (
                      <div className="text-xs text-destructive">Balance {formatMoney(inv.__balance, inv.currency)}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {modalOpen && modalInvoice && (
        <InvoiceModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          invoice={modalInvoice}
          customers={customers}
          products={products}
          onSave={handleSave}
          initialMode={modalMode}
          settings={settings}
          taxes={taxes}
          handlers={handlers}
        />
      )}

      <RecordPaymentDialog
        isOpen={paymentDialog.open}
        onClose={() => setPaymentDialog({ open: false, invoice: null })}
        invoice={paymentDialog.invoice || {}}
        balance={paymentDialog.invoice?.__balance || 0}
        currency={paymentDialog.invoice?.currency || 'USD'}
        handlers={handlers}
        customers={customers}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes invoice {confirmDelete?.invoice_number}. Consider voiding instead to preserve history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(confirmDelete); setConfirmDelete(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmVoid} onOpenChange={(o) => !o && setConfirmVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void invoice {confirmVoid?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Voided invoices stay in your history but are no longer counted toward receivables.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { handleVoid(confirmVoid); setConfirmVoid(null); }}
            >
              Void invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

const SortHeader = ({ sortKey, sort, onSort, children, align }) => (
  <th
    className={`px-3 py-2 cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
    onClick={() => onSort(sortKey)}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      {sort.key === sortKey && (
        sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      )}
    </span>
  </th>
);

const RowMenu = ({ invoice, onView, onEdit, onPay, onDuplicate, onPdf, onVoid, onDelete }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="icon" variant="ghost" aria-label="Row actions">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onSelect={onView}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
      {invoice.status !== 'void' && (
        <DropdownMenuItem onSelect={onEdit}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
      )}
      {invoice.status !== 'void' && invoice.__balance > 0 && (
        <DropdownMenuItem onSelect={onPay}><CreditCard className="h-4 w-4 mr-2" /> Record payment</DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={onDuplicate}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
      <DropdownMenuItem onSelect={onPdf}><Download className="h-4 w-4 mr-2" /> Download PDF</DropdownMenuItem>
      <DropdownMenuSeparator />
      {invoice.status !== 'void' && (
        <DropdownMenuItem onSelect={onVoid} className="text-destructive focus:text-destructive">
          <XOctagon className="h-4 w-4 mr-2" /> Void
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
        <Trash2 className="h-4 w-4 mr-2" /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export default InvoicesView;
