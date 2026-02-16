import React from 'react';
import { Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AccountingLayout from '@/components/accounting/AccountingLayout';
import ChartOfAccountsView from '@/components/accounting/ChartOfAccountsView';
import GeneralLedgerView from '@/components/accounting/GeneralLedgerView';
import BankReconciliationView from '@/components/accounting/BankReconciliationView';
import FinancialReportsView from '@/components/accounting/FinancialReportsView';
import AccountsPayableView from '@/components/accounting/AccountsPayableView';
import AccountsReceivableView from '@/components/accounting/AccountsReceivableView';
import CheckWritingView from '@/components/accounting/CheckWritingView';
import CheckRegisterView from '@/components/accounting/CheckRegisterView';

function AccountingApp() {
  const { data, handlers } = useOutletContext();

  return (
    <AccountingLayout>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Navigate to="chart-of-accounts" replace />} />
          <Route path="chart-of-accounts" element={<ChartOfAccountsView data={data} handlers={handlers} />} />
          <Route path="general-ledger" element={<GeneralLedgerView data={data} handlers={handlers} />} />
          <Route path="bank-reconciliation" element={<BankReconciliationView data={data} handlers={handlers} />} />
          <Route path="accounts-payable" element={<AccountsPayableView data={data} handlers={handlers} />} />
          <Route path="accounts-receivable" element={<AccountsReceivableView data={data} handlers={handlers} />} />
          <Route path="check-writing" element={<CheckWritingView data={data} handlers={handlers} />} />
          <Route path="check-register" element={<CheckRegisterView data={data} handlers={handlers} />} />
          <Route path="reports" element={<FinancialReportsView data={data} handlers={handlers} />} />
        </Routes>
      </AnimatePresence>
    </AccountingLayout>
  );
}

export default AccountingApp;