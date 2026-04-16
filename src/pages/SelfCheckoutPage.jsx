import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Tag, X, CheckCircle2, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';

import CardReaderSwipe from '@/components/pos/pos-components/CardReaderSwipe.jsx';
import { useCart } from '@/hooks/useCart.jsx';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const IDLE_TIMEOUT_MS = 60_000;   // 1 min no scan → show idle dialog
const IDLE_DIALOG_SECS = 30;      // 30s to respond before auto-cancel
const PRICE_CHECK_RETURN_SECS = 3;

const stripHtml = (v) => String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const normalizeProduct = (p) => {
  const variant = p.variants?.[0];
  const price = variant
    ? (variant.sale_price_in_cents ?? variant.price_in_cents ?? 0) / 100
    : Number(p.price || 0);
  return {
    id: p.id,
    name: p.name || p.title || 'Unknown item',
    description: stripHtml(p.description || p.subtitle || ''),
    image: p.image_url || p.image || '',
    price: Number.isFinite(price) ? price : 0,
    stock: Number(p.stock ?? variant?.inventory_quantity ?? 999),
    barcode: String(p.barcode || p.sku || variant?.sku || '').trim(),
    sku: String(p.sku || variant?.sku || '').trim(),
    ecomVariantId: p.ecom_variant_id || variant?.id || p.id,
    productId: p.id,
  };
};

// ─── Admin: PIN overlay ───────────────────────────────────────────────────────
const AdminPinOverlay = ({ correctPin, onSuccess, onClose }) => {
  const [digits, setDigits] = useState([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  const push = useCallback((d) => {
    setDigits((prev) => {
      if (prev.length >= 4) return prev;
      const next = [...prev, d];
      if (next.length === 4) {
        if (next.join('') === correctPin) {
          setTimeout(onSuccess, 150);
        } else {
          setShake(true); setError(true);
          setTimeout(() => { setShake(false); setError(false); setDigits([]); }, 800);
        }
      }
      return next;
    });
  }, [correctPin, onSuccess]);

  const del = () => setDigits((d) => d.slice(0, -1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border rounded-3xl p-8 w-[340px] flex flex-col items-center gap-6 shadow-2xl"
      >
        <Lock className="w-10 h-10 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Admin Access</h2>

        {/* PIN dots */}
        <motion.div animate={shake ? { x: [-8, 8, -6, 6, 0] } : {}} className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-5 h-5 rounded-full border-2 transition-colors ${i < digits.length ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
          ))}
        </motion.div>
        {error && <p className="text-destructive text-sm -mt-3">Incorrect PIN</p>}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} onClick={() => push(String(n))}
              className="h-16 rounded-2xl bg-secondary text-secondary-foreground text-2xl font-semibold border border-border active:scale-95 transition-transform">
              {n}
            </button>
          ))}
          <button onClick={del}
            className="h-16 rounded-2xl bg-secondary text-secondary-foreground text-xl font-semibold border border-border active:scale-95 transition-transform">
            ⌫
          </button>
          <button onClick={() => push('0')}
            className="h-16 rounded-2xl bg-secondary text-secondary-foreground text-2xl font-semibold border border-border active:scale-95 transition-transform">
            0
          </button>
          <button onClick={onClose}
            className="h-16 rounded-2xl bg-muted text-muted-foreground text-base font-semibold border border-border active:scale-95 transition-transform">
            ✕
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Admin: Panel ─────────────────────────────────────────────────────────────
const AdminPanel = ({ onClose, onLogout }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="bg-card border border-border rounded-3xl p-8 w-[320px] flex flex-col items-center gap-5 shadow-2xl"
    >
      <ShieldCheck className="w-10 h-10 text-primary" />
      <h2 className="text-2xl font-bold text-foreground">Admin Panel</h2>
      <button onClick={onLogout}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-destructive text-destructive-foreground text-lg font-semibold active:scale-95 transition-transform">
        <LogOut className="w-5 h-5" /> Log Out
      </button>
      <button onClick={onClose}
        className="w-full py-4 rounded-2xl bg-secondary text-secondary-foreground text-lg font-semibold border border-border active:scale-95 transition-transform">
        Cancel
      </button>
    </motion.div>
  </div>
);

// ─── Idle Dialog ──────────────────────────────────────────────────────────────
const IdleDialog = ({ countdown, onKeepShopping, onCancelOrder }) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className="bg-card border border-border rounded-3xl p-10 w-[380px] flex flex-col items-center gap-6 shadow-2xl text-center"
    >
      <h2 className="text-3xl font-bold text-foreground">Still shopping?</h2>
      <p className="text-muted-foreground text-lg">
        Session ends in <span className="font-bold text-foreground">{countdown}s</span>
      </p>
      <button onClick={onKeepShopping}
        className="w-full py-5 rounded-2xl bg-primary text-primary-foreground text-xl font-semibold active:scale-95 transition-transform">
        Yes, keep shopping
      </button>
      <button onClick={onCancelOrder}
        className="w-full py-4 rounded-2xl bg-secondary text-secondary-foreground text-lg font-semibold border border-border active:scale-95 transition-transform">
        Cancel order
      </button>
    </motion.div>
  </div>
);

// ─── Screen: Welcome ─────────────────────────────────────────────────────────
const WelcomeScreen = ({ storeName, onShopping, onPriceCheck }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-background px-8 gap-10">
    <div className="text-center">
      <h1 className="text-5xl font-bold text-foreground tracking-tight">{storeName}</h1>
      <p className="text-xl text-muted-foreground mt-3">How can we help you today?</p>
    </div>
    <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
      <button
        onClick={onShopping}
        className="flex-1 flex flex-col items-center justify-center gap-4 bg-primary text-primary-foreground rounded-3xl p-10 text-2xl font-semibold shadow-lg active:scale-95 transition-transform"
      >
        <ShoppingCart className="w-14 h-14" />
        Start Shopping
      </button>
      <button
        onClick={onPriceCheck}
        className="flex-1 flex flex-col items-center justify-center gap-4 bg-secondary text-secondary-foreground rounded-3xl p-10 text-2xl font-semibold shadow-lg active:scale-95 transition-transform border border-border"
      >
        <Tag className="w-14 h-14" />
        Check Price
      </button>
    </div>
  </div>
);

// ─── Screen: Price Check ──────────────────────────────────────────────────────
const PriceCheckScreen = ({ catalog, onDone }) => {
  const inputRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [countdown, setCountdown] = useState(null); // null = no result yet
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  const timerRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // keep focus on the hidden input at all times
  useEffect(() => {
    const refocus = () => inputRef.current?.focus();
    document.addEventListener('click', refocus);
    return () => document.removeEventListener('click', refocus);
  }, []);

  // start/restart 5-sec countdown whenever a scan result appears
  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(PRICE_CHECK_RETURN_SECS);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); onDoneRef.current(); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleScan = useCallback((raw) => {
    const val = raw.trim().toLowerCase();
    if (!val) return;
    const match = catalog.find((p) =>
      p.barcode.toLowerCase() === val ||
      p.sku.toLowerCase() === val ||
      p.id.toLowerCase() === val
    );
    setScanValue('');
    if (match) { setFound(match); setNotFound(false); }
    else { setFound(null); setNotFound(true); }
    startCountdown();
  }, [catalog, startCountdown]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-8 gap-8">
      <input
        ref={inputRef}
        value={scanValue}
        onChange={(e) => setScanValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(scanValue); } }}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoComplete="off"
        tabIndex={-1}
      />
      <div className="text-center">
        <Tag className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="text-4xl font-bold text-foreground">Check Price</h2>
        <p className="text-xl text-muted-foreground mt-2">Scan any item to see the price</p>
      </div>
      <AnimatePresence mode="wait">
        {found && (
          <motion.div
            key="found"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lg"
          >
            {found.image && (
              <img src={found.image} alt={found.name} className="w-24 h-24 object-cover rounded-xl mx-auto mb-4" />
            )}
            <p className="text-2xl font-semibold text-foreground">{found.name}</p>
            {found.description && <p className="text-muted-foreground mt-1 text-sm">{found.description}</p>}
            <p className="text-5xl font-bold text-primary mt-4">{fmt.format(found.price)}</p>
          </motion.div>
        )}
        {notFound && (
          <motion.div
            key="notfound"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md rounded-3xl border border-destructive/40 bg-destructive/5 p-8 text-center"
          >
            <p className="text-2xl font-semibold text-destructive">Item not found</p>
            <p className="text-muted-foreground mt-1">Try scanning again</p>
          </motion.div>
        )}
      </AnimatePresence>
      {countdown !== null && (
        <p className="text-muted-foreground text-lg">Returning in {countdown}…</p>
      )}
    </div>
  );
};

// ─── Screen: Shopping / Cart ──────────────────────────────────────────────────
const ShoppingScreen = ({ catalog, storeName, onPay, onCancel, onActivity, taxesHandler }) => {
  const { cartItems, addToCart, clearCart, removeFromCart } = useCart();
  const inputRef = useRef(null);
  const [scanValue, setScanValue] = useState('');
  const [lastAdded, setLastAdded] = useState(null);
  const [itemNotFound, setItemNotFound] = useState(false);

  const cartSummary = useMemo(() =>
    cartItems.map((item) => ({
      variantId: item.variant.id,
      name: item.product.name || item.product.title || 'Unknown item',
      unitPrice: Number(item.product.price || 0),
      quantity: item.quantity,
      productId: item.product.productId || item.product.id,
      sku: item.product.sku || '',
    })),
  [cartItems]);

  const total = useMemo(
    () => cartSummary.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [cartSummary]
  );

  const appliedTaxes = useMemo(
    () => taxesHandler?.getApplicable ? taxesHandler.getApplicable(total, cartSummary) : [],
    [taxesHandler, total, cartSummary]
  );

  const taxAmount = useMemo(
    () => appliedTaxes.reduce((s, t) => s + t.amount, 0),
    [appliedTaxes]
  );

  const grandTotal = total + taxAmount;

  useEffect(() => { inputRef.current?.focus(); }, []);

  // periodically recapture focus unless a button is active
  useEffect(() => {
    const t = setInterval(() => {
      if (document.activeElement?.tagName !== 'BUTTON') inputRef.current?.focus();
    }, 500);
    return () => clearInterval(t);
  }, []);

  const handleScan = useCallback(async (raw) => {
    const val = raw.trim().toLowerCase();
    if (!val) return;
    setScanValue('');
    setItemNotFound(false);
    const match = catalog.find((p) =>
      p.barcode.toLowerCase() === val ||
      p.sku.toLowerCase() === val ||
      p.id.toLowerCase() === val
    );
    if (!match) {
      setItemNotFound(true);
      setTimeout(() => setItemNotFound(false), 2000);
      onActivity?.();
      return;
    }
    try {
      await addToCart(match, { id: match.ecomVariantId, title: 'Default' }, 1);
      setLastAdded(match.name);
      setTimeout(() => setLastAdded(null), 1500);
      onActivity?.();
    } catch { /* stock limit */ }
  }, [catalog, addToCart, onActivity]);

  const handleCancel = () => { clearCart(); onCancel(); };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <span className="text-xl font-bold text-foreground">{storeName}</span>
        <span className="text-sm text-muted-foreground">Scan items to add</span>
      </div>

      {/* Hidden scan input */}
      <input
        ref={inputRef}
        value={scanValue}
        onChange={(e) => setScanValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan(scanValue); } }}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoComplete="off"
        tabIndex={-1}
      />

      {/* Feedback banners — fixed height so they don't shift layout */}
      <div className="shrink-0 px-6 pt-2">
        <AnimatePresence>
          {lastAdded && (
            <motion.div key="added" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 px-4 py-2 text-green-800 dark:text-green-200 text-sm font-medium">
              ✓ Added: {lastAdded}
            </motion.div>
          )}
          {itemNotFound && (
            <motion.div key="notfound" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-4 py-2 text-red-800 dark:text-red-200 text-sm font-medium">
              Item not found — try scanning again
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart list — scrolls, never pushes footer */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-1.5 min-h-0">
        {cartSummary.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
            <ShoppingCart className="w-10 h-10 opacity-30" />
            <p className="text-lg">No items yet — scan something</p>
          </div>
        ) : (
          cartSummary.map((item) => (
            <div key={item.variantId} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {fmt.format(item.unitPrice)} × {item.quantity}
                  {item.quantity > 1 && (
                    <span className="ml-2 text-foreground font-medium">= {fmt.format(item.unitPrice * item.quantity)}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => removeFromCart(item.variantId)}
                className="ml-3 p-1.5 rounded-full hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                aria-label="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer — always anchored to bottom */}
      <div className="border-t border-border px-6 py-4 bg-background shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xl font-semibold text-foreground">Total</span>
          <span className="text-3xl font-bold text-primary">{fmt.format(grandTotal)}</span>
        </div>
        {appliedTaxes.length > 0 && (
          <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
            <span>Subtotal</span><span>{fmt.format(total)}</span>
          </div>
        )}
        {appliedTaxes.map((t) => (
          <div key={t.name} className="flex items-center justify-between mb-1 text-sm text-muted-foreground">
            <span>{t.name} ({Number(t.rate).toFixed(3)}%)</span><span>{fmt.format(t.amount)}</span>
          </div>
        ))}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-4 rounded-2xl border border-border bg-secondary text-secondary-foreground text-lg font-semibold active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={() => onPay(cartSummary, grandTotal, appliedTaxes)}
            disabled={cartSummary.length === 0}
            className="flex-[2] py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-semibold shadow active:scale-95 transition-transform disabled:opacity-40"
          >
            Pay {fmt.format(grandTotal)}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Screen: Payment ──────────────────────────────────────────────────────────
const PaymentScreen = ({ total, cartSummary, appliedTaxes, salesHandler, onBack, onDone }) => {
  const handlePaymentSuccess = useCallback(async (details) => {
    const subtotal = cartSummary.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const totalTaxAmount = appliedTaxes.reduce((s, t) => s + t.amount, 0);
    const primaryTaxRate = appliedTaxes.length > 0 ? appliedTaxes[0].rate : 0;
    const saleData = {
      items: cartSummary.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        price: i.unitPrice,
        name: i.name,
        sku: i.sku,
      })),
      total,
      subtotal,
      customer_id: null,
      payment_method: details?.method || 'card_reader',
      taxes: appliedTaxes.map((t) => ({ name: t.name, rate: t.rate, amount: t.amount })),
      service_charges_applied: [],
      tax_rate: primaryTaxRate,
      tax_amount: totalTaxAmount,
      service_charge: 0,
      timestamp: new Date().toISOString(),
    };
    try { if (salesHandler?.add) await salesHandler.add(saleData); } catch { /* non-fatal */ }
    onDone();
  }, [cartSummary, appliedTaxes, salesHandler, total, onDone]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-8 gap-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-foreground">Payment</h2>
        <p className="text-6xl font-bold text-primary mt-4">{fmt.format(total)}</p>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-lg">
        <CardReaderSwipe amount={total} onPaymentSuccess={handlePaymentSuccess} />
      </div>
      <button
        onClick={onBack}
        className="px-10 py-4 rounded-2xl border border-border bg-secondary text-secondary-foreground text-lg font-semibold active:scale-95 transition-transform"
      >
        ← Back to Cart
      </button>
    </div>
  );
};

// ─── Screen: Thank You ────────────────────────────────────────────────────────
const ThankYouScreen = ({ storeName, onRestart }) => {
  const [countdown, setCountdown] = useState(3);
  const onRestartRef = useRef(onRestart);
  useEffect(() => { onRestartRef.current = onRestart; }, [onRestart]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); onRestartRef.current(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []); // run once on mount, stable via ref

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-8 gap-8 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
        <CheckCircle2 className="w-28 h-28 text-green-500 mx-auto" />
      </motion.div>
      <div>
        <h2 className="text-5xl font-bold text-foreground">Thank You!</h2>
        <p className="text-2xl text-muted-foreground mt-3">Payment approved. Have a great day!</p>
        {storeName && <p className="text-lg text-muted-foreground mt-1">— {storeName}</p>}
      </div>
      <p className="text-muted-foreground text-lg">Returning in {countdown}…</p>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const SelfCheckoutPage = () => {
  const { products = [], salesHandler, settings, taxesHandler } = useOutletContext();
  const { clearCart } = useCart();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const storeName = settings?.storeName?.value || 'Self Checkout';
  const adminPin = settings?.selfCheckoutPin?.value || '1234';

  const [screen, setScreen] = useState('welcome');
  const [payData, setPayData] = useState({ cartSummary: [], total: 0, appliedTaxes: [] });
  const [adminOverlay, setAdminOverlay] = useState(null); // null | 'pin' | 'panel'
  const [idleDialog, setIdleDialog] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(IDLE_DIALOG_SECS);

  const idleTimeoutRef = useRef(null);
  const idleDialogTimerRef = useRef(null);

  const catalog = useMemo(() => products.map(normalizeProduct), [products]);

  // Ctrl+Alt+A → show PIN from any screen
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setAdminOverlay('pin');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Idle timer helpers
  const clearIdleTimers = useCallback(() => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    if (idleDialogTimerRef.current) clearInterval(idleDialogTimerRef.current);
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimers();
    setIdleDialog(false);
    idleTimeoutRef.current = setTimeout(() => {
      setIdleDialog(true);
      let secs = IDLE_DIALOG_SECS;
      setIdleCountdown(secs);
      idleDialogTimerRef.current = setInterval(() => {
        secs -= 1;
        setIdleCountdown(secs);
        if (secs <= 0) {
          clearInterval(idleDialogTimerRef.current);
          setIdleDialog(false);
          clearCart();
          setScreen('welcome');
        }
      }, 1000);
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimers, clearCart]);

  // Start/stop idle timer when entering/leaving shopping screen
  useEffect(() => {
    if (screen === 'shopping') {
      resetIdleTimer();
    } else {
      clearIdleTimers();
      setIdleDialog(false);
    }
    return clearIdleTimers;
  }, [screen, resetIdleTimer, clearIdleTimers]);

  const goWelcome = useCallback(() => { clearCart(); setScreen('welcome'); }, [clearCart]);
  const handlePay = useCallback((cartSummary, total, appliedTaxes) => { setPayData({ cartSummary, total, appliedTaxes }); setScreen('payment'); }, []);
  const handlePaymentDone = useCallback(() => { clearCart(); setScreen('thankyou'); }, [clearCart]);

  const handleLogout = useCallback(async () => {
    setAdminOverlay(null);
    clearIdleTimers();
    await signOut();
    navigate('/login', { state: { from: '/selfcheckout', kioskMode: true } });
  }, [signOut, navigate, clearIdleTimers]);

  const handleKeepShopping = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  const handleIdleCancel = useCallback(() => {
    clearIdleTimers();
    setIdleDialog(false);
    goWelcome();
  }, [clearIdleTimers, goWelcome]);

  return (
    <>
      {/* Admin overlays */}
      <AnimatePresence>
        {adminOverlay === 'pin' && (
          <AdminPinOverlay
            key="pin"
            correctPin={adminPin}
            onSuccess={() => setAdminOverlay('panel')}
            onClose={() => setAdminOverlay(null)}
          />
        )}
        {adminOverlay === 'panel' && (
          <AdminPanel
            key="panel"
            onClose={() => setAdminOverlay(null)}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      {/* Idle dialog */}
      <AnimatePresence>
        {idleDialog && (
          <IdleDialog
            key="idle"
            countdown={idleCountdown}
            onKeepShopping={handleKeepShopping}
            onCancelOrder={handleIdleCancel}
          />
        )}
      </AnimatePresence>

      {/* Screens */}
      <AnimatePresence mode="wait">
        {screen === 'welcome' && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WelcomeScreen storeName={storeName} onShopping={() => setScreen('shopping')} onPriceCheck={() => setScreen('price-check')} />
          </motion.div>
        )}
        {screen === 'price-check' && (
          <motion.div key="price-check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PriceCheckScreen catalog={catalog} onDone={() => setScreen('welcome')} />
          </motion.div>
        )}
        {screen === 'shopping' && (
          <motion.div key="shopping" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ShoppingScreen catalog={catalog} storeName={storeName} onPay={handlePay} onCancel={goWelcome} onActivity={resetIdleTimer} taxesHandler={taxesHandler} />
          </motion.div>
        )}
        {screen === 'payment' && (
          <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PaymentScreen total={payData.total} cartSummary={payData.cartSummary} appliedTaxes={payData.appliedTaxes} salesHandler={salesHandler} onBack={() => setScreen('shopping')} onDone={handlePaymentDone} />
          </motion.div>
        )}
        {screen === 'thankyou' && (
          <motion.div key="thankyou" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ThankYouScreen storeName={storeName} onRestart={goWelcome} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SelfCheckoutPage;
