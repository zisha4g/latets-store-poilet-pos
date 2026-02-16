import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from '@/components/ui/toaster.jsx';
import Sidebar from '@/components/pos/Sidebar.jsx';
import PosView from '@/components/pos/PosView.jsx';
import InventoryView from '@/components/pos/InventoryView.jsx';
import CustomersView from '@/components/pos/CustomersView.jsx';
import ReportsView from '@/components/pos/ReportsView.jsx';
import SettingsView from '@/components/pos/SettingsView.jsx';
import InvoicesView from '@/components/pos/InvoicesView.jsx';
import PurchasingView from '@/components/pos/PurchasingView.jsx';
import PBXView from '@/components/pos/PBXView.jsx';
import CallModal from '@/components/pos/pbx/CallModal.jsx';
import { useOnlineStatus } from '@/hooks/useOnlineStatus.js';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { useHotkeys } from '@/hooks/use-hotkeys.js';
import { useDataManagement } from '@/hooks/useDataManagement.js';
import { toast } from '@/components/ui/use-toast.js';
import { useNavigate } from 'react-router-dom';
import { applyTheme } from '@/lib/themes.js';

function App({ isDemo = false }) {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  
  const { data, handlers, customersWithStats, refreshData } = useDataManagement(isDemo ? { id: 'demo-user' } : user, isDemo);
  const { products, customers, sales, categories, invoices, expenses, taxes, serviceCharges, vendors, saved_carts: savedCarts, settings, pbxData, chartOfAccounts, journalEntries, vendorBills } = data;

  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    if (settings?.theme?.value) {
      applyTheme(settings.theme.value);
    }
  }, [settings?.theme?.value]);

  useHotkeys([
    ['alt+p', () => setActiveTab('pos')],
    ['alt+i', () => setActiveTab('inventory')],
    ['alt+c', () => setActiveTab('customers')],
    ['alt+u', () => setActiveTab('purchasing')],
    ['alt+s', () => setActiveTab('settings')],
    ['alt+x', () => settings.enablePBX?.value && setActiveTab('pbx')],
    ['alt+a', () => settings.enableAccounting?.value && navigate('/accounting')],
  ]);

  const handleStartCall = async (phoneNumber, direction, customer = null) => {
    let caller = customer;
    if (!caller && direction === 'inbound') {
      caller = await handlers.customers.findByPhone(phoneNumber);
    }
    setActiveCall({ phoneNumber, direction, customer: caller });
  };

  const handleSaveCallLog = async (logData) => {
    await handlers.pbx.call_logs.add(logData);
    toast({ title: "Call Logged", description: "The call has been saved to history." });
  };

  const handleAddNewCustomerFromCall = async (customerData) => {
    const newCustomer = await handlers.customers.add(customerData);
    if (activeCall) {
      setActiveCall(prev => ({ ...prev, customer: newCustomer }));
    }
    return newCustomer;
  };
  
  const handleStartSaleFromCall = (customer) => {
    setActiveTab('pos');
    toast({ title: `Starting sale for ${customer.name}`});
    setActiveCall(null);
  };

  const handleViewInvoicesFromCall = (customer) => {
    setActiveTab('invoices');
    toast({ title: `Viewing invoices for ${customer.name}`});
    setActiveCall(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'pos':
        return (
          <PosView
            products={products}
            handlers={handlers}
            settings={settings}
            savedCarts={savedCarts}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            products={products}
            categories={categories}
            handlers={handlers}
          />
        );
      case 'customers':
        return <CustomersView customers={customersWithStats} handlers={handlers} onStartCall={handleStartCall} />;
      case 'invoices':
        return settings.enableInvoicing?.value ? <InvoicesView invoices={invoices} customers={customers} products={products} handlers={handlers} settings={settings} taxes={taxes} serviceCharges={serviceCharges} /> : null;
      case 'purchasing':
        return settings.enableAccounting?.value ? <PurchasingView vendors={vendors} products={products} handlers={handlers} /> : null;
      case 'reports':
        return <ReportsView sales={sales} products={products} customers={customers} settings={settings} />;
      case 'pbx':
        return settings.enablePBX?.value ? <PBXView pbxData={pbxData} handlers={handlers} onSimulateCall={() => handleStartCall('1-800-555-1234', 'inbound')} /> : null;
      case 'settings':
        return <SettingsView settings={settings} handlers={handlers} taxes={taxes} serviceCharges={serviceCharges} pbxData={pbxData} />;
      default:
        return <InventoryView products={products} categories={categories} handlers={handlers} />;
    }
  };

  return (
    <div className="min-h-screen bg-secondary text-foreground">
      <div className="flex h-screen">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOnline={isOnline} settings={settings} isDemo={isDemo} />
        <main className="flex-1 overflow-hidden bg-background">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </main>
      </div>
      <Toaster />
      <CallModal
        isOpen={!!activeCall}
        onClose={() => setActiveCall(null)}
        call={activeCall}
        onSaveLog={handleSaveCallLog}
        onAddNewCustomer={handleAddNewCustomerFromCall}
        onStartSale={handleStartSaleFromCall}
        onViewInvoices={handleViewInvoicesFromCall}
        user={user}
        isDemo={isDemo}
      />
    </div>
  );
}

export default App;