import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Search, PlusCircle, UserPlus, User } from 'lucide-react';

const isPhoneNumber = (val) => /^\d{7}$|^\d{10}$/.test(val);

const ProductSearch = forwardRef(
  ({ products, searchValue, setSearchValue, onAddToCart, onAddNewProduct, onCustomerFound, onAddNewCustomer, findCustomerByPhone }, ref) => {
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);
    const autoEnterTimer = useRef(null);
    const isScannedInput = useRef(false);
    const [customerMatch, setCustomerMatch] = useState(null);
    const [customerSearching, setCustomerSearching] = useState(false);

    // Scanner speed detection — track keystroke timing
    const keystrokeTimestamps = useRef([]);
    const SCANNER_SPEED_THRESHOLD = 80; // ms between keystrokes — scanners are <50ms, humans >100ms

    const checkIfScanned = (value) => {
      const times = keystrokeTimestamps.current;
      if (times.length >= 3) {
        const avgGap = (times[times.length - 1] - times[0]) / (times.length - 1);
        isScannedInput.current = avgGap < SCANNER_SPEED_THRESHOLD;
      } else {
        isScannedInput.current = false;
      }
      return isScannedInput.current;
    };

    // Monitor searchValue changes and auto-enter after delay (barcode scanner)
    useEffect(() => {
      const value = (searchValue || '').trim();
      const isAllDigits = /^\d+$/.test(value);
      const couldBePhone = isAllDigits && value.length <= 10;
      const normalizedValue = value.toLowerCase();
      const hasExactProductMatch = products.some((p) => {
        const barcode = String(p.barcode || '').toLowerCase();
        const sku = String(p.sku || '').toLowerCase();
        return barcode === normalizedValue || sku === normalizedValue;
      });

      if (!value || value.length < BARCODE_MIN_LENGTH) {
        if (autoEnterTimer.current) clearTimeout(autoEnterTimer.current);
        return;
      }

      if (hasExactProductMatch && !couldBePhone) {
        // Always auto-enter exact product scans, including alphanumeric SKUs.
        if (autoEnterTimer.current) clearTimeout(autoEnterTimer.current);
        autoEnterTimer.current = setTimeout(() => {
          autoEnter(value);
        }, 180);
      } else if (isScannedInput.current && !couldBePhone) {
        // Fast scanner-like input should auto-enter even when not numeric.
        if (autoEnterTimer.current) clearTimeout(autoEnterTimer.current);
        autoEnterTimer.current = setTimeout(() => {
          autoEnter(value);
        }, 220);
      } else if (!isScannedInput.current && isAllDigits && value.length > 10) {
        // Manual input but clearly not a phone number — auto-enter.
        if (autoEnterTimer.current) clearTimeout(autoEnterTimer.current);
        autoEnterTimer.current = setTimeout(() => {
          autoEnter(value);
        }, 300);
      }

      return () => {
        if (autoEnterTimer.current) clearTimeout(autoEnterTimer.current);
      };
    }, [searchValue, products]);

    const popoverRef = useRef(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const itemsRef = useRef([]);
    const addNewProductRef = useRef(null);

    // Customer search when phone number detected
    useEffect(() => {
      if (!findCustomerByPhone || !isPhoneNumber(searchValue.trim())) {
        setCustomerMatch(null);
        return;
      }
      setCustomerSearching(true);
      const timer = setTimeout(async () => {
        const result = await findCustomerByPhone(searchValue.trim());
        setCustomerMatch(result);
        setCustomerSearching(false);
      }, 300);
      return () => { clearTimeout(timer); setCustomerSearching(false); };
    }, [searchValue, findCustomerByPhone]);


    // --- Barcode auto-enter state ---
    const lastBarcodeValue = useRef('');
    const BARCODE_MIN_LENGTH = 4;

    // --- Auto-enter on input or scan ---
    const handleInput = (e) => {
      const value = e.target.value;
      keystrokeTimestamps.current.push(Date.now());
      if (keystrokeTimestamps.current.length > 10) keystrokeTimestamps.current.shift();
      setSearchValue(value);
      checkIfScanned(value);
    };

    // ------------------ AUTO ENTER ------------------
    const autoEnter = async (value) => {
      const normalizedValue = String(value || '').trim().toLowerCase();
      const exactMatch = products.find(p =>
        String(p.barcode || '').toLowerCase() === normalizedValue ||
        String(p.sku || '').toLowerCase() === normalizedValue
      );
      if (exactMatch) {
        handleProductSelect(exactMatch);
      } else if (filteredProducts.length === 1) {
        handleProductSelect(filteredProducts[0]);
      } else if (filteredProducts.length > 0 && filteredProducts[selectedIndex]) {
        handleProductSelect(filteredProducts[selectedIndex]);
      } else if (isPhoneNumber(value) && findCustomerByPhone) {
        // Phone number with no product match — search customer and auto-attach
        const result = await findCustomerByPhone(value);
        if (result && !result.multiple && onCustomerFound) {
          onCustomerFound(result);
          setOpen(false);
          setSelectedIndex(0);
          setSearchValue('');
          setCustomerMatch(null);
          return;
        } else if (result?.multiple && result.matches.length > 0 && onCustomerFound) {
          onCustomerFound(result.matches[0]);
          setOpen(false);
          setSelectedIndex(0);
          setSearchValue('');
          setCustomerMatch(null);
          return;
        }
        // No customer found either — fall through to add new
        if (onAddNewProduct) {
          onAddNewProduct(value);
          setOpen(false);
          setSelectedIndex(0);
        }
      } else if (value.length > 0 && onAddNewProduct) {
        onAddNewProduct(value);
        setOpen(false);
        setSelectedIndex(0);
      }
      setSearchValue('');
    };

    const filteredProducts = products
      .filter((p) =>
        searchValue.trim() !== '' &&
        (
          p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
          (p.barcode && String(p.barcode).includes(searchValue)) ||
          (p.sku && String(p.sku).toLowerCase().includes(searchValue.toLowerCase()))
        )
      )
      .sort((a, b) => {
        const normalizedSearch = String(searchValue || '').toLowerCase();
        const aExact = String(a.barcode || '').toLowerCase() === normalizedSearch || String(a.sku || '').toLowerCase() === normalizedSearch;
        const bExact = String(b.barcode || '').toLowerCase() === normalizedSearch || String(b.sku || '').toLowerCase() === normalizedSearch;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });

    useEffect(() => { itemsRef.current = []; }, [filteredProducts]);

    useEffect(() => {
      if (searchValue.trim().length > 0) {
        if (!open) setOpen(true);
      } else {
        if (open) setOpen(false);
      }
    }, [searchValue, open]);

    useEffect(() => {
      if (filteredProducts.length > 0 && selectedIndex >= filteredProducts.length) {
        setSelectedIndex(0);
      }
    }, [filteredProducts]);

    useEffect(() => {
      if (open && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, [open]);

    const handleProductSelect = (product) => {
      if (product) {
        onAddToCart(product);
        setOpen(false);
        setSearchValue('');
        setSelectedIndex(0);
        keystrokeTimestamps.current = [];
      }
    };

    // ------------------ HANDLERS ------------------

    const handlePaste = (e) => {
      const pasted = e.clipboardData.getData('Text');
      setTimeout(() => autoEnter(pasted.trim()), 0);
    };

    const handleFocus = () => { 
      setOpen(true);
    };
    const handleBlur = () => {
      setTimeout(() => {
        if (
          document.activeElement !== inputRef.current &&
          (!popoverRef.current || !popoverRef.current.contains(document.activeElement))
        ) {
          setOpen(false);
        }
      }, 200);
    };

    const handleParentClick = () => { if (inputRef.current) inputRef.current.focus(); };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Clear any pending auto-enter and force React state update
        if (autoEnterTimer.current) clearTimeout(autoEnterTimer.current);
        const nativeValue = inputRef.current ? inputRef.current.value.trim() : e.target.value.trim();
        // Trigger auto-enter immediately
        autoEnter(nativeValue);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        if (filteredProducts.length > 0) setSelectedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        setSearchValue('');
      }
    };

  // ------------------ RENDER ------------------
    
    return (
      <Popover open={open} onOpenChange={(newOpen) => {
        setOpen(newOpen);
      }}>
        <PopoverTrigger asChild>
          <div className="relative" onClick={handleParentClick}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              ref={(node) => { inputRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }}
              placeholder="Scan barcode or search for a product..."
              className="w-full pl-10 pr-4 py-3 text-lg rounded-lg"
              value={searchValue}
              onInput={handleInput}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="product-search-list"
              role="combobox"
              aria-expanded={open}
              aria-activedescendant={open && filteredProducts[selectedIndex] ? `product-item-${filteredProducts[selectedIndex].id}` : undefined}
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          ref={popoverRef}
          className="w-[--radix-popover-trigger-width] p-0"
          side="top"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div id="product-search-list" role="listbox" className="text-gray-800 max-h-96 overflow-y-auto">
            {filteredProducts.length === 0 && searchValue.length > 0 ? (
              <div className="text-center py-4 px-4 space-y-3">
                <p className="mb-2">No product found for "{searchValue}".</p>

                {/* Customer match */}
                {customerMatch && !customerMatch.multiple && onCustomerFound && (
                  <div
                    onClick={() => {
                      onCustomerFound(customerMatch);
                      setSearchValue('');
                      setOpen(false);
                      setCustomerMatch(null);
                    }}
                    className="cursor-pointer hover:bg-accent flex items-center justify-center py-2 px-3 rounded border border-green-300 bg-green-50 text-green-900 font-medium transition-colors"
                    style={{ boxShadow: '0 0 0 1px #86efac' }}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Attach customer: {customerMatch.name} ({customerMatch.phone})
                  </div>
                )}
                {customerMatch?.multiple && onCustomerFound && customerMatch.matches.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onCustomerFound(c);
                      setSearchValue('');
                      setOpen(false);
                      setCustomerMatch(null);
                    }}
                    className="cursor-pointer hover:bg-accent flex items-center justify-center py-2 px-3 rounded border border-green-300 bg-green-50 text-green-900 font-medium transition-colors"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Attach: {c.name} ({c.phone})
                  </div>
                ))}

                {/* Add as new customer (phone numbers only) */}
                {isPhoneNumber(searchValue.trim()) && !customerMatch && !customerSearching && onAddNewCustomer && (
                  <div
                    onClick={() => {
                      onAddNewCustomer(searchValue.trim());
                      setSearchValue('');
                      setOpen(false);
                    }}
                    className="cursor-pointer hover:bg-accent flex items-center justify-center py-2 px-3 rounded border transition-colors border-transparent hover:border-blue-300"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add "{searchValue}" as new customer
                  </div>
                )}

                {onAddNewProduct && (
                  <div
                    onClick={() => {
                      onAddNewProduct(searchValue);
                      setSearchValue('');
                      setOpen(false);
                      setSelectedIndex(0);
                    }}
                    onMouseEnter={() => setSelectedIndex(0)}
                    className={`cursor-pointer hover:bg-accent flex items-center justify-center py-2 px-3 rounded border transition-colors ${selectedIndex===0?'bg-blue-100 text-blue-900 font-medium border-blue-300':'border-transparent'}`}
                    style={selectedIndex===0 ? { boxShadow:'0 0 0 1px #93c5fd'} : {}}
                    role="option"
                    aria-selected={selectedIndex===0}
                    tabIndex={0}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add "{searchValue}" as new product
                  </div>
                )}
              </div>
            ) : (
              <div>
                {(() => {
                  return filteredProducts.slice(0, 10).map((product, idx) => {
                    return (
                      <div
                        key={product.id}
                        id={`product-item-${product.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleProductSelect(product);
                        }}
                        onMouseEnter={() => {
                          setSelectedIndex(idx);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleProductSelect(product);
                        }}
                        className={`px-4 py-2 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                          selectedIndex === idx 
                            ? 'bg-blue-100 text-blue-900 font-medium' 
                            : 'hover:bg-gray-50'
                        }`}
                        style={selectedIndex === idx ? { boxShadow:'inset 0 0 0 1px #93c5fd'} : {}}
                        role="option"
                        aria-selected={selectedIndex === idx}
                        tabIndex={0}
                      >
                        <div className="flex justify-between w-full items-center">
                          <span>{product.name} {product.sku?`(#${product.sku})`:''}</span>
                          <span className="text-muted-foreground text-sm ml-4">${product.price.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);

ProductSearch.displayName = 'ProductSearch';
export default ProductSearch;
