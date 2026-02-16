import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Plus, Search, Edit, Trash2 } from 'lucide-react';
    import { toast } from '@/components/ui/use-toast';
    import InvoiceModal from './InvoiceModal';
    import { useResponsive } from '@/lib/responsive';

    const InvoicesView = ({ invoices, customers, products, handlers, settings, taxes, serviceCharges }) => {
      const { isMobile } = useResponsive();
      const [searchTerm, setSearchTerm] = useState('');
      const [selectedInvoice, setSelectedInvoice] = useState(null);
      const [modalMode, setModalMode] = useState('view');
      const [statusFilter, setStatusFilter] = useState('all');

      const filteredInvoices = invoices.filter(invoice => {
        const customer = customers.find(c => c.id === invoice.customer_id);
        const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (customer?.name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
        return matchesSearch && matchesStatus;
      });

      const handleCreateInvoice = () => {
        const defaultTax = taxes.find(t => t.is_default) || { rate: 0 };
        setSelectedInvoice({
          invoice_number: `INV-${Date.now()}`,
          customer_id: null,
          items: [],
          subtotal: 0,
          tax_rate: (defaultTax.rate * 100),
          tax_amount: 0,
          total: 0,
          status: 'draft',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: ''
        });
        setModalMode('edit');
      };

      const handleViewInvoice = (invoice) => {
        setSelectedInvoice(invoice);
        setModalMode('view');
      };

      const handleDeleteInvoice = async (id) => {
        if (window.confirm('Are you sure you want to delete this invoice?')) {
            try {
              await handlers.invoices.delete(id);
              toast({ title: "Success", description: "Invoice deleted successfully." });
            } catch (error) {
              toast({ title: "Error", description: error.message, variant: "destructive" });
            }
        }
      };

      const handleSaveInvoice = async (invoiceData) => {
        try {
          if (invoiceData.id) {
            await handlers.invoices.update(invoiceData);
            toast({ title: "Success", description: "Invoice updated successfully." });
          } else {
            await handlers.invoices.add(invoiceData);
            toast({ title: "Success", description: "Invoice created successfully." });
          }
          setSelectedInvoice(null);
        } catch (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      };

      const getStatusColor = (status) => {
        switch (status) {
          case 'paid': return 'text-green-600 bg-green-100';
          case 'sent': return 'text-blue-600 bg-blue-100';
          case 'overdue': return 'text-red-600 bg-red-100';
          default: return 'text-gray-600 bg-gray-100';
        }
      };

      return (
        <>
          <motion.div
            key="invoices"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full p-4 sm:p-6 flex flex-col"
          >
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-primary">Invoice Management</h2>
              <Button onClick={handleCreateInvoice} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Create Invoice</span><span className="sm:hidden">New</span>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search by invoice # or customer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:w-auto"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block flex-grow bg-card rounded-xl shadow-md overflow-hidden">
              <div className="overflow-auto h-full">
                <table className="w-full">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredInvoices.map((invoice) => {
                      const customer = customers.find(c => c.id === invoice.customer_id);
                      return (
                        <tr key={invoice.id} className="hover:bg-secondary cursor-pointer" onClick={() => handleViewInvoice(invoice)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{invoice.invoice_number}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{customer?.name || 'No Customer'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary">${invoice.total.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'No due date'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setModalMode('edit'); setSelectedInvoice(invoice); }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice.id); }}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex-grow space-y-3 overflow-auto">
              {filteredInvoices.map((invoice) => {
                const customer = customers.find(c => c.id === invoice.customer_id);
                return (
                  <motion.div
                    key={invoice.id}
                    className="bg-card rounded-lg shadow p-4"
                    onClick={() => handleViewInvoice(invoice)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{invoice.invoice_number}</h3>
                        <p className="text-sm text-muted-foreground">{customer?.name || 'No Customer'}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Amount</p>
                        <p className="font-semibold text-primary text-lg">${invoice.total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                        <p className="text-sm">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'No due date'}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={(e) => { e.stopPropagation(); setModalMode('edit'); setSelectedInvoice(invoice); }}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice.id); }}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
              {filteredInvoices.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No invoices found</p>
                </div>
              )}
            </div>
          </motion.div>

          {selectedInvoice && (
            <InvoiceModal
              isOpen={!!selectedInvoice}
              onClose={() => setSelectedInvoice(null)}
              invoice={selectedInvoice}
              customers={customers}
              products={products}
              onSave={handleSaveInvoice}
              initialMode={modalMode}
              settings={settings}
              taxes={taxes}
              serviceCharges={serviceCharges}
            />
          )}
        </>
      );
    };

    export default InvoicesView;