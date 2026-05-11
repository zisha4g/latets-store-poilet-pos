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
 * Searchable product picker tailored to Purchase Orders:
 *   - Surfaces SKU, barcode, category, on-hand stock and cost price.
 *   - Autocompletes barcode scans (Enter or fast-keystroke heuristic).
 *   - Disabled state freezes the picker without unmounting it.
 */
export const PurchaseOrderItemPicker = ({
  products = [],
  onAddItem,
  onAddNew,
  disabled = false,
  currency = 'USD',
  selectedProductIds = [],
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const scanner = useBarcodeScanner();

  const selectedSet = useMemo(() => new Set(selectedProductIds || []), [selectedProductIds]);

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

  // Close suggestion panel on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const addProduct = (product) => {
    if (!product) return;
    onAddItem?.(product);
    setQuery('');
    scanner.reset();
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
      else if (query.trim() && onAddNew) onAddNew(query.trim());
    } else if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { scanner.recordKeystroke(); setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products by name, SKU, or barcode — press Enter to add"
          className="pl-9"
          aria-label="Add purchase order item"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      {open && query && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            onAddNew ? (
              <button
                type="button"
                onClick={() => { onAddNew(query.trim()); setQuery(''); }}
                className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Create new product &ldquo;{query}&rdquo;
              </button>
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground">No products match.</div>
            )
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {filtered.map((p, i) => {
                const active = i === activeIndex;
                const already = selectedSet.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => addProduct(p)}
                      disabled={already}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        active && 'bg-accent text-accent-foreground',
                        already && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <Package className="h-4 w-4 opacity-60 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {p.name}
                          {already && <span className="ml-2 text-xs text-muted-foreground">(already added)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.sku ? <span>SKU {p.sku}</span> : null}
                          {p.sku && p.barcode ? <span> · </span> : null}
                          {p.barcode ? <span>#{p.barcode}</span> : null}
                          {(p.sku || p.barcode) && p.stock != null ? <span> · </span> : null}
                          {p.stock != null ? <span>{p.stock} on hand</span> : null}
                        </div>
                      </div>
                      <div className="ml-2 text-sm font-medium tabular-nums">
                        {formatMoney(p.cost_price || 0, currency)}
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

export default PurchaseOrderItemPicker;
