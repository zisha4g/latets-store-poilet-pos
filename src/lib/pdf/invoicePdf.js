import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatMoney } from '@/lib/money';

const formatDate = (d, locale) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat(locale || undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d)); }
  catch { return new Date(d).toLocaleDateString(); }
};

const settingValue = (settings, key) => {
  if (!settings) return undefined;
  const v = settings[key];
  if (v == null) return undefined;
  return typeof v === 'object' && 'value' in v ? v.value : v;
};

const PRIMARY = [37, 99, 235]; // tailwind blue-600
const MUTED = [120, 120, 130];

/**
 * Build an invoice jsPDF doc. Pure — caller decides .save / .output / email.
 *
 *   const doc = buildInvoiceDoc({ invoice, customer, settings, payments });
 *   doc.save(`Invoice-${invoice.invoice_number}.pdf`);
 *   const blob = doc.output('blob');
 */
export const buildInvoiceDoc = ({ invoice, customer, settings = {}, payments = [] }) => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 40; // margin
  const currency = invoice.currency || 'USD';

  const storeName = settingValue(settings, 'storeName') || settingValue(settings, 'store_name') || 'Your Store';
  const storeAddress = settingValue(settings, 'storeAddress') || settingValue(settings, 'store_address') || '';
  const storeEmail = settingValue(settings, 'storeEmail') || settingValue(settings, 'store_email') || '';
  const storePhone = settingValue(settings, 'storePhone') || settingValue(settings, 'store_phone') || '';
  const logoUrl = settingValue(settings, 'storeLogo') || settingValue(settings, 'store_logo') || settingValue(settings, 'logoUrl');

  // Header band
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 6, 'F');

  let y = M + 6;

  // Logo or store name
  let leftBlockY = y;
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', M, y, 90, 36);
      leftBlockY = y + 44;
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(storeName, M, y + 12);
      leftBlockY = y + 24;
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(storeName, M, y + 12);
    leftBlockY = y + 24;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  if (storeAddress) doc.text(String(storeAddress), M, leftBlockY + 12);
  if (storeEmail) doc.text(String(storeEmail), M, leftBlockY + 24);
  if (storePhone) doc.text(String(storePhone), M, leftBlockY + 36);

  // Right-aligned invoice meta
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('INVOICE', pageWidth - M, y + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const metaLines = [
    [`Invoice #`, invoice.invoice_number || '—'],
    [`Issued`, formatDate(invoice.issued_at || invoice.invoice_date || invoice.created_at)],
    [`Due`, formatDate(invoice.due_date)],
  ];
  let metaY = y + 32;
  metaLines.forEach(([label, val]) => {
    doc.setTextColor(...MUTED);
    doc.text(String(label), pageWidth - M - 110, metaY);
    doc.setTextColor(0, 0, 0);
    doc.text(String(val), pageWidth - M, metaY, { align: 'right' });
    metaY += 14;
  });

  // Bill-to
  y = Math.max(leftBlockY + 50, metaY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text('BILL TO', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  if (customer) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(customer.name || 'Customer', M, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    let by = y + 30;
    if (customer.address) { doc.text(String(customer.address), M, by); by += 12; }
    if (customer.email) { doc.text(String(customer.email), M, by); by += 12; }
    if (customer.phone) { doc.text(String(customer.phone), M, by); by += 12; }
    y = Math.max(y + 16, by);
  } else {
    doc.setTextColor(...MUTED);
    doc.text('No customer', M, y + 16);
    y += 30;
  }

  // Items table
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const rows = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;
    const lineSub = qty * price;
    const discount = Number(it.discount_amount) || 0;
    const taxRate = Number(it.tax_rate) || 0;
    const lineTotal = Number(it.total) != null && Number.isFinite(Number(it.total))
      ? Number(it.total)
      : (lineSub - discount) * (1 + taxRate / 100);
    return [
      it.name || 'Item',
      qty.toString(),
      formatMoney(price, currency),
      discount > 0 ? `-${formatMoney(discount, currency)}` : '—',
      taxRate > 0 ? `${taxRate}%` : '—',
      formatMoney(lineTotal, currency),
    ];
  });

  doc.autoTable({
    startY: y + 12,
    head: [['Description', 'Qty', 'Unit', 'Discount', 'Tax', 'Total']],
    body: rows,
    theme: 'striped',
    margin: { left: M, right: M },
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 70 },
      3: { halign: 'right', cellWidth: 70 },
      4: { halign: 'right', cellWidth: 50 },
      5: { halign: 'right', cellWidth: 80 },
    },
  });

  let finalY = doc.lastAutoTable.finalY + 16;
  if (finalY > pageHeight - 160) { doc.addPage(); finalY = M; }

  // Totals panel
  const subtotal = Number(invoice.subtotal) || 0;
  const totalDiscount = Number(invoice.total_discount ?? invoice.discount_amount) || 0;
  const taxAmount = Number(invoice.tax_amount) || 0;
  const total = Number(invoice.total) || 0;
  const paid = Number(invoice.paid_amount) || 0;
  const balance = Math.max(0, total - paid);

  const rightX = pageWidth - M;
  const labelX = pageWidth - M - 180;
  const drawRow = (label, value, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.bold ? 11 : 10);
    doc.setTextColor(...(opts.muted ? MUTED : [0, 0, 0]));
    doc.text(label, labelX, finalY);
    doc.text(value, rightX, finalY, { align: 'right' });
    finalY += opts.bold ? 18 : 14;
  };
  drawRow('Subtotal', formatMoney(subtotal, currency), { muted: true });
  if (totalDiscount > 0) drawRow('Discount', `-${formatMoney(totalDiscount, currency)}`, { muted: true });
  if (taxAmount > 0) drawRow('Tax', formatMoney(taxAmount, currency), { muted: true });
  finalY += 4;
  doc.setDrawColor(220);
  doc.line(labelX, finalY - 6, rightX, finalY - 6);
  drawRow('Total', formatMoney(total, currency), { bold: true });
  if (paid > 0) {
    drawRow('Paid', `-${formatMoney(paid, currency)}`, { muted: true });
    drawRow('Balance due', formatMoney(balance, currency), { bold: true });
  }

  // Payment history
  if (Array.isArray(payments) && payments.length > 0) {
    finalY += 16;
    if (finalY > pageHeight - 100) { doc.addPage(); finalY = M; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Payments', M, finalY);
    finalY += 4;
    doc.autoTable({
      startY: finalY + 4,
      head: [['Date', 'Method', 'Reference', 'Amount']],
      body: payments.map((p) => [
        formatDate(p.paid_at),
        p.method || 'cash',
        p.reference || '—',
        formatMoney(p.amount, currency),
      ]),
      theme: 'plain',
      margin: { left: M, right: M },
      styles: { fontSize: 9 },
      headStyles: { fontStyle: 'bold', fillColor: [240, 240, 245] },
      columnStyles: { 3: { halign: 'right' } },
    });
    finalY = doc.lastAutoTable.finalY;
  }

  // Notes + terms
  if (invoice.notes || invoice.terms) {
    finalY += 24;
    if (finalY > pageHeight - 80) { doc.addPage(); finalY = M; }
    if (invoice.notes) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
      doc.text('Notes', M, finalY);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(String(invoice.notes), pageWidth - 2 * M);
      doc.text(lines, M, finalY + 14);
      finalY += 14 + lines.length * 12 + 8;
    }
    if (invoice.terms) {
      if (finalY > pageHeight - 60) { doc.addPage(); finalY = M; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
      doc.text('Terms', M, finalY);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(String(invoice.terms), pageWidth - 2 * M);
      doc.text(lines, M, finalY + 14);
    }
  }

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - M, pageHeight - 18, { align: 'right' });
  }

  return doc;
};

export const saveInvoiceDoc = (doc, invoice) => {
  doc.save(`Invoice-${invoice.invoice_number || 'draft'}.pdf`);
};

export const invoiceDocBlob = (doc) => doc.output('blob');
export const invoiceDocBase64 = (doc) => doc.output('datauristring').split(',')[1];

export default buildInvoiceDoc;
