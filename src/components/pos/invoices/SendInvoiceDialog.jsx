import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, Printer, Download, Link as LinkIcon, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { buildInvoiceDoc, saveInvoiceDoc, invoiceDocBase64 } from '@/lib/pdf/invoicePdf';
import { formatMoney } from '@/lib/money';

/**
 * Single dialog for "what do you want to do with this invoice?"
 *  - Email   : invokes send-invoice-email edge function (if deployed)
 *  - WhatsApp: opens wa.me with a pre-filled message + invoice number/total
 *  - Print   : opens PDF in a new tab and triggers print
 *  - Download: saves the PDF file
 *
 * The parent owns saving. We call onSaveFirst(), wait for the saved invoice
 * (now status = sent), and then dispatch the chosen channel.
 */
export const SendInvoiceDialog = ({
  isOpen, onClose, invoice, customer, settings, payments = [],
  onSaveFirst, onComplete,
}) => {
  const [busy, setBusy] = useState(null); // 'email' | 'whatsapp' | 'print' | 'download'

  const ensureSaved = async () => {
    if (!onSaveFirst) return invoice;
    const saved = await onSaveFirst();
    return saved || invoice;
  };

  const buildDoc = (inv) => buildInvoiceDoc({ invoice: inv, customer, settings, payments });

  const handleEmail = async () => {
    if (!customer?.email) {
      toast({ title: 'Customer has no email on file', variant: 'destructive' });
      return;
    }
    setBusy('email');
    try {
      const inv = await ensureSaved();
      if (!inv) return;
      const doc = buildDoc(inv);
      const pdfBase64 = invoiceDocBase64(doc);
      const storeName = settings?.storeName?.value || 'Your Store';
      const { error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          to: customer.email,
          subject: `Invoice ${inv.invoice_number} from ${storeName}`,
          html: `<p>Hi ${customer.name || ''},</p><p>Please find your invoice for <strong>${formatMoney(inv.total, inv.currency)}</strong> attached.</p><p>Thanks!</p>`,
          pdfBase64,
          filename: `Invoice-${inv.invoice_number}.pdf`,
        },
      });
      if (error) throw error;
      onComplete?.(`Emailed to ${customer.email}`);
    } catch (e) {
      toast({
        title: 'Email failed',
        description: (e?.message || '') + ' — make sure the send-invoice-email edge function is deployed.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleWhatsApp = async () => {
    setBusy('whatsapp');
    try {
      const inv = await ensureSaved();
      if (!inv) return;
      // Save PDF locally so the user can attach it manually after WA opens.
      saveInvoiceDoc(buildDoc(inv), inv);

      const phone = (customer?.phone || '').replace(/[^\d]/g, '');
      const storeName = settings?.storeName?.value || '';
      const message = `Hi ${customer?.name || ''}, here's your invoice ${inv.invoice_number} from ${storeName} for ${formatMoney(inv.total, inv.currency)}. Due ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'on receipt'}.`;
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      onComplete?.('WhatsApp opened — attach the downloaded PDF.');
    } catch (e) {
      toast({ title: 'WhatsApp share failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    setBusy('print');
    try {
      const inv = await ensureSaved();
      if (!inv) return;
      const doc = buildDoc(inv);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
      onComplete?.('Sent to printer.');
    } catch (e) {
      toast({ title: 'Print failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    setBusy('download');
    try {
      const inv = await ensureSaved();
      if (!inv) return;
      saveInvoiceDoc(buildDoc(inv), inv);
      onComplete?.('PDF downloaded.');
    } catch (e) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const Action = ({ icon: Icon, title, description, onClick, disabled, busyKey }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy != null}
      className="w-full flex items-start gap-3 rounded-md border bg-card hover:bg-muted/40 px-4 py-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="rounded-md bg-primary/10 p-2 text-primary">
        {busy === busyKey ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && busy == null && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send invoice</DialogTitle>
          <DialogDescription>
            Pick how you'd like to deliver this invoice. We'll save it as <strong>sent</strong> first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Action
            icon={Mail}
            title="Email"
            description={customer?.email
              ? `Send to ${customer.email}`
              : 'Customer has no email on file'}
            onClick={handleEmail}
            disabled={!customer?.email}
            busyKey="email"
          />
          <Action
            icon={MessageCircle}
            title="WhatsApp"
            description={customer?.phone
              ? `Open chat with ${customer.phone} (PDF will download to attach)`
              : 'No customer phone — opens generic share'}
            onClick={handleWhatsApp}
            busyKey="whatsapp"
          />
          <Action
            icon={Printer}
            title="Print"
            description="Open the PDF and trigger Print."
            onClick={handlePrint}
            busyKey="print"
          />
          <Action
            icon={Download}
            title="Download PDF"
            description="Save the PDF to your computer."
            onClick={handleDownload}
            busyKey="download"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy != null}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SendInvoiceDialog;
