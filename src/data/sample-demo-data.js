export const demoData = {
  products: [
    { id: 'prod_1', name: 'Organic Espresso Beans', price: 22.50, stock: 45, barcode: '10001', category_id: 'cat_1', cost_price: 15.00, sku: 'COF-ESP-ORG' },
    { id: 'prod_2', name: 'Artisan Sourdough Loaf', price: 7.50, stock: 15, barcode: '10002', category_id: 'cat_2', cost_price: 3.50, sku: 'BRD-SDR-ART' },
    { id: 'prod_3', name: 'Cold Brew Concentrate', price: 15.00, stock: 30, barcode: '10003', category_id: 'cat_1', cost_price: 9.00, sku: 'COF-CLD-CON' },
    { id: 'prod_4', name: 'Gourmet Chocolate Croissant', price: 4.25, stock: 25, barcode: '10004', category_id: 'cat_2', cost_price: 1.75, sku: 'PST-CRO-CHC' },
    { id: 'prod_5', name: 'NPOS KeepCup', price: 18.00, stock: 50, barcode: '10005', category_id: 'cat_3', cost_price: 10.00, sku: 'MCH-CUP-KEE' },
    { id: 'prod_6', name: 'House Blend Drip Coffee', price: 16.00, stock: 60, barcode: '10006', category_id: 'cat_1', cost_price: 9.50, sku: 'COF-DRP-HSE' },
    { id: 'prod_7', name: 'Almond Croissant', price: 4.50, stock: 20, barcode: '10007', category_id: 'cat_2', cost_price: 2.00, sku: 'PST-CRO-ALM' },
    { id: 'prod_8', name: 'NPOS Branded Tote Bag', price: 12.00, stock: 40, barcode: '10008', category_id: 'cat_3', cost_price: 6.00, sku: 'MCH-BAG-TOTE' },
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
    { id: 'sale_2', customer_id: 'cust_2', total: 22.50, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), items: [{ id: 'prod_5', name: 'NPOS KeepCup', quantity: 1, price: 18.00 }, { id: 'prod_4', name: 'Gourmet Chocolate Croissant', quantity: 1, price: 4.50 }], payment_method: 'cash' },
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
    storeName: { key: 'storeName', value: 'NPOS Demo Store' },
  },
  chartOfAccounts: [],
  journalEntries: [],
  vendorBills: [],
  appointments: [],
  tasks: [],
  pbxData: {
    businessHours: [], ivrMenus: [], audioFiles: [], extensions: [], callLogs: [], voicemails: []
  }
};