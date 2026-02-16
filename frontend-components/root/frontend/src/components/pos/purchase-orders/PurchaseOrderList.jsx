import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, FileText } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import PurchaseOrderModal from './PurchaseOrderModal';
import { useResponsive } from '@/lib/responsive';
import { motion } from 'framer-motion';

const PurchaseOrderList = ({ purchaseOrders = [], vendors = [], products = [], handlers, onRefresh }) => {
  const { isMobile } = useResponsive();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPO, setSelectedPO] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view');

  const filteredOrders = (purchaseOrders || []).filter(order => {
    const vendor = vendors.find(v => v.id === order.vendor_id);
    const searchLower = searchTerm.toLowerCase();
    return (
      order.po_number?.toLowerCase().includes(searchLower) ||
      order.status?.toLowerCase().includes(searchLower) ||
      vendor?.name?.toLowerCase().includes(searchLower)
    );
  });

  const handleDeletePO = async (poId) => {
    if (window.confirm("Are you sure you want to delete this purchase order?")) {
      try {
        await handlers.purchase_orders.delete(poId);
        toast({ title: "Success", description: "Purchase order deleted successfully" });
        onRefresh?.();
      } catch (error) {
        toast({ 
          title: "Error", 
          description: "Failed to delete purchase order: " + error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleNewOrder = () => {
    setSelectedPO(null);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewOrder = (order) => {
    setSelectedPO(order);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEditOrder = (order, e) => {
    e.stopPropagation();
    setSelectedPO(order);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPO(null);
  };

  const handleSavePO = async (poData) => {
    try {
      if (poData.id) {
        await handlers.purchase_orders.update(poData);
        toast({ title: "Success", description: "Purchase order updated successfully" });
      } else {
        await handlers.purchase_orders.add(poData);
        toast({ title: "Success", description: "Purchase order created successfully" });
      }
      onRefresh?.();
      handleCloseModal();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            type="text"
            placeholder="Search purchase orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleNewOrder} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">New Order</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-card rounded-lg shadow-md overflow-hidden flex-grow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">PO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-muted">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-muted-foreground">
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const vendor = vendors.find(v => v.id === order.vendor_id);
                  return (
                    <tr 
                      key={order.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleViewOrder(order)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{order.po_number || order.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{vendor?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                          order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {order.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {order.order_date ? new Date(order.order_date).toLocaleDateString() : 
                         order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ${order.total_amount?.toFixed(2) || order.total?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            title="View"
                            onClick={() => handleViewOrder(order)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            title="Edit"
                            onClick={(e) => handleEditOrder(order, e)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-500 hover:text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDeletePO(order.id); }}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex-grow space-y-3 overflow-auto">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No purchase orders found</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const vendor = vendors.find(v => v.id === order.vendor_id);
            return (
              <motion.div
                key={order.id}
                className="bg-card rounded-lg shadow p-4"
                onClick={() => handleViewOrder(order)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-base">{order.po_number || order.id}</h3>
                    <p className="text-sm text-muted-foreground">{vendor?.name || 'Unknown'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                    order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {order.status || 'pending'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Date</p>
                    <p className="text-sm">
                      {order.order_date ? new Date(order.order_date).toLocaleDateString() : 
                       order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                    <p className="font-semibold text-primary">
                      ${order.total_amount?.toFixed(2) || order.total?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleViewOrder(order)}
                    className="flex-1"
                  >
                    <FileText className="w-4 h-4 mr-2" /> View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => handleEditOrder(order, e)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={(e) => { e.stopPropagation(); handleDeletePO(order.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <PurchaseOrderModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        purchaseOrder={selectedPO}
        vendors={vendors}
        products={products}
        handlers={handlers}
        onSave={handleSavePO}
        initialMode={modalMode}
      />
    </div>
  );
};

export default PurchaseOrderList;
