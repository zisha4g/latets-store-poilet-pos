import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, User, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import QuickCreateCustomerDialog from './QuickCreateCustomerDialog';

const RECENT_KEY = 'sp_recent_customer_ids';
const RECENT_MAX = 3;

const readRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
};
const writeRecent = (ids) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX))); }
  catch { /* ignore */ }
};
const pushRecent = (id) => {
  if (!id) return;
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
  writeRecent(next);
};

const normalizePhone = (s) => String(s || '').replace(/[^\d]/g, '');

const scoreMatch = (customer, query, normalizedPhone) => {
  if (!query) return 0;
  const name = (customer.name || '').toLowerCase();
  const email = (customer.email || '').toLowerCase();
  const phone = normalizePhone(customer.phone);
  const taxId = (customer.tax_id || '').toLowerCase();

  if (name.startsWith(query)) return 100;
  if (normalizedPhone && phone.startsWith(normalizedPhone)) return 95;
  if (email.startsWith(query)) return 90;
  if (name.includes(query)) return 60;
  if (normalizedPhone && phone.includes(normalizedPhone)) return 55;
  if (email.includes(query)) return 50;
  if (taxId.includes(query)) return 40;
  return 0;
};

export const CustomerCombobox = ({
  customers = [],
  value,
  onChange,
  handlers,
  placeholder = 'Select a customer…',
  disabled = false,
  className,
  autoFocus = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 120);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setActiveIndex(0); }, [debounced, open]);

  const customerMap = useMemo(
    () => new Map((customers || []).map((c) => [c.id, c])),
    [customers],
  );

  const selected = value ? customerMap.get(value) : null;

  const recentCustomers = useMemo(() => {
    const ids = readRecent();
    return ids.map((id) => customerMap.get(id)).filter(Boolean);
  }, [customerMap, open]);

  const filtered = useMemo(() => {
    const q = debounced;
    const phoneQ = normalizePhone(q);
    if (!q) return [];
    const scored = (customers || [])
      .map((c) => ({ c, score: scoreMatch(c, q, phoneQ) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    return scored.map((x) => x.c);
  }, [customers, debounced]);

  const itemsToRender = useMemo(() => {
    if (debounced) return filtered;
    return recentCustomers;
  }, [debounced, filtered, recentCustomers]);

  const select = (id) => {
    onChange?.(id);
    pushRecent(id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    const len = itemsToRender.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, len)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex < len) {
        select(itemsToRender[activeIndex].id);
      } else {
        setShowQuickCreate(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  useEffect(() => {
    if (autoFocus && open) {
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [autoFocus, open]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('w-full justify-between font-normal', className)}
          >
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 opacity-50 shrink-0" />
              <span className="truncate">
                {selected ? (
                  <>
                    {selected.name}
                    {selected.phone ? <span className="text-muted-foreground"> · {selected.phone}</span> : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">{placeholder}</span>
                )}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="border-b p-2">
            <Input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search by name, phone, email…"
              className="h-9"
            />
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1" role="listbox">
            {!debounced && recentCustomers.length > 0 && (
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent</div>
            )}
            {itemsToRender.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {debounced ? 'No customers match.' : 'Start typing to search.'}
              </div>
            )}
            {itemsToRender.map((c, i) => {
              const active = i === activeIndex;
              const isSelected = value === c.id;
              return (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(c.id)}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-sm',
                    active && 'bg-accent text-accent-foreground',
                  )}
                >
                  <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name || 'Unnamed customer'}</div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{c.email}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {handlers?.customers?.add && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => setShowQuickCreate(true)}
                onMouseEnter={() => setActiveIndex(itemsToRender.length)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm',
                  activeIndex === itemsToRender.length && 'bg-accent text-accent-foreground',
                )}
              >
                <Plus className="h-4 w-4" />
                <span>Create new customer{query ? <> &ldquo;{query}&rdquo;</> : null}</span>
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <QuickCreateCustomerDialog
        isOpen={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        defaultName={query}
        handlers={handlers}
        onCreated={(c) => {
          if (c?.id) select(c.id);
        }}
      />
    </>
  );
};

export default CustomerCombobox;
