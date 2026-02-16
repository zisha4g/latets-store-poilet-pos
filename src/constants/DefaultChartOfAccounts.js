export const defaultChartOfAccounts = [
  { name: 'Assets', account_type: 'Asset', children: [
    { name: 'Current Assets', account_type: 'Asset', children: [
      { name: 'Cash and Cash Equivalents', account_type: 'Asset', children: [
        { name: 'Checking Account', account_type: 'Asset', account_subtype: 'Bank' },
        { name: 'Savings Account', account_type: 'Asset', account_subtype: 'Bank' },
        { name: 'Petty Cash', account_type: 'Asset', account_subtype: 'Bank' },
      ]},
      { name: 'Accounts Receivable (A/R)', account_type: 'Asset', account_subtype: 'Accounts Receivable' },
      { name: 'Inventory', account_type: 'Asset', account_subtype: 'Inventory' },
      { name: 'Prepaid Expenses', account_type: 'Asset', account_subtype: 'Current Asset' },
    ]},
    { name: 'Fixed Assets', account_type: 'Asset', children: [
      { name: 'Furniture and Equipment', account_type: 'Asset', account_subtype: 'Fixed Asset' },
      { name: 'Computers and Software', account_type: 'Asset', account_subtype: 'Fixed Asset' },
      { name: 'Accumulated Depreciation', account_type: 'Asset', account_subtype: 'Fixed Asset' },
    ]},
  ]},
  { name: 'Liabilities', account_type: 'Liability', children: [
    { name: 'Current Liabilities', account_type: 'Liability', children: [
      { name: 'Accounts Payable (A/P)', account_type: 'Liability', account_subtype: 'Accounts Payable' },
      { name: 'Credit Card Payable', account_type: 'Liability', account_subtype: 'Credit Card' },
      { name: 'Sales Tax Payable', account_type: 'Liability', account_subtype: 'Current Liability' },
      { name: 'Accrued Payroll', account_type: 'Liability', account_subtype: 'Current Liability' },
    ]},
    { name: 'Long-Term Liabilities', account_type: 'Liability', children: [
      { name: 'Business Loan Payable', account_type: 'Liability', account_subtype: 'Long-Term Liability' },
    ]},
  ]},
  { name: 'Equity', account_type: 'Equity', children: [
    { name: "Owner's Contribution", account_type: 'Equity', account_subtype: "Owner's Equity" },
    { name: "Owner's Draw", account_type: 'Equity', account_subtype: "Owner's Equity" },
    { name: 'Retained Earnings', account_type: 'Equity', account_subtype: 'Retained Earnings' },
  ]},
  { name: 'Revenue', account_type: 'Revenue', children: [
    { name: 'Sales Revenue', account_type: 'Revenue', account_subtype: 'Sales' },
    { name: 'Service Revenue', account_type: 'Revenue', account_subtype: 'Service Revenue' },
    { name: 'Shipping & Delivery Income', account_type: 'Revenue', account_subtype: 'Other Income' },
    { name: 'Sales Discounts', account_type: 'Revenue', account_subtype: 'Sales' },
  ]},
  { name: 'Expenses', account_type: 'Expense', children: [
    { name: 'Cost of Goods Sold (COGS)', account_type: 'Expense', account_subtype: 'Cost of Goods Sold' },
    { name: 'Operating Expenses', account_type: 'Expense', children: [
      { name: 'Advertising and Marketing', account_type: 'Expense', account_subtype: 'Advertising' },
      { name: 'Bank Fees', account_type: 'Expense', account_subtype: 'Expense' },
      { name: 'Insurance', account_type: 'Expense', account_subtype: 'Insurance' },
      { name: 'Office Supplies', account_type: 'Expense', account_subtype: 'Office Supplies' },
      { name: 'Payroll Expenses', account_type: 'Expense', account_subtype: 'Salaries' },
      { name: 'Rent Expense', account_type: 'Expense', account_subtype: 'Rent' },
      { name: 'Utilities', account_type: 'Expense', account_subtype: 'Utilities' },
      { name: 'Software and Subscriptions', account_type: 'Expense', account_subtype: 'Software' },
      { name: 'Repairs and Maintenance', account_type: 'Expense', account_subtype: 'Expense' },
    ]},
  ]},
];