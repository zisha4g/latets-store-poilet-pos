// Re-export shim - implementation lives in src/lib/pdf/invoicePdf.js.
// Old call sites used `generateInvoicePDF(invoice, customer, settings)` which
// triggered a doc.save() side effect. We keep that signature for backward
// compatibility but delegate to the consolidated builder.
import { buildInvoiceDoc, saveInvoiceDoc } from '@/lib/pdf/invoicePdf';

export const generateInvoicePDF = (invoice, customer, settings, payments = []) => {
  const doc = buildInvoiceDoc({ invoice, customer, settings, payments });
  saveInvoiceDoc(doc, invoice);
  return doc;
};

export { buildInvoiceDoc };
export default generateInvoicePDF;
