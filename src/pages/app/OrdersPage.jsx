import React from 'react';
import { useOutletContext } from 'react-router-dom';
import DeliveriesView from '@/components/pos/orders/DeliveriesView';

const OrdersPage = () => {
  const context = useOutletContext();

  if (!context) {
    return null;
  }

  const { data = {}, handlers = {}, loading = false, error = null } = context;

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading Orders...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="h-full p-4 md:p-6">
      <DeliveriesView data={data} handlers={handlers} />
    </div>
  );
};

export default OrdersPage;
