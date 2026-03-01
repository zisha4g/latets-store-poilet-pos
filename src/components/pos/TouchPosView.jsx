import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, ShoppingCart, CreditCard, Receipt, Save, UserPlus, Edit,
  Percent, Trash2, Plus, Minus, X, Phone, SkipForward, Archive,
  User, Mail, Home, Delete, CornerDownLeft, ArrowBigUp, ChevronLeft
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import QuickAmountTiles from './pos-components/QuickAmountTiles';
import CheckoutModal from './pos-components/CheckoutModal';
import CustomerDetailModal from './CustomerDetailModal';
import ProductDetailModal from './ProductDetailModal';
import AddCustomerModal from './pos-components/AddCustomerModal';
import SaveCartModal from './pos-components/SaveCartModal';
import DiscountModal from './pos-components/DiscountModal';
import AssignCustomerModal from './pos-components/AssignCustomerModal';
import PhoneOrderModal from './pos-components/PhoneOrderModal';
import { printDeliveryLabel } from '@/utils/deliveryLabel';

// ─── Touch-friendly Keyboard ────────────────────────────────────────────
// Self-contained keyboard built into the touch POS. Large keys for fingers.

const TOUCH_QWERTY = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
];

function TouchKeyboard({ onKey, onBackspace, onEnter, onDone, theme = 'dark' }) {
  const [shift, setShift] = useState(false);

  const themes = {
    dark: {
      bg: 'bg-gray-900',
      key: 'bg-gray-700 active:bg-gray-600 text-white',
      special: 'bg-gray-600 active:bg-gray-500 text-white',
      del: 'bg-red-600 active:bg-red-500 text-white',
      enter: 'bg-green-600 active:bg-green-500 text-white',
      done: 'bg-blue-600 active:bg-blue-500 text-white',
    },
    light: {
      bg: 'bg-gray-200',
      key: 'bg-white active:bg-gray-100 text-gray-900 border border-gray-300',
      special: 'bg-gray-300 active:bg-gray-400 text-gray-900',
      del: 'bg-red-500 active:bg-red-600 text-white',
      enter: 'bg-green-500 active:bg-green-600 text-white',
      done: 'bg-blue-500 active:bg-blue-600 text-white',
    },
    blue: {
      bg: 'bg-blue-900',
      key: 'bg-blue-800 active:bg-blue-700 text-white',
      special: 'bg-blue-700 active:bg-blue-600 text-white',
      del: 'bg-red-600 active:bg-red-500 text-white',
      enter: 'bg-cyan-600 active:bg-cyan-500 text-white',
      done: 'bg-blue-600 active:bg-blue-500 text-white',
    },
  };
  const t = themes[theme] || themes.dark;
  const kClass = `rounded-lg font-bold text-lg select-none touch-manipulation transition-colors duration-75`;

  const press = (k) => {
    onKey(shift ? k.toUpperCase() : k);
    if (shift) setShift(false);
  };

  return (
    <div className={`${t.bg} p-1.5 rounded-t-xl`} onMouseDown={e => e.preventDefault()} onTouchStart={e => { if (e.target.tagName !== 'BUTTON') e.preventDefault(); }}>
      <div className="flex gap-1.5">
        {/* QWERTY section */}
        <div className="flex-1 space-y-1">
          {/* Row 1: qwerty */}
          <div className="flex gap-1">
            {TOUCH_QWERTY[0].map(k => (
              <button key={k} onMouseDown={e => { e.preventDefault(); press(k); }} onTouchEnd={e => { e.preventDefault(); press(k); }} className={`flex-1 h-10 ${kClass} ${t.key}`}>{shift ? k.toUpperCase() : k}</button>
            ))}
          </div>
          {/* Row 2 */}
          <div className="flex gap-1 px-3">
            {TOUCH_QWERTY[1].map(k => (
              <button key={k} onMouseDown={e => { e.preventDefault(); press(k); }} onTouchEnd={e => { e.preventDefault(); press(k); }} className={`flex-1 h-10 ${kClass} ${t.key}`}>{shift ? k.toUpperCase() : k}</button>
            ))}
          </div>
          {/* Row 3 */}
          <div className="flex gap-1">
            <button onMouseDown={e => { e.preventDefault(); setShift(s => !s); }} onTouchEnd={e => { e.preventDefault(); setShift(s => !s); }} className={`h-10 w-14 ${kClass} ${shift ? t.enter : t.special}`}>
              <ArrowBigUp className="w-5 h-5 mx-auto" />
            </button>
            {TOUCH_QWERTY[2].map(k => (
              <button key={k} onMouseDown={e => { e.preventDefault(); press(k); }} onTouchEnd={e => { e.preventDefault(); press(k); }} className={`flex-1 h-10 ${kClass} ${t.key}`}>{shift ? k.toUpperCase() : k}</button>
            ))}
            <button onMouseDown={e => { e.preventDefault(); onBackspace(); }} onTouchEnd={e => { e.preventDefault(); onBackspace(); }} className={`h-10 w-16 ${kClass} ${t.del}`}>
              <Delete className="w-5 h-5 mx-auto" />
            </button>
          </div>
          {/* Row 4: space, symbols, enter, done */}
          <div className="flex gap-1">
            <button onMouseDown={e => { e.preventDefault(); press('.'); }} onTouchEnd={e => { e.preventDefault(); press('.'); }} className={`h-10 w-10 ${kClass} ${t.special}`}>.</button>
            <button onMouseDown={e => { e.preventDefault(); press(','); }} onTouchEnd={e => { e.preventDefault(); press(','); }} className={`h-10 w-10 ${kClass} ${t.special}`}>,</button>
            <button onMouseDown={e => { e.preventDefault(); press('@'); }} onTouchEnd={e => { e.preventDefault(); press('@'); }} className={`h-10 w-10 ${kClass} ${t.special}`}>@</button>
            <button onMouseDown={e => { e.preventDefault(); press('-'); }} onTouchEnd={e => { e.preventDefault(); press('-'); }} className={`h-10 w-10 ${kClass} ${t.special}`}>-</button>
            <button onMouseDown={e => { e.preventDefault(); press(' '); }} onTouchEnd={e => { e.preventDefault(); press(' '); }} className={`flex-1 h-10 ${kClass} ${t.special}`}>SPACE</button>
            <button onMouseDown={e => { e.preventDefault(); onEnter(); }} onTouchEnd={e => { e.preventDefault(); onEnter(); }} className={`h-10 w-20 ${kClass} ${t.enter}`}>
              <CornerDownLeft className="w-5 h-5 mx-auto" />
            </button>
            <button onMouseDown={e => { e.preventDefault(); onDone(); }} onTouchEnd={e => { e.preventDefault(); onDone(); }} className={`h-10 w-20 ${kClass} ${t.done}`}>Done</button>
          </div>
        </div>
        {/* Numpad side panel */}
        <div className="w-[200px] shrink-0 grid grid-cols-3 gap-1.5 content-end">
          {['7','8','9','4','5','6','1','2','3'].map(k => (
            <button key={`np-${k}`} onMouseDown={e => { e.preventDefault(); press(k); }} onTouchEnd={e => { e.preventDefault(); press(k); }} className={`h-12 text-lg ${kClass} ${t.key}`}>{k}</button>
          ))}
          <button onMouseDown={e => { e.preventDefault(); press('0'); }} onTouchEnd={e => { e.preventDefault(); press('0'); }} className={`h-12 text-lg ${kClass} ${t.key}`}>0</button>
          <button onMouseDown={e => { e.preventDefault(); press('.'); }} onTouchEnd={e => { e.preventDefault(); press('.'); }} className={`h-12 text-lg ${kClass} ${t.key}`}>.</button>
          <button onMouseDown={e => { e.preventDefault(); press('00'); }} onTouchEnd={e => { e.preventDefault(); press('00'); }} className={`h-12 text-lg ${kClass} ${t.key}`}>00</button>
        </div>
      </div>
    </div>
  );
}

// ─── Touch Numpad ────────────────────────────────────────────
function TouchNumpad({ onKey, onBackspace, onEnter, theme = 'dark', compact = false }) {
  const themes = {
    dark: { bg: 'bg-gray-900', key: 'bg-gray-700 active:bg-gray-600 text-white', del: 'bg-red-600 active:bg-red-500 text-white', enter: 'bg-green-600 active:bg-green-500 text-white' },
    light: { bg: 'bg-gray-200', key: 'bg-white active:bg-gray-100 text-gray-900 border border-gray-300', del: 'bg-red-500 active:bg-red-600 text-white', enter: 'bg-green-500 active:bg-green-600 text-white' },
    blue: { bg: 'bg-blue-900', key: 'bg-blue-800 active:bg-blue-700 text-white', del: 'bg-red-600 active:bg-red-500 text-white', enter: 'bg-cyan-600 active:bg-cyan-500 text-white' },
  };
  const t = themes[theme] || themes.dark;
  const kh = compact ? 'h-12' : 'h-16';
  const fontSize = compact ? 'text-xl' : 'text-2xl';
  const kClass = `rounded-xl font-bold ${fontSize} select-none touch-manipulation transition-colors duration-75`;

  const press = (k) => onKey(k);

  return (
    <div className={`${t.bg} p-2 rounded-xl grid grid-cols-3 gap-2 ${compact ? 'max-w-sm mx-auto' : ''}`} onMouseDown={e => e.preventDefault()}>
      {['7','8','9','4','5','6','1','2','3'].map(k => (
        <button key={k} onMouseDown={e => { e.preventDefault(); press(k); }} onTouchEnd={e => { e.preventDefault(); press(k); }} className={`${kh} ${kClass} ${t.key}`}>{k}</button>
      ))}
      <button onMouseDown={e => { e.preventDefault(); press('0'); }} onTouchEnd={e => { e.preventDefault(); press('0'); }} className={`${kh} ${kClass} ${t.key}`}>0</button>
      <button onMouseDown={e => { e.preventDefault(); press('.'); }} onTouchEnd={e => { e.preventDefault(); press('.'); }} className={`${kh} ${kClass} ${t.key}`}>.</button>
      <button onMouseDown={e => { e.preventDefault(); onBackspace(); }} onTouchEnd={e => { e.preventDefault(); onBackspace(); }} className={`${kh} ${kClass} ${t.del}`}>
        <Delete className="w-6 h-6 mx-auto" />
      </button>
      {onEnter && (
        <button onMouseDown={e => { e.preventDefault(); onEnter(); }} onTouchEnd={e => { e.preventDefault(); onEnter(); }} className={`${kh} col-span-3 ${kClass} ${t.enter}`}>
          <CornerDownLeft className="w-6 h-6 mx-auto" />
        </button>
      )}
    </div>
  );
}

// ─── Touch Cart Item ────────────────────────────────────────────
function TouchCartItem({ item, onUpdateQuantity, onToggleTaxable }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-primary">${(item.price * item.quantity).toFixed(2)}</span>
          <label className="flex items-center gap-0.5 text-[10px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={item.taxable !== false} onChange={() => onToggleTaxable(item.id)} className="h-3 w-3" />
            Tax
          </label>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center active:bg-secondary/80 touch-manipulation">
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center font-bold text-base">{item.quantity}</span>
        <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center active:bg-secondary/80 touch-manipulation">
          <Plus className="w-4 h-4" />
        </button>
        <button onClick={() => onUpdateQuantity(item.id, 0)} className="w-8 h-10 rounded-lg flex items-center justify-center text-destructive active:bg-destructive/10 touch-manipulation">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//   MAIN TOUCH POS VIEW
// ═══════════════════════════════════════════════════════════════════

const TouchPosView = ({ products, handlers, settings, savedCarts = [] }) => {
  // ─── State ──────────────────────────────────────────────────
  const [loadedCartId, setLoadedCartId] = useState(null);
  const [saleState, setSaleState] = useState({ stage: 'customer_lookup', customer: null, cart: [], discount: { type: 'none', value: 0 } });
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [isAddCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [isAssignCustomerModalOpen, setAssignCustomerModalOpen] = useState(false);
  const [isSaveCartModalOpen, setSaveCartModalOpen] = useState(false);
  const [isDiscountModalOpen, setDiscountModalOpen] = useState(false);
  const [isPhoneOrderModalOpen, setPhoneOrderModalOpen] = useState(false);
  const [phoneOrderDraft, setPhoneOrderDraft] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showSavedCarts, setShowSavedCarts] = useState(false);
  const searchInputRef = useRef(null);

  const [isAddProductModalOpen, setAddProductModalOpen] = useState(false);
  const [productNameToAdd, setProductNameToAdd] = useState('');
  const [addToLibrary, setAddToLibrary] = useState(true);

  const keyboardTheme = settings?.keyboardTheme?.value || 'dark';

  // ─── Cart logic (same as PosView) ──────────────────────────
  const defaultTax = useMemo(() => settings?.taxes?.find(tax => tax.is_default), [settings?.taxes]);

  const handleAddToCart = useCallback((product) => {
    if (product.isCustom) {
      setSaleState(prev => ({ ...prev, cart: [...prev.cart, { ...product, quantity: 1, id: `custom-${Date.now()}`, taxable: true }] }));
      return;
    }
    if (product.stock <= 0) {
      toast({ title: "Out of Stock", description: `${product.name} is currently unavailable.`, variant: "destructive" });
      return;
    }
    setSaleState(prev => {
      const existing = prev.cart.find(i => i.id === product.id);
      let newCart;
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ title: "Stock Limit", description: `Max ${product.stock} of ${product.name}.`, variant: "destructive" });
          return prev;
        }
        newCart = prev.cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        newCart = [...prev.cart, { ...product, quantity: 1, taxable: true }];
      }
      return { ...prev, cart: newCart };
    });
    setSearchValue('');
  }, []);

  const handleToggleItemTaxable = useCallback((id) => {
    setSaleState(prev => ({ ...prev, cart: prev.cart.map(i => i.id === id ? { ...i, taxable: !i.taxable } : i) }));
  }, []);

  const handleUpdateCartQuantity = useCallback((productId, newQuantity) => {
    setSaleState(prev => {
      let newCart;
      if (newQuantity <= 0) {
        newCart = prev.cart.filter(i => i.id !== productId);
      } else {
        const product = products.find(p => p.id === productId);
        if (product && !product.isCustom && newQuantity > product.stock) {
          toast({ title: "Stock Limit", variant: "destructive" });
          newCart = prev.cart.map(i => i.id === productId ? { ...i, quantity: product.stock } : i);
        } else {
          newCart = prev.cart.map(i => i.id === productId ? { ...i, quantity: newQuantity } : i);
        }
      }
      return { ...prev, cart: newCart };
    });
  }, [products]);

  const { subtotal, discountAmount, totalAfterDiscount, appliedTaxes, appliedServiceCharges, total } = useMemo(() => {
    const sub = saleState.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let discountAmt = 0;
    if (saleState.discount.type === 'percentage') discountAmt = sub * (saleState.discount.value / 100);
    else if (saleState.discount.type === 'fixed') discountAmt = saleState.discount.value;
    const totalAfterDisc = Math.max(0, sub - discountAmt);
    const taxes = handlers?.taxes?.getApplicable ? handlers.taxes.getApplicable(totalAfterDisc, saleState.cart) : [];
    const taxAmt = taxes.reduce((s, t) => s + t.amount, 0);
    const scs = handlers?.serviceCharges?.getApplicable ? handlers.serviceCharges.getApplicable(totalAfterDisc) : [];
    const scAmt = scs.reduce((s, sc) => s + sc.amount, 0);
    return { subtotal: sub, discountAmount: discountAmt, totalAfterDiscount: totalAfterDisc, appliedTaxes: taxes, appliedServiceCharges: scs, total: totalAfterDisc + taxAmt + scAmt };
  }, [saleState.cart, saleState.discount, handlers?.taxes, handlers?.serviceCharges]);

  // ─── Sale processing (same as PosView) ────────────────────
  const handleProcessSale = async (paymentDetails) => {
    const totalTaxAmount = appliedTaxes.reduce((s, t) => s + t.amount, 0);
    const totalServiceAmount = appliedServiceCharges.reduce((s, sc) => s + sc.amount, 0);
    const primaryTaxRate = appliedTaxes.length > 0 ? appliedTaxes[0].rate : 0;
    const saleData = {
      items: saleState.cart.map(item => ({
        product_id: item.product_id || item.id, quantity: item.quantity, price: item.price,
        name: item.name, cost_price: item.cost_price, sku: item.sku, isCustom: item.isCustom,
      })),
      total, subtotal,
      customer_id: saleState.customer?.id || null,
      payment_method: paymentDetails.paymentMethod,
      taxes: appliedTaxes.map(t => ({ name: t.name, rate: t.rate, amount: t.amount })),
      service_charges_applied: appliedServiceCharges.map(sc => ({ name: sc.name, type: sc.type, value: sc.value, amount: sc.amount })),
      tax_rate: primaryTaxRate, tax_amount: totalTaxAmount, service_charge: totalServiceAmount,
      timestamp: new Date().toISOString(),
    };
    try {
      const newSale = await handlers.sales.add(saleData);
      if (phoneOrderDraft?.address) {
        if (phoneOrderDraft.saveToProfile && saleState.customer?.id && handlers?.customers?.update)
          try { await handlers.customers.update({ ...saleState.customer, address: phoneOrderDraft.address }); } catch {}
        try {
          await handlers.deliveries.add({ sale_id: newSale.id, customer_id: saleState.customer?.id || null, address: phoneOrderDraft.address, instructions: phoneOrderDraft.instructions || '', status: 'pending' });
        } catch {}
        try { printDeliveryLabel({ order: newSale, customer: saleState.customer, address: phoneOrderDraft.address, instructions: phoneOrderDraft.instructions, items: newSale.items || saleState.cart }); } catch {}
      }
      if (loadedCartId) { await handlers.savedCarts.delete(loadedCartId); setLoadedCartId(null); }
      setLastSale(newSale);
      setSaleState({ ...saleState, stage: 'completed' });
      setPhoneOrderModalOpen(false); setPhoneOrderDraft(null); setCheckoutOpen(false);
      toast({ title: 'Sale Completed!', description: `Total: $${total.toFixed(2)}` });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveCart = async (cartData) => {
    try {
      await handlers.savedCarts.add({ customer_id: saleState.customer?.id || null, items: saleState.cart, total, name: cartData.name, notes: cartData.notes });
      toast({ title: "Cart Saved" }); setSaveCartModalOpen(false);
    } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const handleLoadSavedCart = (cart) => {
    const customer = cart.customer_id ? { id: cart.customer_id, name: cart.customers?.name || 'Unknown', phone: cart.customers?.phone || '' } : null;
    setSaleState({ stage: 'scanning', customer, cart: cart.items, discount: { type: 'none', value: 0 } });
    setLoadedCartId(cart.id); setShowSavedCarts(false);
  };

  const handleDeleteSavedCart = async (cartId) => {
    if (window.confirm("Delete this saved cart?")) {
      try { await handlers.savedCarts.delete(cartId); toast({ title: "Cart Deleted" }); } catch {}
    }
  };

  const handleAssignCustomerToSale = (customer) => {
    setSaleState(prev => ({ ...prev, customer }));
    toast({ title: "Customer Assigned", description: `${customer.name}` });
    setAssignCustomerModalOpen(false);
  };

  const handleAddCustomerToSale = async (customerData) => {
    try {
      const phoneDigits = (customerData.phone || '').replace(/\D/g, '');
      if (phoneDigits) {
        const found = await handlers.customers.findByPhone(phoneDigits);
        let matches = [];
        if (found) {
          matches = found.multiple ? found.matches : [found];
          matches = matches.filter(m => (m.phone || '').replace(/\D/g, '') === phoneDigits);
        }
        if (matches.length > 0) {
          if (window.confirm(`Customer exists: ${matches[0].name}. Use existing?`)) {
            handleAssignCustomerToSale(matches[0]); setAddCustomerModalOpen(false); return;
          }
        }
      }
      const newCustomer = await handlers.customers.add(customerData);
      handleAssignCustomerToSale(newCustomer); setAddCustomerModalOpen(false);
    } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const handleAddNewProduct = useCallback((name) => { setProductNameToAdd(name); setAddToLibrary(true); setAddProductModalOpen(true); }, []);

  const handleApplyDiscount = (type, value) => { setSaleState(prev => ({ ...prev, discount: { type, value } })); setDiscountModalOpen(false); };
  const handleRemoveDiscount = () => { setSaleState(prev => ({ ...prev, discount: { type: 'none', value: 0 } })); };

  const resetSale = () => { setSaleState({ stage: 'customer_lookup', customer: null, cart: [], discount: { type: 'none', value: 0 } }); setLastSale(null); };

  // ─── Keyboard input helpers ────────────────────────────────
  const activeInputRef = useRef(null);

  const applyKey = useCallback((key) => {
    const el = activeInputRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const newVal = el.value.substring(0, start) + key + el.value.substring(end);
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, newVal);
    el.selectionStart = el.selectionEnd = start + key.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
  }, []);

  const applyBackspace = useCallback(() => {
    const el = activeInputRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    if (start === 0 && end === 0) return;
    const newVal = start !== end ? el.value.substring(0, start) + el.value.substring(end) : el.value.substring(0, start - 1) + el.value.substring(start);
    const newPos = start !== end ? start : start - 1;
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, newVal);
    el.selectionStart = el.selectionEnd = newPos;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
  }, []);

  const applyEnter = useCallback(() => {
    const el = activeInputRef.current;
    if (!el) return;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  }, []);

  // ─── Product search ────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!searchValue.trim()) return [];
    const q = searchValue.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && String(p.barcode).includes(searchValue)) ||
      (p.sku && String(p.sku).toLowerCase().includes(q))
    ).slice(0, 12);
  }, [searchValue, products]);

  const handleProductSelect = (product) => {
    handleAddToCart(product);
    setSearchValue('');
    setShowKeyboard(false);
    searchInputRef.current?.blur();
  };

  const handleSearchEnter = () => {
    if (filteredProducts.length === 1) {
      handleProductSelect(filteredProducts[0]);
    } else if (filteredProducts.length > 0) {
      handleProductSelect(filteredProducts[0]);
    } else if (searchValue.trim()) {
      handleAddNewProduct(searchValue.trim());
      setSearchValue('');
    }
  };

  // ───────────────────────────────────────────────────────────
  //  CUSTOMER LOOKUP STAGE
  // ───────────────────────────────────────────────────────────
  const [custPhone, setCustPhone] = useState('');
  const [custPhoneKb, setCustPhoneKb] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [multipleCustomers, setMultipleCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', address: '' });
  const custPhoneRef = useRef(null);

  const handleFindCustomer = async () => {
    if (!custPhone) return;
    try {
      const result = await handlers.customers.findByPhone(custPhone);
      if (result?.multiple) { setMultipleCustomers(result.matches); }
      else if (result) { setSaleState(prev => ({ ...prev, stage: 'scanning', customer: result })); toast({ title: `Welcome back, ${result.name}!` }); setCustPhoneKb(false); }
      else { setIsNewCustomer(true); setNewCustomer(prev => ({ ...prev, phone: custPhone })); }
    } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name?.trim()) { toast({ title: "Name Required", variant: "destructive" }); return; }
    try {
      const added = await handlers.customers.add({ ...newCustomer, phone: custPhone });
      setSaleState(prev => ({ ...prev, stage: 'scanning', customer: added }));
      toast({ title: `${added.name} added!` }); setCustPhoneKb(false);
    } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  if (saleState.stage === 'customer_lookup') {
    // Saved carts view
    if (showSavedCarts) {
      return (
        <div className="h-full flex flex-col p-3">
          <div className="flex items-center mb-4">
            <button onClick={() => setShowSavedCarts(false)} className="mr-3 p-2 rounded-lg bg-secondary touch-manipulation"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-xl font-bold">Saved Carts ({savedCarts.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {savedCarts.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No saved carts</p>
            ) : savedCarts.map(cart => (
              <div key={cart.id} className="p-4 border rounded-xl flex justify-between items-center active:bg-secondary/60 touch-manipulation" onClick={() => handleLoadSavedCart(cart)}>
                <div>
                  <p className="font-medium">{cart.name || 'Unnamed Cart'}</p>
                  <p className="text-sm text-muted-foreground">{cart.customers?.name || 'Guest'} &bull; {cart.items.length} items &bull; ${cart.total.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={e => { e.stopPropagation(); handleLoadSavedCart(cart); }}>Load</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); handleDeleteSavedCart(cart.id); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Multiple customers found
    if (multipleCustomers.length > 0) {
      return (
        <div className="h-full flex flex-col p-3">
          <div className="flex items-center mb-4">
            <button onClick={() => { setMultipleCustomers([]); setCustPhone(''); }} className="mr-3 p-2 rounded-lg bg-secondary touch-manipulation"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-xl font-bold">Select Customer</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {multipleCustomers.map(c => (
              <button key={c.id} onClick={() => { setSaleState(prev => ({ ...prev, stage: 'scanning', customer: c })); setCustPhoneKb(false); toast({ title: `Welcome back, ${c.name}!` }); }}
                className="w-full text-left p-4 border rounded-xl active:bg-secondary touch-manipulation">
                <p className="font-medium text-lg">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.phone}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // New customer form
    if (isNewCustomer) {
      return (
        <div className="h-full flex flex-col p-3">
          <div className="flex items-center mb-4">
            <button onClick={() => setIsNewCustomer(false)} className="mr-3 p-2 rounded-lg bg-secondary touch-manipulation"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-xl font-bold">New Customer</h2>
          </div>
          <div className="flex-1 space-y-3 max-w-lg mx-auto w-full">
            <div className="flex items-center gap-2"><Phone className="w-5 h-5 text-muted-foreground shrink-0" /><Input value={custPhone} disabled className="h-12 text-lg" /></div>
            <div className="flex items-center gap-2"><User className="w-5 h-5 text-muted-foreground shrink-0" /><Input placeholder="Full Name *" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} className="h-12 text-lg" autoFocus onFocus={e => { activeInputRef.current = e.target; setCustPhoneKb(true); }} /></div>
            <div className="flex items-center gap-2"><Mail className="w-5 h-5 text-muted-foreground shrink-0" /><Input placeholder="Email" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} className="h-12 text-lg" onFocus={e => { activeInputRef.current = e.target; setCustPhoneKb(true); }} /></div>
            <div className="flex items-center gap-2"><Home className="w-5 h-5 text-muted-foreground shrink-0" /><Input placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))} className="h-12 text-lg" onFocus={e => { activeInputRef.current = e.target; setCustPhoneKb(true); }} /></div>
            <Button onClick={handleAddNewCustomer} className="w-full h-14 text-lg font-bold rounded-xl"><UserPlus className="w-5 h-5 mr-2" /> Add & Start Sale</Button>
          </div>
          {custPhoneKb && (
            <div className="mt-2">
              <TouchKeyboard theme={keyboardTheme} onKey={applyKey} onBackspace={applyBackspace} onEnter={handleAddNewCustomer} onDone={() => setCustPhoneKb(false)} />
            </div>
          )}
        </div>
      );
    }

    // Main customer lookup
    return (
      <div className="h-full flex flex-col p-3">
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
          <h2 className="text-2xl font-bold text-primary mb-1">Start New Sale</h2>
          <p className="text-muted-foreground mb-6">Enter phone number or continue as guest</p>
          <div className="w-full space-y-3">
            <Input
              ref={custPhoneRef}
              type="tel"
              placeholder="Phone Number"
              value={custPhone}
              onChange={e => setCustPhone(e.target.value.replace(/\D/g, ''))}
              className="h-14 text-xl text-center rounded-xl"
              onFocus={e => { activeInputRef.current = e.target; setCustPhoneKb(true); }}
            />
            <Button onClick={handleFindCustomer} className="w-full h-14 text-lg font-bold rounded-xl" disabled={!custPhone}>
              <Search className="w-5 h-5 mr-2" /> Find Customer
            </Button>
            <div className="flex gap-2">
              <Button onClick={() => { setSaleState(prev => ({ ...prev, stage: 'scanning', customer: null })); setCustPhoneKb(false); }} variant="outline" className="flex-1 h-12 rounded-xl text-base">
                <SkipForward className="w-4 h-4 mr-2" /> Guest
              </Button>
              <Button onClick={() => setShowSavedCarts(true)} variant="outline" className="flex-1 h-12 rounded-xl text-base">
                <Archive className="w-4 h-4 mr-2" /> Saved ({savedCarts.length})
              </Button>
            </div>
          </div>
        </div>
        {custPhoneKb && (
          <div className="mt-auto">
            <TouchNumpad compact theme={keyboardTheme} onKey={k => { const el = custPhoneRef.current; if (el) { setCustPhone(p => p + k); } }} onBackspace={() => setCustPhone(p => p.slice(0, -1))} onEnter={handleFindCustomer} />
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  //  COMPLETED STAGE
  // ───────────────────────────────────────────────────────────
  if (saleState.stage === 'completed') {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center p-8 bg-card rounded-2xl shadow-xl w-full max-w-sm">
          <div className="text-5xl mb-3">✓</div>
          <h2 className="text-2xl font-bold text-green-500 mb-4">Sale Complete!</h2>
          <div className="flex flex-col gap-3">
            <Button onClick={resetSale} className="h-14 text-lg font-bold rounded-xl">Start New Sale</Button>
            <Button onClick={() => {/* receipt logic same as PosView */}} variant="outline" className="h-12 rounded-xl">
              <Receipt className="w-4 h-4 mr-2" /> Print Receipt
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  //  MAIN POS SCANNING STAGE — Touch Layout
  // ───────────────────────────────────────────────────────────
  //
  //  ┌───────────────────────┬──────────────────┐
  //  │ [🔍 Search        ]   │  👤 Customer     │  ← top bar
  //  ├───────────────────────┼──────────────────┤
  //  │ Search results /      │  Cart items      │
  //  │ Numpad                │  (scrollable)    │
  //  │                       │──────────────────│
  //  │                       │ Total  [CHECKOUT]│
  //  ├───────────────────────┴──────────────────┤
  //  │ [Full Keyboard when search focused]      │
  //  └──────────────────────────────────────────┘

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Top bar: Search + Customer */}
        <div className="flex items-center gap-2 p-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products..."
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onFocus={e => { activeInputRef.current = e.target; setShowKeyboard(true); }}
              className="w-full h-11 pl-10 pr-4 rounded-xl border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="off"
            />
          </div>
          {saleState.customer ? (
            <button onClick={() => setCustomerModalOpen(true)} className="shrink-0 h-11 px-3 rounded-xl bg-secondary flex items-center gap-1.5 active:bg-secondary/80 touch-manipulation">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium truncate max-w-[100px]">{saleState.customer.name}</span>
              <Edit className="w-3 h-3 text-muted-foreground" />
            </button>
          ) : (
            <button onClick={() => setAssignCustomerModalOpen(true)} className="shrink-0 h-11 px-3 rounded-xl bg-secondary flex items-center gap-1.5 active:bg-secondary/80 touch-manipulation">
              <UserPlus className="w-4 h-4" />
              <span className="text-sm">Guest</span>
            </button>
          )}
        </div>

        {/* Main content: Left panel + Right cart */}
        <div className="flex-1 flex gap-2 px-2 pb-1 min-h-0">
          {/* Left panel: results or numpad */}
          <div className="w-[55%] flex flex-col min-h-0">
            {showKeyboard && searchValue.trim() ? (
              /* Search results */
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-3">No product found for "{searchValue}"</p>
                    <Button onClick={() => { handleAddNewProduct(searchValue); setSearchValue(''); setShowKeyboard(false); }} className="h-12 px-6 rounded-xl text-base">
                      <Plus className="w-4 h-4 mr-2" /> Add "{searchValue}"
                    </Button>
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleProductSelect(product)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border bg-card active:bg-secondary touch-manipulation"
                    >
                      <div className="text-left min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        {product.sku && <p className="text-xs text-muted-foreground">#{product.sku}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-primary">${product.price.toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">{product.stock} left</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* Quick Amount Tiles when not searching */
              <div className="flex-1 overflow-y-auto p-2">
                <QuickAmountTiles onAddAmount={handleAddToCart} settings={settings} touch />
              </div>
            )}
          </div>

          {/* Right panel: Cart */}
          <div className="w-[45%] flex flex-col bg-card rounded-xl border min-h-0">
            <div className="px-3 py-2 border-b flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold flex items-center gap-1.5"><ShoppingCart className="w-4 h-4" /> Cart</span>
              <span className="text-xs text-muted-foreground">{saleState.cart.length} items</span>
            </div>
            {saleState.cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center p-4">
                <div>
                  <ShoppingCart className="w-12 h-12 text-muted-foreground/10 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Cart is empty</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {saleState.cart.map(item => (
                  <TouchCartItem key={item.id} item={item} onUpdateQuantity={handleUpdateCartQuantity} onToggleTaxable={handleToggleItemTaxable} />
                ))}
              </div>
            )}
            {/* Totals & action bar */}
            <div className="shrink-0 border-t p-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Sub: ${subtotal.toFixed(2)}</span>
                {appliedTaxes.length > 0 && <span className="text-muted-foreground">Tax: ${appliedTaxes.reduce((s,t)=>s+t.amount,0).toFixed(2)}</span>}
                {discountAmount > 0 && (
                  <span className="text-green-600 flex items-center gap-0.5">
                    -{discountAmount.toFixed(2)}
                    <button onClick={handleRemoveDiscount} className="text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setSaveCartModalOpen(true)} disabled={saleState.cart.length === 0} className="w-10 h-10 rounded-lg border flex items-center justify-center active:bg-secondary touch-manipulation disabled:opacity-40"><Save className="w-4 h-4" /></button>
                <button onClick={() => setDiscountModalOpen(true)} disabled={saleState.cart.length === 0} className="w-10 h-10 rounded-lg border flex items-center justify-center active:bg-secondary touch-manipulation disabled:opacity-40"><Percent className="w-4 h-4" /></button>
                <div className="flex-1" />
                <span className="text-lg font-bold text-primary">${total.toFixed(2)}</span>
                <Button onClick={() => setCheckoutOpen(true)} disabled={saleState.cart.length === 0} className="h-10 px-5 rounded-xl font-bold text-sm">
                  <CreditCard className="w-4 h-4 mr-1.5" /> Pay
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Full keyboard when search is focused */}
        {showKeyboard && (
          <div className="shrink-0 px-1 pb-1">
            <TouchKeyboard
              theme={keyboardTheme}
              onKey={k => {
                setSearchValue(prev => prev + k);
                searchInputRef.current?.focus();
              }}
              onBackspace={() => {
                setSearchValue(prev => prev.slice(0, -1));
                searchInputRef.current?.focus();
              }}
              onEnter={handleSearchEnter}
              onDone={() => setShowKeyboard(false)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <CheckoutModal isOpen={isCheckoutOpen} onOpenChange={setCheckoutOpen} onSave={handleProcessSale} total={total} subtotal={subtotal} cart={saleState.cart} taxes={appliedTaxes} serviceCharges={appliedServiceCharges} customer={saleState.customer} />
      <CustomerDetailModal isOpen={isCustomerModalOpen} onClose={() => setCustomerModalOpen(false)} customer={saleState.customer} onSave={async (c) => { await handlers.customers.update(c); setSaleState(prev => ({ ...prev, customer: c })); }} />
      <AssignCustomerModal isOpen={isAssignCustomerModalOpen} onClose={() => setAssignCustomerModalOpen(false)} onAssignCustomer={handleAssignCustomerToSale} onAddNewCustomer={() => { setAssignCustomerModalOpen(false); setAddCustomerModalOpen(true); }} handlers={handlers} />
      <AddCustomerModal isOpen={isAddCustomerModalOpen} onClose={() => setAddCustomerModalOpen(false)} onSave={handleAddCustomerToSale} />
      <SaveCartModal isOpen={isSaveCartModalOpen} onClose={() => setSaveCartModalOpen(false)} onSave={handleSaveCart} customer={saleState.customer} cartTotal={total} itemCount={saleState.cart.length} />
      <DiscountModal isOpen={isDiscountModalOpen} onClose={() => setDiscountModalOpen(false)} onApplyDiscount={handleApplyDiscount} onAddCustomItem={handleAddToCart} subtotal={subtotal} />
      <PhoneOrderModal isOpen={isPhoneOrderModalOpen} onClose={() => setPhoneOrderModalOpen(false)} customer={saleState.customer} onSubmit={({ address, instructions, saveToProfile }) => { setPhoneOrderDraft({ address, instructions, saveToProfile }); setCheckoutOpen(true); setPhoneOrderModalOpen(false); }} />
      {isAddProductModalOpen && (
        <ProductDetailModal
          isOpen={isAddProductModalOpen}
          onClose={() => { setAddProductModalOpen(false); setProductNameToAdd(''); setAddToLibrary(true); }}
          product={{ name: productNameToAdd, price: 0, stock: 0 }}
          categories={[]}
          handlers={handlers}
          initialMode="edit"
          onSave={async (editedProduct) => {
            try {
              if (addToLibrary && handlers?.products?.add) await handlers.products.add(editedProduct);
              const cartItem = { ...editedProduct, id: editedProduct.id || `custom-${Date.now()}`, quantity: 1, taxable: editedProduct.taxable !== false, isCustom: !addToLibrary };
              setSaleState(prev => ({ ...prev, cart: [...prev.cart, cartItem] }));
              setAddProductModalOpen(false); setProductNameToAdd(''); setAddToLibrary(true); setSearchValue('');
            } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
          }}
          onDelete={() => { setAddProductModalOpen(false); setProductNameToAdd(''); setAddToLibrary(true); }}
          addToLibraryCheckbox={true}
          addToLibrary={addToLibrary}
          setAddToLibrary={setAddToLibrary}
        />
      )}
    </>
  );
};

export default TouchPosView;
