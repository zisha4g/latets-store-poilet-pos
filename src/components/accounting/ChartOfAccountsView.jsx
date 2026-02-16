import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import AccountModal from './AccountModal';
import { defaultChartOfAccounts } from '@/constants/DefaultChartOfAccounts';

const AccountRow = ({ account, level, onEdit, onDelete, onToggle, isExpanded, expandedAccounts }) => {
  return (
    <>
      <tr className="hover:bg-muted/50">
        <td className="p-3">
          <div className="flex items-center" style={{ paddingLeft: `${level * 1.5}rem` }}>
            {account.children && account.children.length > 0 ? (
              <button onClick={() => onToggle(account.id)} className="mr-2 p-1 hover:bg-accent rounded-full">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : <div className="w-8 mr-2"></div>}
            <span className="font-medium">{account.name}</span>
          </div>
        </td>
        <td className="p-3 text-muted-foreground">{account.account_number}</td>
        <td className="p-3 text-muted-foreground">{account.account_type}</td>
        <td className="p-3 text-muted-foreground">{account.account_subtype}</td>
        <td className="p-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(account)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(account.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && account.children && account.children.map(child => (
        <AccountRow 
          key={child.id} 
          account={child} 
          level={level + 1} 
          onEdit={onEdit} 
          onDelete={onDelete}
          onToggle={onToggle}
          isExpanded={!!expandedAccounts[child.id]}
          expandedAccounts={expandedAccounts}
        />
      ))}
    </>
  );
};


const ChartOfAccountsView = ({ data, handlers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [expandedAccounts, setExpandedAccounts] = useState({});

  const accounts = data.chartOfAccounts || [];

  useEffect(() => {
    // Auto-expand parent accounts by default
    const parents = {};
    accounts.forEach(acc => {
      if (acc.parent_id) {
        parents[acc.parent_id] = true;
      }
    });
    setExpandedAccounts(parents);
  }, [accounts]);

  const hierarchicalAccounts = useMemo(() => {
    const accountMap = {};
    const roots = [];

    accounts.forEach(account => {
      accountMap[account.id] = { ...account, children: [] };
    });

    accounts.forEach(account => {
      if (account.parent_id && accountMap[account.parent_id]) {
        accountMap[account.parent_id].children.push(accountMap[account.id]);
      } else {
        roots.push(accountMap[account.id]);
      }
    });

    return roots;
  }, [accounts]);

  const handleCreateAccount = () => {
    setSelectedAccount(null);
    setIsModalOpen(true);
  };

  const handleEditAccount = (account) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  const handleDeleteAccount = async (id) => {
    if (window.confirm('Are you sure you want to delete this account? This cannot be undone.')) {
      try {
        await handlers.chartOfAccounts.delete(id);
        toast({ title: 'Success', description: 'Account deleted successfully.' });
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleSaveAccount = async (accountData) => {
    try {
      if (accountData.id) {
        await handlers.chartOfAccounts.update(accountData);
        toast({ title: 'Success', description: 'Account updated successfully.' });
      } else {
        await handlers.chartOfAccounts.add(accountData);
        toast({ title: 'Success', description: 'Account created successfully.' });
      }
      setIsModalOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLoadDefaults = async () => {
    if (window.confirm('This will add a standard set of accounts. Are you sure?')) {
      try {
        await handlers.chartOfAccounts.batchAdd(defaultChartOfAccounts);
        toast({ title: 'Success', description: 'Default chart of accounts loaded.' });
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  const toggleExpand = (accountId) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  return (
    <>
      <motion.div
        key="coa"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full p-6 flex flex-col"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-primary">Chart of Accounts</h2>
          <div className="flex gap-2">
            {accounts.length === 0 && (
              <Button onClick={handleLoadDefaults} variant="outline">
                <Download className="w-4 h-4 mr-2" /> Load Standard CoA
              </Button>
            )}
            <Button onClick={handleCreateAccount}>
              <Plus className="w-4 h-4 mr-2" /> Add New Account
            </Button>
          </div>
        </div>
        <div className="flex-grow overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="p-3 text-left font-semibold">Account Name</th>
                <th className="p-3 text-left font-semibold">Number</th>
                <th className="p-3 text-left font-semibold">Type</th>
                <th className="p-3 text-left font-semibold">Sub-Type</th>
                <th className="p-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hierarchicalAccounts.map(account => (
                <AccountRow 
                  key={account.id} 
                  account={account} 
                  level={0} 
                  onEdit={handleEditAccount} 
                  onDelete={handleDeleteAccount}
                  onToggle={toggleExpand}
                  isExpanded={!!expandedAccounts[account.id]}
                  expandedAccounts={expandedAccounts}
                />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
      {isModalOpen && (
        <AccountModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveAccount}
          account={selectedAccount}
          accounts={accounts}
        />
      )}
    </>
  );
};

export default ChartOfAccountsView;