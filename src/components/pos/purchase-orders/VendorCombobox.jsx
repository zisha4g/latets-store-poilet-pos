import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, Building2, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'sp_recent_vendor_ids';
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

const scoreMatch = (vendor, query, normalizedPhone) => {
  if (!query) return 0;
  const name = (vendor.name || '').toLowerCase();
  const contact = (vendor.contact_person || '').toLowerCase();
  const email = (vendor.email || '').toLowerCase();
  const phone = normalizePhone(vendor.phone);

  if (name.startsWith(query)) return 100;
  if (normalizedPhone && phone.startsWith(normalizedPhone)) return 95;
  if (email.startsWith(query)) return 90;
  if (contact.startsWith(query)) return 85;
  if (name.includes(query)) return 60;
  if (contact.includes(query)) return 55;
  if (normalizedPhone && phone.includes(normalizedPhone)) return 50;
  if (email.includes(query)) return 45;
  return 0;
};

export const VendorCombobox = ({
  vendors = [],
  value,
  onChange,
  onAddNew,
  placeholder = 'Select a vendor…',
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 120);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setActiveIndex(0); }, [debounced, open]);

  const vendorMap = useMemo(
    () => new Map((vendors || []).map((v) => [v.id, v])),
    [vendors],
  );

  const selected = value ? vendorMap.get(value) : null;

  const recentVendors = useMemo(() => {
    const ids = readRecent();
    return ids.map((id) => vendorMap.get(id)).filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorMap, open]);

  const filtered = useMemo(() => {
    const q = debounced;
    const phoneQ = normalizePhone(q);
    if (!q) return [];
    const scored = (vendors || [])
      .map((v) => ({ v, score: scoreMatch(v, q, phoneQ) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    return scored.map((x) => x.v);
  }, [vendors, debounced]);

  const itemsToRender = useMemo(() => {
    if (debounced) return filtered;
    if (recentVendors.length > 0) return recentVendors;
    return (vendors || []).slice(0, 30);
  }, [debounced, filtered, recentVendors, vendors]);

  const select = (id) => {
    onChange?.(id);
    pushRecent(id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    const len = itemsToRender.length;
    const totalLen = onAddNew ? len + 1 : len;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, totalLen - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex < len) {
        select(itemsToRender[activeIndex].id);
      } else if (onAddNew) {
        setOpen(false);
        onAddNew(query);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
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
            <Building2 className="h-4 w-4 opacity-50 shrink-0" />
            <span className="truncate">
              {selected ? (
                <>
                  {selected.name}
                  {selected.contact_person ? <span className="text-muted-foreground"> · {selected.contact_person}</span> : null}
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
            placeholder="Search by name, contact, phone, email…"
            className="h-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1" role="listbox">
          {!debounced && recentVendors.length > 0 && (
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent</div>
          )}
          {itemsToRender.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {debounced ? 'No vendors match.' : 'No vendors yet.'}
            </div>
          )}
          {itemsToRender.map((v, i) => {
            const active = i === activeIndex;
            const isSelected = value === v.id;
            return (
              <button
                key={v.id}
                role="option"
                aria-selected={isSelected}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(v.id)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-sm',
                  active && 'bg-accent text-accent-foreground',
                )}
              >
                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{v.name || 'Unnamed vendor'}</div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {v.contact_person && <span className="truncate">{v.contact_person}</span>}
                    {v.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</span>}
                    {v.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{v.email}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {onAddNew && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => { setOpen(false); onAddNew(query); }}
              onMouseEnter={() => setActiveIndex(itemsToRender.length)}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm',
                activeIndex === itemsToRender.length && 'bg-accent text-accent-foreground',
              )}
            >
              <Plus className="h-4 w-4" />
              <span>Add new vendor{query ? <> &ldquo;{query}&rdquo;</> : null}</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default VendorCombobox;
