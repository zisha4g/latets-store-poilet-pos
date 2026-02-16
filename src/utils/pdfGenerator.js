import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateInvoicePdf = (invoice, customer, storeSettings) => {
  const doc = new jsPDF();

  // Header
  if (storeSettings.logoUrl?.value) {
    try {
      doc.addImage(storeSettings.logoUrl.value, 'PNG', 14, 12, 30, 15);
    } catch (e) {
      console.error("Error adding logo to PDF:", e);
      doc.text(storeSettings.storeName?.value || 'Your Store', 14, 20);
    }
  } else {
    doc.setFontSize(20);
    doc.text(storeSettings.storeName?.value || 'Your Store', 14, 22);
  }

  doc.setFontSize(12);
  doc.text('Invoice', 200, 22, { align: 'right' });

  // Store and Customer Info
  doc.setFontSize(10);
  doc.text(storeSettings.storeAddress?.value || '123 Store St, Commerce City', 14, 40);
  doc.text(storeSettings.storeEmail?.value || 'contact@yourstore.com', 14, 45);

  if (customer) {
    doc.text('Bill To:', 200, 40, { align: 'right' });
    doc.text(customer.name, 200, 45, { align: 'right' });
    doc.text(customer.address || 'No Address', 200, 50, { align: 'right' });
    doc.text(customer.email || 'No Email', 200, 55, { align: 'right' });
  }

  // Invoice Details
  doc.text(`Invoice #: ${invoice.invoice_number}`, 14, 60);
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 14, 65);
  doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 14, 70);

  // Items Table
  const tableColumn = ["Description", "Quantity", "Unit Price", "Total"];
  const tableRows = [];

  invoice.items.forEach(item => {
    const itemData = [
      item.name,
      item.quantity,
      `$${item.price.toFixed(2)}`,
      `$${(item.quantity * item.price).toFixed(2)}`
    ];
    tableRows.push(itemData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 75,
    theme: 'striped',
    headStyles: { fillColor: [22, 163, 74] },
  });

  // Totals
  const finalY = doc.lastAutoTable.finalY;
  doc.setFontSize(10);
  doc.text(`Subtotal: $${invoice.subtotal.toFixed(2)}`, 200, finalY + 10, { align: 'right' });
  doc.text(`Tax: $${invoice.tax_amount.toFixed(2)}`, 200, finalY + 15, { align: 'right' });
  if (invoice.service_charges_applied && invoice.service_charges_applied.length > 0) {
    let serviceChargeY = finalY + 20;
    invoice.service_charges_applied.forEach(sc => {
      doc.text(`${sc.name}: $${sc.amount.toFixed(2)}`, 200, serviceChargeY, { align: 'right' });
      serviceChargeY += 5;
    });
  }
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: $${invoice.total.toFixed(2)}`, 200, finalY + 30, { align: 'right' });

  // Footer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business!', 14, doc.internal.pageSize.height - 10);

  return doc;
};