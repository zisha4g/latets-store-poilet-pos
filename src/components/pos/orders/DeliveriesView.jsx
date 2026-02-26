import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { toast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { printDeliveryLabel } from '@/utils/deliveryLabel';
import { Edit, Trash2 } from 'lucide-react';
import OrderEditModal from './OrderEditModal';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  'out-for-delivery': 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const DeliveriesView = ({ data, handlers }) => {
  const deliveries = data?.deliveries || [];
  const customers = data?.customers || [];
  const sales = data?.sales || [];

  const [statusFilter, setStatusFilter] = useState('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDelivery, setEditDelivery] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editSale, setEditSale] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const rows = useMemo(() => {
    let items = deliveries.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (statusFilter !== 'all') items = items.filter(d => d.status === statusFilter);
    return items.map(d => {
      const customer = customers.find(c => c.id === d.customer_id);
      const sale = sales.find(s => s.id === d.sale_id);
      return { d, customer, sale };
    });
  }, [deliveries, customers, sales, statusFilter]);

  const updateStatus = async (delivery, status) => {
    try {
      await handlers.deliveries.update({ id: delivery.id, status });
      toast({ title: 'Delivery Updated', description: `Status set to ${status}` });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  const handlePrint = (delivery, customer, sale) => {
    printDeliveryLabel({
      orderNumber: sale?.id || delivery.id,
      customerName: customer?.name || 'Walk-in Customer',
      phone: customer?.phone || '',
      address: delivery?.address || '',
      instructions: delivery?.instructions || '',
    });
  };

  const handleEdit = (delivery, customer, sale) => {
    setEditDelivery(delivery);
    setEditCustomer(customer);
    setEditSale(sale);
    setEditModalOpen(true);
  };

  const handleDelete = (delivery, sale) => {
    setDeleteTarget({ delivery, sale });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { delivery, sale } = deleteTarget;
    try {
      if (delivery?.id) await handlers.deliveries.delete(delivery.id);
      if (sale?.id) await handlers.sales.delete(sale.id);
      toast({ title: 'Order Deleted' });
    } catch (e) {
      toast({ title: 'Delete Failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter by status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="out-for-delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted text-xs font-semibold text-muted-foreground">
          <div className="col-span-2">Customer</div>
          <div className="col-span-2">Address</div>
          <div className="col-span-3">Order</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        <div>
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No deliveries found.</div>
          ) : (
            rows.map(({ d, customer, sale }) => {
              const saleItems = Array.isArray(sale?.items) ? sale.items : [];
              const itemCount = saleItems.reduce((s, i) => s + (i.quantity || 1), 0);
              const itemNames = saleItems.map(i => i.name).filter(Boolean).join(', ');
              return (
              <div key={d.id} className="grid grid-cols-12 gap-4 items-center px-4 py-4 border-t">
                <div className="col-span-2">
                  <div className="font-medium">{customer?.name || 'Walk-in Customer'}</div>
                  <div className="text-xs text-muted-foreground">{customer?.phone || '—'}</div>
                </div>
                <div className="col-span-2 text-sm whitespace-pre-wrap break-words">
                  {d.address || '—'}
                </div>
                <div className="col-span-3 min-w-0">
                  <div className="text-xs text-muted-foreground truncate">
                    {new Date(d.created_at).toLocaleDateString()} · {itemCount} item{itemCount !== 1 ? 's' : ''} · ${sale?.total?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-muted-foreground/70 truncate" title={itemNames}>
                    {itemNames || '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${statusColors[d.status] || 'bg-gray-100 text-gray-800'}`}>
                    {d.status}
                  </div>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit Order" onClick={() => handleEdit(d, customer, sale)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete Order" onClick={() => handleDelete(d, sale)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Select value={d.status} onValueChange={(v) => updateStatus(d, v)}>
                    <SelectTrigger className="w-28 h-8 text-xs truncate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="out-for-delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" size="sm" onClick={() => handlePrint(d, customer, sale)}>Print</Button>
                </div>
              </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderEditModal
        open={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditDelivery(null); }}
        delivery={editDelivery}
        customer={editCustomer}
        sale={editSale}
        handlers={handlers}
        products={data?.products || []}
        customers={customers}
      />
    </div>
  );
};

export default DeliveriesView;
