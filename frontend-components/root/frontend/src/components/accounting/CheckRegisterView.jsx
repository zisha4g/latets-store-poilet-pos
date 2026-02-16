import React from 'react';
import { motion } from 'framer-motion';

const CheckRegisterView = ({ data }) => {
  const { checks, chartOfAccounts } = data;

  return (
    <motion.div
      key="check-register"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-6 flex flex-col"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-primary">Check Register</h2>
      </div>
      <div className="flex-grow overflow-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Check #</th>
              <th className="p-3 text-left">Payee</th>
              <th className="p-3 text-left">Bank Account</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-left">Memo</th>
            </tr>
          </thead>
          <tbody>
            {(checks || []).map(check => {
              const bankAccount = chartOfAccounts.find(acc => acc.id === check.bank_account_id);
              return (
                <tr key={check.id} className="hover:bg-muted/50">
                  <td className="p-3">{new Date(check.check_date).toLocaleDateString()}</td>
                  <td className="p-3">{check.check_number}</td>
                  <td className="p-3 font-medium">{check.payee_name}</td>
                  <td className="p-3">{bankAccount?.name}</td>
                  <td className="p-3 text-right font-semibold">${check.amount.toFixed(2)}</td>
                  <td className="p-3">{check.memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default CheckRegisterView;