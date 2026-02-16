import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Phone, Mail } from 'lucide-react';
import CustomerDetailModal from './CustomerDetailModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import AddCustomerModal from './pos-components/AddCustomerModal';
import CustomerMergeModal from './CustomerMergeModal';
import { groupDuplicateCustomers } from '@/lib/customerMerge';

const CustomersView = ({ customers, handlers, refreshData }) => {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAddOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showMerge, setShowMerge] = useState(false);

  const handleRowClick = (customer) => {
    setSelectedCustomer(customer);
  };

  const handleCloseModal = () => {
    setSelectedCustomer(null);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <>
      <motion.div
        key="customers"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full p-3 sm:p-4 md:p-6 flex flex-col"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
            <Users className="w-6 h-6" /> Customer Management
          </h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-80"
            />
            <Button onClick={() => setAddOpen(true)}>Add Customer</Button>
            {groupDuplicateCustomers(customers).length > 0 && (
              <Button variant="outline" onClick={() => setShowMerge(true)}>Review Duplicates</Button>
            )}
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="flex-grow md:hidden">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-3">
              {filtered.map((customer) => (
                <Card 
                  key={customer.id} 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleRowClick(customer)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{customer.name}</h3>
                        {customer.email && (
                          <p className="text-xs text-muted-foreground truncate flex items-center mt-1">
                            <Mail className="w-3 h-3 mr-1" />
                            {customer.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <Phone className="w-3 h-3 mr-1" />
                      {customer.phone}
                    </div>
                    <div className="flex justify-between text-sm mt-3 pt-3 border-t">
                      <div>
                        <span className="text-muted-foreground">Total Spent:</span>
                        <span className="font-semibold text-primary ml-1">
                          ${(customer.totalSpent || 0).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Visits:</span>
                        <span className="font-medium ml-1">{customer.visits || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block flex-grow bg-card rounded-xl shadow-md overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="bg-secondary sticky top-0">
                <tr>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Spent</th>
                  <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Visits</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-secondary cursor-pointer" onClick={() => handleRowClick(customer)}>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{customer.name}</div>
                          <div className="text-sm text-muted-foreground truncate">{customer.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{customer.phone}</td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary">${(customer.totalSpent || 0).toFixed(2)}</td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{customer.visits || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
      
      <CustomerDetailModal
        isOpen={!!selectedCustomer}
        onClose={handleCloseModal}
        customer={selectedCustomer}
        onSave={handlers.customers.update}
        onDelete={async (id) => {
          await handlers.customers.delete(id);
          setSelectedCustomer(null);
        }}
      />

      <AddCustomerModal
        isOpen={isAddOpen}
        onClose={() => setAddOpen(false)}
        onSave={async (payload) => {
          try {
            const phone = (payload.phone || '').replace(/\D/g, '');
            if (phone) {
              const found = await handlers.customers.findByPhone(phone);
              let matches = [];
              if (found) {
                matches = found.multiple ? found.matches : [found];
                // exact digits match only
                matches = matches.filter(m => (m.phone || '').replace(/\D/g, '') === phone);
              }
              if (matches.length > 0) {
                const names = matches.map(m => m.name).join(', ');
                if (window.confirm(`A customer with this phone already exists: ${names}.\nUse existing instead of creating a new one?`)) {
                  setAddOpen(false);
                  setSelectedCustomer(matches[0]);
                  return;
                }
                if (window.confirm('Merge new details into the existing customer? (OK = merge, Cancel = create new anyway)')) {
                  const base = matches[0];
                  const merged = {
                    ...base,
                    name: payload.name || base.name,
                    email: payload.email || base.email,
                    address: payload.address || base.address,
                    phone: base.phone || payload.phone
                  };
                  await handlers.customers.update(merged);
                  setAddOpen(false);
                  setSelectedCustomer(merged);
                  return;
                }
              }
            }
            const c = await handlers.customers.add(payload);
            if (c) setAddOpen(false);
          } catch (err) {
            console.error(err);
          }
        }}
      />

      <CustomerMergeModal
        isOpen={showMerge}
        onClose={() => setShowMerge(false)}
        customers={customers}
        onMerged={async () => {
          // After merge, refresh list if available
          if (handlers?.customers?.getAll) {
            try { await handlers.customers.getAll(); } catch {}
          }
          if (typeof refreshData === 'function') {
            try { await refreshData(); } catch {}
          }
          setShowMerge(false);
        }}
      />
    </>
  );
};

export default CustomersView;