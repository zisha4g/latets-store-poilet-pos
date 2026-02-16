import React from 'react';

const Receipt = React.forwardRef(({ sale, settings }, ref) => {
  if (!sale) return null;
  if (!sale.items || sale.items.length === 0) return null;

  const storeName = settings?.storeName?.value || 'ModularPOS';
  const storeAddress = settings?.storeAddress?.value || '123 Main Street, Anytown, USA';
  const storePhone = settings?.storePhone?.value || '';
  const logoUrl = settings?.logoUrl?.value;

  // Calculate totals - handle both old and new formats
  const subtotal = typeof sale.subtotal === 'number' ? sale.subtotal : 
    sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Handle taxes - check both JSONB array and legacy column
  const taxes = Array.isArray(sale.taxes) && sale.taxes.length > 0 
    ? sale.taxes 
    : (sale.tax_amount > 0 ? [{ name: 'Sales Tax', rate: sale.tax_rate || 0, amount: sale.tax_amount }] : []);
  
  const totalTax = taxes.reduce((sum, t) => sum + (t.amount || 0), 0);
  
  // Handle service charges
  const serviceCharges = Array.isArray(sale.service_charges_applied) && sale.service_charges_applied.length > 0
    ? sale.service_charges_applied
    : (sale.service_charge > 0 ? [{ name: 'Service Charge', amount: sale.service_charge }] : []);
  
  const totalServiceCharge = serviceCharges.reduce((sum, sc) => sum + (sc.amount || 0), 0);

  return (
    <div 
      ref={ref} 
      style={{
        width: '80mm', // Standard thermal printer width
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: '1.4',
        color: '#000',
        backgroundColor: '#fff',
        padding: '8mm',
      }}
    >
      {/* Store Header */}
      <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt="Logo" 
            style={{ height: '20mm', width: 'auto', margin: '0 auto', objectFit: 'contain' }} 
          />
        ) : (
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '2mm' }}>
            {storeName}
          </div>
        )}
        <div style={{ fontSize: '11px', lineHeight: '1.3' }}>
          {storeAddress}
        </div>
        {storePhone && (
          <div style={{ fontSize: '11px' }}>
            Tel: {storePhone}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #000', margin: '3mm 0' }}></div>

      {/* Sale Info */}
      <div style={{ fontSize: '11px', marginBottom: '3mm' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Date:</span>
          <span>{new Date(sale.created_at || sale.timestamp).toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Receipt #:</span>
          <span>{sale.id ? sale.id.slice(-8).toUpperCase() : 'N/A'}</span>
        </div>
        {sale.customer_id && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Customer:</span>
            <span>{sale.customer?.name || 'Customer'}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #000', margin: '3mm 0' }}></div>

      {/* Items */}
      <div style={{ marginBottom: '3mm' }}>
        {sale.items.map((item, index) => (
          <div key={index} style={{ marginBottom: '2mm' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span style={{ flex: 1 }}>{item.name}</span>
              <span>${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#333', paddingLeft: '4mm' }}>
              <span>{item.quantity} x ${(item.price || 0).toFixed(2)}</span>
              {item.sku && <span>SKU: {item.sku}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #000', margin: '3mm 0' }}></div>

      {/* Totals */}
      <div style={{ fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
          <span>Subtotal:</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        
        {taxes.map((tax, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
            <span>{tax.name} ({tax.rate}%):</span>
            <span>${(tax.amount || 0).toFixed(2)}</span>
          </div>
        ))}
        
        {serviceCharges.map((sc, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1mm' }}>
            <span>{sc.name}:</span>
            <span>${(sc.amount || 0).toFixed(2)}</span>
          </div>
        ))}

        {/* Total */}
        <div style={{ borderTop: '2px solid #000', marginTop: '2mm', paddingTop: '2mm' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
            <span>TOTAL:</span>
            <span>${(sale.total || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method */}
        {sale.payment_method && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2mm', fontSize: '11px' }}>
            <span>Payment:</span>
            <span style={{ textTransform: 'capitalize' }}>{sale.payment_method.replace(/_/g, ' ')}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #000', margin: '4mm 0' }}></div>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '2mm' }}>
          Thank You For Your Purchase!
        </div>
        <div style={{ fontSize: '10px', color: '#666' }}>
          Please Come Again
        </div>
        {settings?.receiptFooter?.value && (
          <div style={{ fontSize: '10px', marginTop: '2mm', color: '#666' }}>
            {settings.receiptFooter.value}
          </div>
        )}
      </div>

      {/* Barcode or QR Code placeholder - can be added later */}
      {sale.id && (
        <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: '10px', color: '#999' }}>
          ID: {sale.id}
        </div>
      )}
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;