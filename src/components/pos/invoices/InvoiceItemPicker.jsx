import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Plus, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { formatMoney } from '@/lib/money';

const scoreProduct = (p, q) => {
  if (!q) return 0;
  const name = (p.name || '').toLowerCase();
  const sku = (p.sku || '').toLowerCase();
  const barcode = (p.barcode || '').toLowerCase();
  const category = (p.category || '').toLowerCase();
  if (barcode === q || sku === q) return 200;
  if (name.startsWith(q)) return 100;
  if (sku.startsWith(q)) return 95;
  if (barcode.startsWith(q)) return 90;
  if (name.includes(q)) return 60;
  if (sku.includes(q) || barcode.includes(q)) return 50;
  if (category.includes(q)) return 30;
  return 0;
};

/**
 * Compact item search that pushes selected products onto an invoice.
 * Designed for keyboard-heavy + barcode-scanner workflow:
 *   - Focus stays in the input after each add (rapid scanning).
 *   - Barcode-style fast keystrokes auto-submit the top match.
 *   - Enter on a query selects the highlighted result.
 */
export const InvoiceItemPicker = ({ products = [], onAddItem, currency = 'USD', defaultTaxRate = 0, defaultTaxId = null }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const scanner = useBarcodeScanner();

  const productMap = useMemo(
    () => new Map((products || []).map((p) => [p.id, p])),
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = (products || [])
      .map((p) => ({ p, score: scoreProduct(p, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return scored.map((x) => x.p);
  }, [products, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Auto-add on barcode scan (fast keystrokes + exact match)
  useEffect(() => {
    if (!query) return;
    const lower = query.trim().toLowerCase();
    const exact = (products || []).find((p) => {
      const sku = String(p.sku || '').toLowerCase();
      const barcode = String(p.barcode || '').toLowerCase();
      return barcode === lower || sku === lower;
    });
    if (exact && (scanner.isScanned() || /^\d{6,}$/.test(lower))) {
      const t = setTimeout(() => addProduct(exact), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, products]);

  const addProduct = (product) => {
    if (!product) return;
    const item = {
      product_id: product.id,
      name: product.name || 'Item',
      sku: product.sku || null,
      quantity: 1,
      price: Number(product.price) || 0,
      tax_rate: Number(product.tax_rate ?? defaultTaxRate) || 0,
      tax_id: product.tax_id ?? defaultTaxId,
      discount_type: 'none',
      discount_value: 0,
    };
    onAddItem?.(item);
    setQuery('');
    scanner.reset();
    inputRef.current?.focus();
  };

  const addBlankItem = () => {
    onAddItem?.({
      product_id: null,
      name: query.trim() || '',
      quantity: 1,
      price: 0,
      tax_rate: defaultTaxRate || 0,
      tax_id: defaultTaxId,
      discount_type: 'none',
      discount_value: 0,
    });
    setQuery('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) addProduct(filtered[activeIndex]);
      else if (query.trim()) addBlankItem();
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { scanner.recordKeystroke(); setQuery(e.target.value); }}
          onKeyDown={onKeyDown}
          placeholder="Search items by name, SKU, or barcode — press Enter to add"
          className="pl-9"
          aria-label="Add invoice item"
          autoComplete="off"
        />
      </div>
      {query && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <button
              type="button"
              onClick={addBlankItem}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              Add custom item &ldquo;{query}&rdquo;
            </button>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {filtered.map((p, i) => {
                const active = i === activeIndex;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => addProduct(p)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        active && 'bg-accent text-accent-foreground',
                      )}
                    >
                      <Package className="h-4 w-4 opacity-60 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku ? <span>SKU {p.sku}</span> : null}
                          {p.sku && p.barcode ? <span> · </span> : null}
                          {p.barcode ? <span>#{p.barcode}</span> : null}
                        </div>
                      </div>
                      <div className="ml-2 text-sm font-medium tabular-nums">
                        {formatMoney(p.price, currency)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoiceItemPicker;
