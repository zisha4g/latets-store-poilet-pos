import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { Helmet } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import Sidebar from '@/components/pos/Sidebar';
import CallModal from '@/components/pos/pbx/CallModal';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useDataManagement } from '@/hooks/useDataManagement';
import { toast } from '@/components/ui/use-toast';
import { applyTheme } from '@/lib/themes';

const AppLayout = ({ isDemo = false }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  
  // Initialize data management with safe fallback for user
  const { data, handlers, loading: dataLoading, error: dataError, customersWithStats, refreshData } = useDataManagement(
    isDemo ? { id: 'demo-user' } : (user || { id: null }), 
    isDemo
  );
  
  const { settings } = data || {};

  const [activeCall, setActiveCall] = useState(null);
  const [storeName, setStoreName] = useState('StorePilot');

  // Authentication check
  useEffect(() => {
    if (!authLoading && !user && !isDemo) {
      navigate('/login');
    }
  }, [user, authLoading, navigate, isDemo]);

  // Theme application
  useEffect(() => {
    try {
      const themeValue = settings?.theme?.value || 'light';
      applyTheme(themeValue);
    } catch (e) {
      console.warn("Failed to apply theme:", e);
      applyTheme('light');
    }
    
    return () => {
      applyTheme('light');
    };
  }, [settings?.theme?.value]);

  // Store name application
  useEffect(() => {
    if (settings?.storeName?.value) {
      setStoreName(settings.storeName.value);
    } else {
      setStoreName('StorePilot');
    }
  }, [settings?.storeName?.value]);

  const handleStartCall = async (phoneNumber, direction, customer = null) => {
    let caller = customer;
    if (!caller && direction === 'inbound' && handlers?.customers?.findByPhone) {
      try {
        caller = await handlers.customers.findByPhone(phoneNumber);
      } catch (error) {
        console.error('Error finding customer:', error);
      }
    }
    setActiveCall({ phoneNumber, direction, customer: caller });
  };
  
  const handleSaveCallLog = async (logData) => {
    if (!handlers?.pbx?.call_logs?.add) {
      toast({ title: "Error", description: "Call logging is not available.", variant: "destructive" });
      return;
    }
    try {
      await handlers.pbx.call_logs.add(logData);
      toast({ title: "Call Logged", description: "The call has been saved to history." });
    } catch (error) {
      console.error('Error saving call log:', error);
      toast({ title: "Error", description: "Failed to save call log.", variant: "destructive" });
    }
  };
  
  const handleAddNewCustomerFromCall = async (customerData) => {
    if (!handlers?.customers?.add) {
      toast({ title: "Error", description: "Customer creation is not available.", variant: "destructive" });
      return null;
    }
    try {
      const newCustomer = await handlers.customers.add(customerData);
      if (activeCall) {
        setActiveCall(prev => ({ ...prev, customer: newCustomer }));
      }
      return newCustomer;
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({ title: "Error", description: "Failed to add customer.", variant: "destructive" });
      return null;
    }
  };
    
  if (authLoading || (dataLoading && !data?.products)) { // Only block if core data isn't ready
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg animate-pulse">Loading Your Store...</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Data</h2>
          <p className="text-muted-foreground mb-4">{dataError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user && !isDemo) {
    return null; 
  }

  // Construct context with safety checks
  const outletContext = { 
    data: data || {}, 
    handlers: handlers || {}, 
    customersWithStats: customersWithStats || [], 
    refreshData, 
    handleStartCall,
    loading: dataLoading,
    error: dataError,
    // Add helpers to check context validity
    isReady: !dataLoading && !dataError
  };

  return (
    <>
      <Helmet>
        <title>{storeName} - StorePilot</title>
      </Helmet>
      <div className="min-h-screen bg-secondary text-foreground">
        <div className="flex h-screen">
          <Sidebar isOnline={isOnline} settings={settings || {}} isDemo={isDemo} />
          <main className="flex-1 overflow-hidden bg-background">
            <Outlet context={outletContext} />
          </main>
        </div>
        <Toaster />
        <CallModal
          isOpen={!!activeCall}
          onClose={() => setActiveCall(null)}
          call={activeCall}
          onSaveLog={handleSaveCallLog}
          onAddNewCustomer={handleAddNewCustomerFromCall}
          onStartSale={(customer) => {
            navigate('/app/pos', { state: { customer } });
            toast({ title: `Starting sale for ${customer.name}`});
            setActiveCall(null);
          }}
          onViewInvoices={(customer) => {
            navigate('/app/invoices', { state: { customerId: customer.id } });
            toast({ title: `Viewing invoices for ${customer.name}`});
            setActiveCall(null);
          }}
          user={user}
          isDemo={isDemo}
        />
      </div>
    </>
  );
};

export default AppLayout;