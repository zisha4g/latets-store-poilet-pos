export const demoData = {
  products: [
    { id: 'prod_1', name: 'Organic Espresso Beans', price: 22.50, stock: 45, barcode: '10001', category_id: 'cat_1', cost_price: 15.00, sku: 'COF-ESP-ORG' },
    { id: 'prod_2', name: 'Artisan Sourdough Loaf', price: 7.50, stock: 15, barcode: '10002', category_id: 'cat_2', cost_price: 3.50, sku: 'BRD-SDR-ART' },
    { id: 'prod_3', name: 'Cold Brew Concentrate', price: 15.00, stock: 30, barcode: '10003', category_id: 'cat_1', cost_price: 9.00, sku: 'COF-CLD-CON' },
    { id: 'prod_4', name: 'Gourmet Chocolate Croissant', price: 4.25, stock: 25, barcode: '10004', category_id: 'cat_2', cost_price: 1.75, sku: 'PST-CRO-CHC' },
    { id: 'prod_5', name: 'Reusable KeepCup', price: 18.00, stock: 50, barcode: '10005', category_id: 'cat_3', cost_price: 10.00, sku: 'MCH-CUP-KEE' },
    { id: 'prod_6', name: 'House Blend Drip Coffee', price: 16.00, stock: 60, barcode: '10006', category_id: 'cat_1', cost_price: 9.50, sku: 'COF-DRP-HSE' },
    { id: 'prod_7', name: 'Almond Croissant', price: 4.50, stock: 20, barcode: '10007', category_id: 'cat_2', cost_price: 2.00, sku: 'PST-CRO-ALM' },
    { id: 'prod_8', name: 'Branded Tote Bag', price: 12.00, stock: 40, barcode: '10008', category_id: 'cat_3', cost_price: 6.00, sku: 'MCH-BAG-TOTE' },
  ],
  categories: [
    { id: 'cat_1', name: 'Coffee Beans' },
    { id: 'cat_2', name: 'Pastries' },
    { id: 'cat_3', name: 'Merchandise' },
  ],
  customers: [
    { id: 'cust_1', name: 'John Doe', email: 'john.d@example.com', phone: '555-0101', address: '123 Main St' },
    { id: 'cust_2', name: 'Jane Smith', email: 'jane.s@example.com', phone: '555-0102', address: '456 Oak Ave' },
  ],
  sales: [
    { id: 'sale_1', customer_id: 'cust_1', total: 29.75, created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), items: [{ id: 'prod_1', name: 'Organic Espresso Beans', quantity: 1, price: 22.50 }, { id: 'prod_2', name: 'Artisan Sourdough Loaf', quantity: 1, price: 7.25 }], payment_method: 'credit' },
    { id: 'sale_2', customer_id: 'cust_2', total: 22.50, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), items: [{ id: 'prod_5', name: 'Reusable KeepCup', quantity: 1, price: 18.00 }, { id: 'prod_4', name: 'Gourmet Chocolate Croissant', quantity: 1, price: 4.50 }], payment_method: 'cash' },
  ],
  invoices: [],
  expenses: [],
  vendors: [],
  saved_carts: [],
  deliveries: [],
  taxes: [{ id: 'tax_1', name: 'Sales Tax', rate: 0.08, is_default: true }],
  service_charges: [],
  settings: {
    enableInvoicing: { key: 'enableInvoicing', value: true },
    enableAccounting: { key: 'enableAccounting', value: true },
    enablePBX: { key: 'enablePBX', value: true },
    storeName: { key: 'storeName', value: 'Demo Store' },
  },
  chartOfAccounts: [],
  journalEntries: [],
  vendorBills: [],
  appointments: [],
  tasks: [],
  pbxData: {
    businessHours: [
      { id: 'bh-1', day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: false },
      { id: 'bh-2', day_of_week: 2, open_time: '09:00', close_time: '18:00', is_closed: false },
      { id: 'bh-3', day_of_week: 3, open_time: '09:00', close_time: '18:00', is_closed: false },
      { id: 'bh-4', day_of_week: 4, open_time: '09:00', close_time: '18:00', is_closed: false },
      { id: 'bh-5', day_of_week: 5, open_time: '09:00', close_time: '20:00', is_closed: false },
      { id: 'bh-6', day_of_week: 6, open_time: '10:00', close_time: '17:00', is_closed: false },
      { id: 'bh-0', day_of_week: 0, open_time: '00:00', close_time: '00:00', is_closed: true },
    ],
    ivrMenus: [
      { id: 'ivr-1', name: 'Main Menu', greeting_text: 'Thanks for calling Demo Store. Press 1 for sales, 2 for support, 3 for hours.', options: [
        { digit: '1', action: 'extension', target: '101', label: 'Sales' },
        { digit: '2', action: 'extension', target: '102', label: 'Support' },
        { digit: '3', action: 'playback', target: 'hours', label: 'Hours' },
      ] },
    ],
    audioFiles: [
      { id: 'au-1', name: 'Welcome greeting', kind: 'greeting' },
      { id: 'au-2', name: 'Hold music', kind: 'hold' },
    ],
    extensions: [
      { id: 'ext-1', extension_number: '101', display_name: 'Sales', user_email: 'sales@demostore.com' },
      { id: 'ext-2', extension_number: '102', display_name: 'Support', user_email: 'support@demostore.com' },
      { id: 'ext-3', extension_number: '103', display_name: 'Manager', user_email: 'manager@demostore.com' },
    ],
    callLogs: [
      { id: 'cl-1', direction: 'inbound', status: 'completed', from_number: '+15551234567', to_number: '+18005550100', duration_seconds: 184, started_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(), answered_at: new Date(Date.now() - 1000 * 60 * 12 + 4000).toISOString(), ended_at: new Date(Date.now() - 1000 * 60 * 9).toISOString() },
      { id: 'cl-2', direction: 'outbound', status: 'completed', from_number: '+18005550100', to_number: '+15559876543', duration_seconds: 92, started_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), answered_at: new Date(Date.now() - 1000 * 60 * 45 + 6000).toISOString(), ended_at: new Date(Date.now() - 1000 * 60 * 43).toISOString() },
      { id: 'cl-3', direction: 'inbound', status: 'missed', from_number: '+15554443322', to_number: '+18005550100', duration_seconds: 0, started_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
      { id: 'cl-4', direction: 'inbound', status: 'completed', from_number: '+15552223344', to_number: '+18005550100', duration_seconds: 245, started_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), answered_at: new Date(Date.now() - 1000 * 60 * 120 + 3000).toISOString(), ended_at: new Date(Date.now() - 1000 * 60 * 116).toISOString() },
      { id: 'cl-5', direction: 'outbound', status: 'no-answer', from_number: '+18005550100', to_number: '+15557778899', duration_seconds: 0, started_at: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
    ],
    voicemails: [
      { id: 'vm-1', from_number: '+15554443322', duration_seconds: 32, is_read: false, created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(), transcription: 'Hi, calling about my online order, please call me back.' },
      { id: 'vm-2', from_number: '+15551112233', duration_seconds: 18, is_read: true, created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), transcription: 'Wanted to ask if you carry the espresso beans in 1kg bags.' },
    ],
  }
};