import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VendorList from './VendorList';
import PurchaseOrderList from './purchase-orders/PurchaseOrderList';
import { useResponsive } from '@/lib/responsive';

const PurchasingView = ({ vendors, products, handlers, isEmbedded = false }) => {
  const { isMobile } = useResponsive();
  const [purchaseOrders, setPurchaseOrders] = useState([]);

  const fetchPurchaseOrders = async () => {
    if (handlers?.purchase_orders) {
      try {
        const data = await handlers.purchase_orders.getAll();
        setPurchaseOrders(data || []);
      } catch (error) {
        console.error('Error fetching purchase orders:', error);
      }
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [handlers]);

  const refreshPurchaseOrders = () => {
    fetchPurchaseOrders();
  };

  return (
    <motion.div
      key="purchasing"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full flex flex-col"
    >
      {!isEmbedded && (
        <div className="flex justify-between items-center mb-4 sm:mb-6 p-4 sm:p-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary">Purchasing</h2>
        </div>
      )}
      <Tabs defaultValue="purchase_orders" className="flex-grow flex flex-col">
        <TabsList className="mx-4 sm:mx-6">
          <TabsTrigger value="purchase_orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>
        <TabsContent value="purchase_orders" className="flex-grow mt-4 px-4 sm:px-6">
          <PurchaseOrderList
            purchaseOrders={purchaseOrders}
            handlers={handlers}
            onRefresh={refreshPurchaseOrders}
            products={products}
            vendors={vendors}
          />
        </TabsContent>
        <TabsContent value="vendors" className="flex-grow mt-4 px-4 sm:px-6">
          <VendorList vendors={vendors} handlers={handlers} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default PurchasingView;
  