import React from 'react';
import { NavLink } from 'react-router-dom';
import { Book, Landmark, Scale, FileText, Library, Receipt, Coins as HandCoins, Printer, BookUser } from 'lucide-react';

const navItems = [
  { to: 'chart-of-accounts', label: 'Chart of Accounts', icon: Library },
  { to: 'general-ledger', label: 'General Ledger', icon: Book },
  { to: 'accounts-payable', label: 'Accounts Payable', icon: Receipt },
  { to: 'accounts-receivable', label: 'Accounts Receivable', icon: HandCoins },
  { to: 'bank-reconciliation', label: 'Bank Reconciliation', icon: Landmark },
  { to: 'check-writing', label: 'Write Checks', icon: Printer },
  { to: 'check-register', label: 'Check Register', icon: BookUser },
  { to: 'reports', label: 'Financial Reports', icon: FileText },
];

const AccountingLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <div className="flex h-screen">
        <aside className="w-72 sidebar-gradient text-foreground p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center shadow-sm">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Accounting</h1>
            </div>
          </div>
          <nav className="space-y-2 flex-grow overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'text-primary/70 hover:bg-primary/10 hover:text-primary'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-hidden bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AccountingLayout;