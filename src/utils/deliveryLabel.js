const escapeHtml = (value) => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const printDeliveryLabel = ({
  order,
  orderNumber,
  customer,
  customerName,
  phone,
  address,
  instructions,
  items,
}) => {
  if (typeof window === 'undefined') return;

  const name = customerName || customer?.name || 'Customer';
  const phoneValue = phone || customer?.phone || '';
  const addressValue = address || customer?.address || '';
  const orderId = orderNumber || order?.id || 'Order';
  const lineItems = items || order?.items || [];

  const itemsHtml = Array.isArray(lineItems) && lineItems.length > 0
    ? lineItems
        .map((item) => {
          const title = item.name || item.title || 'Item';
          const qty = item.quantity || 1;
          return `<li>${escapeHtml(title)} x ${escapeHtml(qty)}</li>`;
        })
        .join('')
    : '<li>No items listed</li>';

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Delivery Label</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 20px; }
      .section { margin-bottom: 12px; }
      .label { font-weight: bold; }
      ul { padding-left: 18px; margin: 6px 0 0; }
      .divider { border-top: 1px solid #ddd; margin: 12px 0; }
    </style>
  </head>
  <body>
    <h1>Delivery Label</h1>
    <div class="section"><span class="label">Order:</span> ${escapeHtml(orderId)}</div>
    <div class="section"><span class="label">Name:</span> ${escapeHtml(name)}</div>
    <div class="section"><span class="label">Phone:</span> ${escapeHtml(phoneValue)}</div>
    <div class="section"><span class="label">Address:</span> ${escapeHtml(addressValue)}</div>
    <div class="section"><span class="label">Instructions:</span> ${escapeHtml(instructions || 'None')}</div>
    <div class="divider"></div>
    <div class="section"><span class="label">Items:</span>
      <ul>${itemsHtml}</ul>
    </div>
  </body>
</html>`;

  const popup = window.open('', '_blank', 'width=640,height=720');
  if (!popup) return;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
};
