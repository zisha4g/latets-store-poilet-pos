import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import PayBillsModal from './PayBillsModal';

const AccountsPayableView = ({ data, handlers }) => {
  const [selectedBills, setSelectedBills] = useState({});
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const { vendorBills, vendors, chartOfAccounts } = data;

  const openBills = useMemo(() => {
    return (vendorBills || []).filter(b => b.status !== 'paid');
  }, [vendorBills]);

  const handleSelectBill = (billId) => {
    setSelectedBills(prev => ({ ...prev, [billId]: !prev[billId] }));
  };

  const selectedBillItems = useMemo(() => {
    return openBills.filter(b => selectedBills[b.id]);
  }, [selectedBills, openBills]);

  const handlePayBills = () => {
    if (selectedBillItems.length === 0) {
      toast({ title: 'No bills selected', description: 'Please select at least one bill to pay.', variant: 'destructive' });
      return;
    }
    setIsPayModalOpen(true);
  };

  const handleSavePayment = async (paymentData) => {
    try {
      // This would be a complex handler involving creating a vendor_payment,
      // creating allocations, creating a journal entry, and potentially a check.
      // For now, we'll just show a success message.
      console.log('Saving payment:', paymentData);
      toast({ title: 'Success', description: 'Payment recorded successfully.' });
      setIsPayModalOpen(false);
      setSelectedBills({});
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <motion.div
        key="ap"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full p-6 flex flex-col"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-primary">Accounts Payable</h2>
          <Button onClick={handlePayBills} disabled={selectedBillItems.length === 0}>
            Pay Selected Bills
          </Button>
        </div>
        <div className="flex-grow overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 w-12"><Checkbox /></th>
                <th className="p-3 text-left">Vendor</th>
                <th className="p-3 text-left">Bill Date</th>
                <th className="p-3 text-left">Due Date</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-right">Amount Due</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {openBills.map(bill => {
                const vendor = vendors.find(v => v.id === bill.vendor_id);
                return (
                  <tr key={bill.id} className="hover:bg-muted/50">
                    <td className="p-3"><Checkbox checked={!!selectedBills[bill.id]} onCheckedChange={() => handleSelectBill(bill.id)} /></td>
                    <td className="p-3 font-medium">{vendor?.name || 'N/A'}</td>
                    <td className="p-3">{new Date(bill.bill_date).toLocaleDateString()}</td>
                    <td className="p-3">{new Date(bill.due_date).toLocaleDateString()}</td>
                    <td className="p-3 text-right">${bill.total_amount.toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold">${(bill.total_amount - bill.amount_paid).toFixed(2)}</td>
                    <td className="p-3 capitalize">{bill.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
      {isPayModalOpen && (
        <PayBillsModal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          billsToPay={selectedBillItems}
          accounts={chartOfAccounts}
          vendors={vendors}
          onSave={handleSavePayment}
        />
      )}
    </>
  );
};

export default AccountsPayableView;