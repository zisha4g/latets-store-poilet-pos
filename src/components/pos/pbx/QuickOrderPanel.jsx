// QuickOrderPanel — inline order builder used inside the softphone workspace.
//
// Two layouts:
//   - compact (default): single column, product search + cart stacked. Used
//     in a sidebar context.
//   - large: two-column layout (product grid on the left, cart sidebar on
//     the right). Used when the panel takes over the full in-call tab so
//     the agent can browse products visually while still on the call.

import React, { useMemo, useState } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingBag, Check, Loader2, X, Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'phone_order', label: 'Phone (pay later)' },
];

const QuickOrderPanel = ({
  products = [], customer = null, handlers, onCreated, large = false,
}) => {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('phone_order');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(products) ? products : [];
    if (!q) return large ? list.slice(0, 60) : list.slice(0, 30);
    return list
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        return name.includes(q) || sku.includes(q) || barcode.includes(q);
      })
      .slice(0, large ? 80 : 30);
  }, [query, products, large]);

  const addToCart = (product) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product_id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name || 'Item',
          price: Number(product.price) || 0,
          cost_price: Number(product.cost_price) || 0,
          sku: product.sku || null,
          quantity: 1,
        },
      ];
    });
  };

  const incQty = (productId, delta) => {
    setCart((prev) => prev
      .map((c) => (c.product_id === productId ? { ...c, quantity: c.quantity + delta } : c))
      .filter((c) => c.quantity > 0));
  };

  const removeItem = (productId) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  };

  const subtotal = useMemo(
    () => cart.reduce((acc, c) => acc + c.price * c.quantity, 0),
    [cart],
  );

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }
    if (!handlers?.sales?.add) {
      toast({ title: 'Cannot create sale here', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const saleData = {
        items: cart.map((c) => ({
          product_id: c.product_id,
          quantity: c.quantity,
          price: c.price,
          name: c.name,
          cost_price: c.cost_price,
          sku: c.sku,
        })),
        total: subtotal,
        subtotal,
        customer_id: customer?.id || null,
        payment_method: paymentMethod,
        taxes: [],
        service_charges_applied: [],
        tax_rate: 0,
        tax_amount: 0,
        service_charge: 0,
        timestamp: new Date().toISOString(),
      };
      const created = await handlers.sales.add(saleData);
      toast({
        title: 'Order created',
        description: `$${subtotal.toFixed(2)}${customer?.name ? ` · ${customer.name}` : ''}`,
      });
      setCart([]);
      setQuery('');
      onCreated?.(created);
    } catch (e) {
      toast({ title: 'Failed to create order', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const ProductTile = ({ p }) => (
    <button
      type="button"
      onClick={() => addToCart(p)}
      className="group text-left bg-card border rounded-xl p-3 hover:shadow-md hover:border-primary/40 transition flex flex-col gap-1 min-h-[96px]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium line-clamp-2 leading-tight flex-1">
          {p.name || 'Item'}
        </div>
        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
      </div>
      {p.sku && (
        <div className="text-[10px] text-muted-foreground truncate">{p.sku}</div>
      )}
      <div className="mt-auto pt-1 flex items-center justify-between">
        <span className="text-base font-semibold tabular-nums">
          ${Number(p.price || 0).toFixed(2)}
        </span>
        {typeof p.stock_quantity === 'number' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            p.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {p.stock_quantity > 0 ? `${p.stock_quantity} left` : 'Out'}
          </span>
        )}
      </div>
    </button>
  );

  const CartList = () => (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {cart.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <div className="text-sm text-muted-foreground">Cart is empty</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Tap a product to add it
            </div>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {cart.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center gap-2 px-3 py-2.5 border-b last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  ${item.price.toFixed(2)} each
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => incQty(item.product_id, -1)}
                  className="w-7 h-7 rounded-md border hover:bg-muted flex items-center justify-center"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-sm tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => incQty(item.product_id, 1)}
                  className="w-7 h-7 rounded-md border hover:bg-muted flex items-center justify-center"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="w-16 text-right text-sm font-medium tabular-nums">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
              <button
                onClick={() => removeItem(item.product_id)}
                className="text-muted-foreground hover:text-red-600 p-1"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );

  const PaymentAndTotals = () => (
    <div className="border-t p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Subtotal</span>
        <span className="text-sm tabular-nums">${subtotal.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">Total</span>
        <span className="text-2xl font-bold tabular-nums">${subtotal.toFixed(2)}</span>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Payment method
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id)}
              className={`px-2 py-2 rounded-md text-xs font-medium border transition ${
                paymentMethod === m.id
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-background hover:bg-muted border-border'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCart([])}
          disabled={submitting || cart.length === 0}
        >
          <X className="w-4 h-4 mr-1" /> Clear
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || cart.length === 0}
          className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-1.5" />
          )}
          Create order
        </Button>
      </div>
    </div>
  );

  if (large) {
    return (
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-5 h-5" /> Products
              </CardTitle>
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, SKU, or barcode…"
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                {filtered.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    {query ? 'No products match.' : 'No products available.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                    {filtered.map((p) => <ProductTile key={p.id} p={p} />)}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" /> Order
                {customer?.name && (
                  <span className="text-xs font-normal text-muted-foreground">
                    · {customer.name}
                  </span>
                )}
              </CardTitle>
              {cart.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {cart.reduce((acc, c) => acc + c.quantity, 0)} item{cart.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {!customer && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-900 mt-2">
                No customer linked — order will be unassigned.
              </div>
            )}
          </CardHeader>
          <CartList />
          <PaymentAndTotals />
        </Card>
      </div>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> New order
            {customer?.name && (
              <span className="text-xs font-normal text-muted-foreground">
                · {customer.name}
              </span>
            )}
          </CardTitle>
          {cart.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {cart.length} item{cart.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 min-h-0 flex flex-col">
        {!customer && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
            No customer linked — order will be unassigned.
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="pl-9 h-9"
          />
        </div>

        {query && (
          <div className="border rounded-lg max-h-56 overflow-hidden">
            <ScrollArea className="max-h-56">
              {filtered.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">No products match.</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 border-b last:border-b-0 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      {p.sku && (<div className="text-[11px] text-muted-foreground">{p.sku}</div>)}
                    </div>
                    <div className="text-sm font-medium tabular-nums">${Number(p.price || 0).toFixed(2)}</div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>
        )}

        {cart.length > 0 && (
          <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex">
            <ScrollArea className="flex-1">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground">${item.price.toFixed(2)} each</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => incQty(item.product_id, -1)} className="w-6 h-6 rounded-md border hover:bg-muted flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-sm tabular-nums">{item.quantity}</span>
                    <button onClick={() => incQty(item.product_id, 1)} className="w-6 h-6 rounded-md border hover:bg-muted flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="w-16 text-right text-sm font-medium tabular-nums">${(item.price * item.quantity).toFixed(2)}</div>
                  <button onClick={() => removeItem(item.product_id)} className="text-muted-foreground hover:text-red-600 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {cart.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-1 border-t">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-semibold tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`px-2 py-1.5 rounded-md text-xs border transition ${
                    paymentMethod === m.id
                      ? 'bg-primary text-primary-foreground border-transparent'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setCart([])} disabled={submitting}>
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? (<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />) : (<Check className="w-4 h-4 mr-1.5" />)}
                Create order
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickOrderPanel;
