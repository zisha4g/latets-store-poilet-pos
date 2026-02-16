import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateInvoicePDF = (invoice, customer, settings) => {
  const doc = new jsPDF();
  const logoUrl = settings?.store_logo?.value;

  doc.setFontSize(20);
  doc.text("INVOICE", 15, 20);

  if (logoUrl) {
    // This is tricky because of CORS. For now, we assume it's a data URL or CORS-enabled.
    // A more robust solution might need a backend proxy.
    try {
      doc.addImage(logoUrl, 'PNG', 150, 10, 40, 20);
    } catch (e) {
      console.error("Could not add logo to PDF:", e);
    }
  }

  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoice.invoice_number}`, 15, 40);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, 45);
  doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 15, 50);

  if (customer) {
    doc.text("Bill To:", 15, 60);
    doc.text(customer.name, 15, 65);
    doc.text(customer.address || '', 15, 70);
    doc.text(customer.email || '', 15, 75);
    doc.text(customer.phone, 15, 80);
  }

  const tableColumn = ["Product", "Quantity", "Unit Price", "Total"];
  const tableRows = [];

  invoice.items.forEach(item => {
    const itemData = [
      item.name,
      item.quantity,
      `$${item.price.toFixed(2)}`,
      `$${item.total.toFixed(2)}`
    ];
    tableRows.push(itemData);
  });

  doc.autoTable({
    startY: 90,
    head: [tableColumn],
    body: tableRows,
  });

  const finalY = doc.lastAutoTable.finalY;
  doc.setFontSize(10);
  doc.text(`Subtotal: $${invoice.subtotal.toFixed(2)}`, 150, finalY + 10);
  doc.text(`Tax (${invoice.tax_rate}%): $${invoice.tax_amount.toFixed(2)}`, 150, finalY + 15);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: $${invoice.total.toFixed(2)}`, 150, finalY + 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if(invoice.notes) {
      doc.text("Notes:", 15, finalY + 40);
      doc.text(invoice.notes, 15, finalY + 45, { maxWidth: 180 });
  }

  doc.save(`Invoice-${invoice.invoice_number}.pdf`);
};