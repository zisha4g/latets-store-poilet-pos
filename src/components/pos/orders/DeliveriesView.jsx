import React, { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Button } from '@/components/ui/button.jsx';
import { toast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { printDeliveryLabel } from '@/utils/deliveryLabel';
import { Edit, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import Receipt from '@/components/pos/Receipt';
import OrderEditModal from './OrderEditModal';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  'out-for-delivery': 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

const DeliveriesView = ({ data, handlers }) => {
  const deliveries = data?.deliveries || [];
  const customers = data?.customers || [];
  const sales = data?.sales || [];
  const phoneCallSessions = data?.phone_call_sessions || [];

  const [statusFilter, setStatusFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDelivery, setEditDelivery] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editSale, setEditSale] = useState(null);
  const [editVoiceDetails, setEditVoiceDetails] = useState(null);
  const [editCustomerMatches, setEditCustomerMatches] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeAudioDeliveryId, setActiveAudioDeliveryId] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [receiptCustomer, setReceiptCustomer] = useState(null);
  const receiptRef = useRef(null);

  const recordingBySaleId = useMemo(() => {
    const map = new Map();
    phoneCallSessions.forEach((session) => {
      const vars = session?.metadata?.graphState?.vars || {};
      const saleId = vars?.sale_id;
      if (!saleId) return;
      const streetNameRecording = vars?.street_name_recording || null;
      const addressRecording = session?.address_recording_url || null;
      const recordingUrl = streetNameRecording || addressRecording;
      const streetTranscript = vars?.street_name_recording_transcript || vars?.street_name_transcript || null;
      const addressTranscript = session?.address_transcript || vars?.address_transcript || null;
      if (!recordingUrl && !streetTranscript && !addressTranscript) return;
      const prev = map.get(saleId);
      if (!prev || new Date(session.created_at || 0) > new Date(prev.created_at || 0)) {
        map.set(saleId, {
          url: recordingUrl,
          streetTranscript,
          addressTranscript,
          providerCallId: session?.provider_call_id || null,
          created_at: session.created_at || null,
        });
      }
    });
    return map;
  }, [phoneCallSessions]);

  const rows = useMemo(() => {
    let items = deliveries.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (statusFilter !== 'all') items = items.filter(d => d.status === statusFilter);
    return items.map(d => {
      const customer = customers.find(c => c.id === d.customer_id);
      const sale = sales.find(s => s.id === d.sale_id);
      const isPhoneOrder = String(sale?.payment_method || '').toLowerCase().includes('phone');
      const recording = sale?.id ? recordingBySaleId.get(sale.id) : null;
      const customerPhoneDigits = digitsOnly(customer?.phone);
      const samePhoneCustomers = customerPhoneDigits
        ? customers.filter((c) => digitsOnly(c?.phone) === customerPhoneDigits)
        : [];
      return {
        d,
        customer,
        sale,
        isPhoneOrder,
        recordingUrl: recording?.url || null,
        voiceDetails: recording || null,
        samePhoneCustomers,
      };
    }).filter((row) => {
      if (orderTypeFilter === 'phone') return row.isPhoneOrder;
      if (orderTypeFilter === 'non-phone') return !row.isPhoneOrder;
      return true;
    });
  }, [deliveries, customers, sales, statusFilter, orderTypeFilter, recordingBySaleId]);

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

  const handlePlayRecording = (deliveryId, url) => {
    if (!url) {
      toast({ title: 'No recording found', description: 'This order does not have a street-name recording URL.' });
      return;
    }
    setActiveAudioDeliveryId((prev) => (prev === deliveryId ? null : deliveryId));
  };

  const handleEdit = (delivery, customer, sale, voiceDetails = null, samePhoneCustomers = []) => {
    setEditDelivery(delivery);
    setEditCustomer(customer);
    setEditSale(sale);
    setEditVoiceDetails(voiceDetails);
    setEditCustomerMatches(samePhoneCustomers);
    setEditModalOpen(true);
  };

  const triggerReceiptPrint = useReactToPrint({
    content: () => receiptRef.current,
  });

  const handlePrintReceipt = (sale, customer) => {
    if (!sale) {
      toast({ title: 'No sale found', description: 'This order is missing sale details.' });
      return;
    }
    setReceiptSale(sale);
    setReceiptCustomer(customer || null);
    setTimeout(() => triggerReceiptPrint(), 0);
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
          <span className="text-sm text-muted-foreground ml-2">Order type</span>
          <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Order type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="phone">Automatic Phone Orders</SelectItem>
              <SelectItem value="non-phone">Non-Phone Orders</SelectItem>
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
            rows.map(({ d, customer, sale, isPhoneOrder, recordingUrl, voiceDetails, samePhoneCustomers }) => {
              const saleItems = Array.isArray(sale?.items) ? sale.items : [];
              const itemCount = saleItems.reduce((s, i) => s + (i.quantity || 1), 0);
              const itemNames = saleItems.map(i => i.name).filter(Boolean).join(', ');
              const showAudio = activeAudioDeliveryId === d.id && !!recordingUrl;
              return (
              <div key={d.id} className="grid grid-cols-12 gap-4 items-center px-4 py-4 border-t cursor-pointer hover:bg-muted/30" onClick={() => handleEdit(d, customer, sale, voiceDetails, samePhoneCustomers)}>
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
                  {isPhoneOrder && <div className="text-[11px] text-blue-700 truncate">Automatic phone order</div>}
                  {showAudio && (
                    <div className="mt-2">
                      <audio controls preload="none" src={recordingUrl} className="w-full max-w-[280px]" />
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${statusColors[d.status] || 'bg-gray-100 text-gray-800'}`}>
                    {d.status}
                  </div>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2 flex-wrap md:flex-nowrap">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit Order" onClick={(e) => { e.stopPropagation(); handleEdit(d, customer, sale, voiceDetails, samePhoneCustomers); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete Order" onClick={(e) => { e.stopPropagation(); handleDelete(d, sale); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Select value={d.status} onValueChange={(v) => updateStatus(d, v)}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="out-for-delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  {isPhoneOrder && (
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs whitespace-nowrap" onClick={(e) => { e.stopPropagation(); handlePlayRecording(d.id, recordingUrl); }}>
                      {showAudio ? 'Hide Audio' : 'Play Audio'}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" className="h-8 px-2 text-xs whitespace-nowrap" onClick={(e) => { e.stopPropagation(); handlePrint(d, customer, sale); }}>Print Label</Button>
                  <Button variant="secondary" size="sm" className="h-8 px-2 text-xs whitespace-nowrap" onClick={(e) => { e.stopPropagation(); handlePrintReceipt(sale, customer); }}>Print Receipt</Button>
                </div>
              </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="hidden">
        <Receipt ref={receiptRef} sale={receiptSale ? { ...receiptSale, customer: receiptCustomer || undefined } : null} settings={data?.settings || {}} />
      </div>

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
        onClose={() => {
          setEditModalOpen(false);
          setEditDelivery(null);
          setEditVoiceDetails(null);
          setEditCustomerMatches([]);
        }}
        delivery={editDelivery}
        customer={editCustomer}
        sale={editSale}
        voiceDetails={editVoiceDetails}
        customerMatches={editCustomerMatches}
        handlers={handlers}
        products={data?.products || []}
        customers={customers}
      />
    </div>
  );
};

export default DeliveriesView;
