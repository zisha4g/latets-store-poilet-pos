// Re-export shim - implementation moved to src/lib/pdf/invoicePdf.js.
// Existing call sites import { generateInvoicePdf } and call doc.save()
// themselves, so we expose the pure builder under both names.
import { buildInvoiceDoc } from '@/lib/pdf/invoicePdf';

export const generateInvoicePdf = (invoice, customer, storeSettings, payments = []) =>
  buildInvoiceDoc({ invoice, customer, settings: storeSettings, payments });

export { buildInvoiceDoc };
export default generateInvoicePdf;
