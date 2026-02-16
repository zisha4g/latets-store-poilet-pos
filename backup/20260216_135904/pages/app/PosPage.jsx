import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PosView from '@/components/pos/PosView';
import { Button } from '@/components/ui/button';

// This component acts as the "SafeOutletContextWrapper" requested
const PosPage = () => {
    // 1. Safe context access
    const context = useOutletContext();
    
    // 2. Debug logging for context issues
    React.useEffect(() => {
        if (!context) {
            console.error("PosPage: useOutletContext() returned undefined/null. AppLayout might not be rendering Outlet correctly.");
        }
    }, [context]);

    // 3. Early return if context is completely missing
    if (!context) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
          <p className="text-muted-foreground">Initializing POS...</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }
    
    // 4. Safe destructuring with defaults
    const { 
        data = {}, 
        handlers = {}, 
        loading = false, 
        error = null 
    } = context;
    
    const { 
      products = [], 
      settings = {}, 
      savedCarts = [] 
    } = data || {};
    
    // 5. Loading state
    if (loading && (!products || products.length === 0)) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg">Loading POS Data...</p>
          </div>
        </div>
      );
    }
    
    // 6. Error state
    if (error) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-destructive mb-2">Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      );
    }
    
    // 7. Error Boundary for PosView
    try {
        return (
          <PosView 
            products={products} 
            handlers={handlers} 
            settings={settings} 
            savedCarts={savedCarts} 
          />
        );
    } catch (renderError) {
        console.error("Critical Error Rendering PosView:", renderError);
        return (
             <div className="w-full h-full flex items-center justify-center p-8">
                <div className="text-center border-destructive border p-6 rounded-lg bg-destructive/10">
                    <h3 className="text-lg font-bold text-destructive">Something went wrong</h3>
                    <p className="text-sm text-muted-foreground mb-4">We encountered a problem loading the POS interface.</p>
                    <Button onClick={() => window.location.reload()}>Reload Page</Button>
                </div>
             </div>
        );
    }
};

export default PosPage;