/**
 * Build a CSV string from rows + a header definition.
 * Each header item is { key, label } where `key` indexes into the row object.
 *
 *   const csv = toCsv(invoices, [
 *     { key: 'invoice_number', label: 'Invoice #' },
 *     { key: 'total', label: 'Total' },
 *   ]);
 *   downloadCsv('invoices.csv', csv);
 */
const escape = (value) => {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const toCsv = (rows, headers) => {
  const headerLine = headers.map((h) => escape(h.label)).join(',');
  const lines = (rows || []).map((row) =>
    headers.map((h) => {
      const v = typeof h.value === 'function' ? h.value(row) : row[h.key];
      return escape(v);
    }).join(','),
  );
  return [headerLine, ...lines].join('\r\n');
};

export const downloadCsv = (filename, csv) => {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
