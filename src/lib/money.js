// Centralized currency / money utilities. All invoice totals, line items,
// and PDF output should pass through these helpers so that:
//   - Rounding happens in one place (banker's rounding to currency precision).
//   - Display formatting respects locale + currency.
//   - Parsing user input is forgiving but never returns NaN.
//
// Currency precision falls back to 2 decimals when the runtime can't resolve it.

const CURRENCY_FRACTION_CACHE = new Map();

const fractionDigitsFor = (currency) => {
  const code = (currency || 'USD').toUpperCase();
  if (CURRENCY_FRACTION_CACHE.has(code)) return CURRENCY_FRACTION_CACHE.get(code);
  let digits = 2;
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions();
    digits = typeof parts.maximumFractionDigits === 'number' ? parts.maximumFractionDigits : 2;
  } catch {
    digits = 2;
  }
  CURRENCY_FRACTION_CACHE.set(code, digits);
  return digits;
};

/** Banker's rounding (round half to even) at the given precision. */
export const roundMoney = (amount, currency = 'USD') => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const digits = fractionDigitsFor(currency);
  const factor = 10 ** digits;
  const scaled = n * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let rounded;
  if (diff > 0.5) rounded = floor + 1;
  else if (diff < 0.5) rounded = floor;
  else rounded = floor % 2 === 0 ? floor : floor + 1;
  return rounded / factor;
};

/** Return the localized currency symbol (e.g. "$", "€", "₪"). */
const SYMBOL_CACHE = new Map();
export const currencySymbol = (currency = 'USD', locale = undefined) => {
  const code = (currency || 'USD').toUpperCase();
  const key = `${locale || ''}|${code}`;
  if (SYMBOL_CACHE.has(key)) return SYMBOL_CACHE.get(key);
  let sym = code;
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: code }).formatToParts(0);
    const found = parts.find((p) => p.type === 'currency');
    if (found?.value) sym = found.value;
  } catch { /* fall back to code */ }
  SYMBOL_CACHE.set(key, sym);
  return sym;
};

/** Format a numeric amount for display. */
export const formatMoney = (amount, currency = 'USD', locale = undefined) => {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
    }).format(safe);
  } catch {
    return `${(currency || 'USD').toUpperCase()} ${safe.toFixed(2)}`;
  }
};

/**
 * Parse a user-typed money string. Accepts things like:
 *   "$1,234.56", "1.234,56" (eu), "  -12.5 ", "1e3"
 * Always returns a finite number (0 if unparseable).
 */
export const parseMoney = (input) => {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  const raw = String(input).trim();
  if (!raw) return 0;
  // Strip everything that isn't a digit, separator, sign, or exponent marker.
  const cleaned = raw.replace(/[^\d.,\-+eE]/g, '');
  if (!cleaned) return 0;
  // Heuristic: if both `.` and `,` appear, treat the last one as the decimal.
  let normalized = cleaned;
  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    normalized = normalized.replace(/,/g, '.');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Compute invoice totals from a normalized line-item array.
 *
 * Discount + tax order of operations:
 *   line_subtotal       = qty * unit_price
 *   line_discount_amt   = (% * line_subtotal) | fixed
 *   line_taxable        = line_subtotal - line_discount_amt
 *   line_tax            = line_taxable * (line_tax_rate / 100)
 *   line_total          = line_taxable + line_tax
 *
 *   subtotal            = sum(line_subtotal)
 *   line_discount_total = sum(line_discount_amt)
 *   tax_total           = sum(line_tax)
 *   pre_invoice_total   = sum(line_total)
 *   invoice_discount    = invoice-level discount (applied AFTER lines)
 *   total               = pre_invoice_total - invoice_discount
 */
export const computeInvoiceTotals = ({ items = [], discount = { type: 'none', value: 0 }, currency = 'USD' } = {}) => {
  const lines = items.map((raw) => {
    const qty = Math.max(0, Number(raw.quantity) || 0);
    const price = Math.max(0, Number(raw.price) || 0);
    const lineSubtotal = roundMoney(qty * price, currency);

    const dType = raw.discount_type || 'none';
    const dValue = Math.max(0, Number(raw.discount_value) || 0);
    let lineDiscount = 0;
    if (dType === 'percent') lineDiscount = roundMoney(lineSubtotal * (dValue / 100), currency);
    else if (dType === 'fixed') lineDiscount = Math.min(lineSubtotal, roundMoney(dValue, currency));

    const taxable = roundMoney(lineSubtotal - lineDiscount, currency);
    const taxRate = Math.max(0, Number(raw.tax_rate) || 0);
    const lineTax = roundMoney(taxable * (taxRate / 100), currency);
    const lineTotal = roundMoney(taxable + lineTax, currency);

    return {
      ...raw,
      quantity: qty,
      price,
      discount_type: dType,
      discount_value: dValue,
      discount_amount: lineDiscount,
      tax_rate: taxRate,
      tax_amount: lineTax,
      line_subtotal: lineSubtotal,
      total: lineTotal,
    };
  });

  const subtotal = roundMoney(lines.reduce((s, l) => s + l.line_subtotal, 0), currency);
  const lineDiscountTotal = roundMoney(lines.reduce((s, l) => s + l.discount_amount, 0), currency);
  const taxTotal = roundMoney(lines.reduce((s, l) => s + l.tax_amount, 0), currency);
  const preInvoiceTotal = roundMoney(lines.reduce((s, l) => s + l.total, 0), currency);

  const dType = discount?.type || 'none';
  const dValue = Math.max(0, Number(discount?.value) || 0);
  let invoiceDiscount = 0;
  if (dType === 'percent') invoiceDiscount = roundMoney(preInvoiceTotal * (dValue / 100), currency);
  else if (dType === 'fixed') invoiceDiscount = Math.min(preInvoiceTotal, roundMoney(dValue, currency));

  const total = roundMoney(Math.max(0, preInvoiceTotal - invoiceDiscount), currency);
  const totalDiscount = roundMoney(lineDiscountTotal + invoiceDiscount, currency);

  return {
    items: lines,
    subtotal,
    line_discount_total: lineDiscountTotal,
    invoice_discount_amount: invoiceDiscount,
    total_discount: totalDiscount,
    tax_amount: taxTotal,
    total,
  };
};

/** Currencies offered in the picker. Extend via app settings later. */
export const COMMON_CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'ILS', label: 'Israeli New Shekel' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
];
