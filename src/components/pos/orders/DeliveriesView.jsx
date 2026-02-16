import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { toast } from '@/components/ui/use-toast';
import { printDeliveryLabel } from '@/utils/deliveryLabel';

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
      await handlers.deliveries.update(delivery.id, { status });
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
          <div className="col-span-3">Customer</div>
          <div className="col-span-3">Address</div>
          <div className="col-span-2">Order</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div>
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No deliveries found.</div>
          ) : (
            rows.map(({ d, customer, sale }) => (
              <div key={d.id} className="grid grid-cols-12 gap-4 items-center px-4 py-4 border-t">
                <div className="col-span-3">
                  <div className="font-medium">{customer?.name || 'Walk-in Customer'}</div>
                  <div className="text-xs text-muted-foreground">{customer?.phone || '—'}</div>
                </div>
                <div className="col-span-3 text-sm whitespace-pre-wrap break-words">
                  {d.address || '—'}
                </div>
                <div className="col-span-2 text-sm">
                  #{sale?.id || d.id}
                  <div className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</div>
                </div>
                <div className="col-span-2">
                  <div className={`inline-flex items-center px-2 py-1 rounded ${statusColors[d.status] || 'bg-gray-100 text-gray-800'}`}>
                    {d.status}
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Select value={d.status} onValueChange={(v) => updateStatus(d, v)}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="out-for-delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" size="sm" onClick={() => handlePrint(d, customer, sale)}>Print Label</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default DeliveriesView;
