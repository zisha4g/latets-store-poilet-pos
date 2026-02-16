import React from 'react';
import { motion } from 'framer-motion';

const AccountsReceivableView = ({ data }) => {
  const { invoices, customers } = data;

  const openInvoices = (invoices || []).filter(inv => inv.status !== 'paid');

  return (
    <motion.div
      key="ar"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-6 flex flex-col"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-primary">Accounts Receivable</h2>
      </div>
      <div className="flex-grow overflow-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Invoice #</th>
              <th className="p-3 text-left">Invoice Date</th>
              <th className="p-3 text-left">Due Date</th>
              <th className="p-3 text-right">Amount Due</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {openInvoices.map(invoice => {
              const customer = customers.find(c => c.id === invoice.customer_id);
              return (
                <tr key={invoice.id} className="hover:bg-muted/50">
                  <td className="p-3 font-medium">{customer?.name || 'N/A'}</td>
                  <td className="p-3">{invoice.invoice_number}</td>
                  <td className="p-3">{new Date(invoice.created_at).toLocaleDateString()}</td>
                  <td className="p-3">{new Date(invoice.due_date).toLocaleDateString()}</td>
                  <td className="p-3 text-right font-semibold">${invoice.total.toFixed(2)}</td>
                  <td className="p-3 capitalize">{invoice.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default AccountsReceivableView;