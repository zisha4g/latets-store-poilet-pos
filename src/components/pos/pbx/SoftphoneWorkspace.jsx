// SoftphoneWorkspace — Google-Voice-style embedded softphone view.
//
// Two-pane layout:
//   - Left/main: dynamic context area (idle = recent calls, ringing = answer
//     screen, in-call = caller info + customer panel + call controls + notes).
//   - Right: persistent dialer (number display + keypad + call button).
//
// While this component is mounted the floating SoftphonePanel modal is
// suppressed (registerEmbedded in SoftphoneContext) so the embedded UI
// fully owns the experience.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Mic, MicOff, Grid3x3, Delete, Pause, Play, ArrowRightLeft, UserPlus,
  StickyNote, History, Wifi, WifiOff, Loader2, User, ShoppingBag,
  ExternalLink, Check, X, ChevronLeft, ChevronRight, CreditCard,
  MapPin, FileText, Package, Receipt, ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QuickCreateCustomerDialog } from '@/components/customers/QuickCreateCustomerDialog';
import QuickOrderPanel from '@/components/pos/pbx/QuickOrderPanel';
import { useSoftphone } from '@/contexts/SoftphoneContext';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import {
  callCounterparty, formatPhone, statusLabel,
} from '@/components/pos/pbx/callFormat';

const DTMF_KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

const digitsOnly = (s) => String(s || '').replace(/[^\d]/g, '');

const Keypad = ({ onPress, compact = false }) => (
  <div className={`grid grid-cols-3 gap-2 ${compact ? '' : 'gap-2.5'}`}>
    {DTMF_KEYS.map(([k, sub]) => (
      <button
        key={k}
        type="button"
        onClick={() => onPress(k)}
        className={`flex flex-col items-center justify-center rounded-xl bg-muted/60 hover:bg-muted active:scale-95 transition shadow-sm ${
          compact ? 'h-12' : 'h-14'
        }`}
      >
        <span className={`font-semibold leading-none ${compact ? 'text-lg' : 'text-xl'}`}>{k}</span>
        {sub && <span className="text-[10px] mt-1 text-muted-foreground tracking-widest">{sub}</span>}
      </button>
    ))}
  </div>
);

const CallTimer = ({ startedAt, className = '' }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return null;
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
};

const StatusChip = ({ status }) => {
  if (status === 'registered') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <Wifi className="w-3.5 h-3.5" /> Connected
      </span>
    );
  }
  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting…
      </span>
    );
  }
  if (status === 'no-credentials') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <WifiOff className="w-3.5 h-3.5" /> Not configured
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
      <WifiOff className="w-3.5 h-3.5" /> Disconnected
    </span>
  );
};

const RecentCallRow = ({ log, onCall }) => {
  const isOut = log.direction === 'outbound';
  const isFailed = ['missed', 'no-answer', 'failed', 'busy', 'canceled', 'declined'].includes(log.status);
  const Icon = isFailed ? PhoneMissed : isOut ? PhoneOutgoing : PhoneIncoming;
  const when = log.started_at || log.created_at;
  const counterparty = callCounterparty(log) || 'Unknown';
  const rawNumber = isOut ? (log.to_number || log.phone_number) : (log.from_number || log.phone_number);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/40 group">
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
        isFailed ? 'bg-red-50 text-red-600' : isOut ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{counterparty}</div>
        <div className="text-xs text-muted-foreground truncate">
          {isOut ? 'Outgoing' : 'Incoming'} · {statusLabel(log.status)}
          {when ? ` · ${new Date(when).toLocaleString([], {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })}` : ''}
        </div>
      </div>
      {rawNumber && (
        <Button
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition"
          onClick={() => onCall(rawNumber)}
          title="Call back"
        >
          <Phone className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

const OrderHistoryView = ({ orders, selectedOrderId, onSelect, handlers, onCustomerMissing }) => {
  const selected = useMemo(
    () => (orders || []).find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  if (onCustomerMissing) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-sm text-muted-foreground p-8">
          <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Add the caller as a customer to see their order history.
        </div>
      </Card>
    );
  }
  if (!orders || orders.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-sm text-muted-foreground p-8">
          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
          This customer has no previous orders yet.
        </div>
      </Card>
    );
  }

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Orders ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <ScrollArea className="h-full">
            {orders.map((o) => {
              const isSel = selectedOrderId === o.id;
              const date = o.created_at ? new Date(o.created_at) : null;
              return (
                <button
                  key={o.id}
                  onClick={() => onSelect(o.id)}
                  className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 transition ${
                    isSel ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">#{String(o.id).slice(0, 8)}</div>
                    <div className="text-sm font-semibold tabular-nums">
                      ${Number(o.total || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <div className="text-[11px] text-muted-foreground">
                      {date ? date.toLocaleString([], {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      }) : '—'}
                    </div>
                    {o.payment_method && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
                        {o.payment_method}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {Array.isArray(o.items) ? `${o.items.length} item${o.items.length === 1 ? '' : 's'}` : '—'}
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex flex-col min-h-0">
        {!selected ? (
          <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Select an order to view details
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="pb-2 border-b">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="w-5 h-5" /> Order #{String(selected.id).slice(0, 8)}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selected.created_at ? new Date(selected.created_at).toLocaleString() : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">
                    ${Number(selected.total || 0).toFixed(2)}
                  </div>
                  {selected.payment_method && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] px-2 py-0.5 rounded-full bg-muted">
                      <CreditCard className="w-3 h-3" /> {selected.payment_method}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto space-y-3 pt-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Items
                </div>
                {Array.isArray(selected.items) && selected.items.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    {selected.items.map((it, idx) => (
                      <div key={idx} className="flex items-center px-3 py-2 border-b last:border-b-0 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{it.name || 'Item'}</div>
                          {it.sku && (
                            <div className="text-[11px] text-muted-foreground">{it.sku}</div>
                          )}
                        </div>
                        <div className="w-12 text-center text-muted-foreground">×{it.quantity}</div>
                        <div className="w-20 text-right tabular-nums">
                          ${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No item details.</div>
                )}
              </div>

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">${Number(selected.subtotal || 0).toFixed(2)}</span>
                </div>
                {Number(selected.tax_amount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="tabular-nums">${Number(selected.tax_amount).toFixed(2)}</span>
                  </div>
                )}
                {Number(selected.service_charge || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service charge</span>
                    <span className="tabular-nums">${Number(selected.service_charge).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Total</span>
                  <span className="tabular-nums">${Number(selected.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `Order #${String(selected.id).slice(0, 8)} — $${Number(selected.total || 0).toFixed(2)}`,
                      );
                      toast({ title: 'Order summary copied' });
                    } catch { /* noop */ }
                  }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Copy summary
                </Button>
                {handlers?.sales?.delete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                    onClick={async () => {
                      if (!window.confirm('Void this order? This cannot be undone.')) return;
                      try {
                        await handlers.sales.delete(selected.id);
                        toast({ title: 'Order voided' });
                        onSelect(null);
                      } catch (e) {
                        toast({ title: 'Failed to void', description: e.message, variant: 'destructive' });
                      }
                    }}
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" /> Void
                  </Button>
                )}
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

const SoftphoneWorkspace = ({ callLogs = [], customers = [], sales = [], products = [], handlers = null }) => {
  const {
    status, activeCall, incomingCall,
    dial, hangup, sendDigits, setMuted, setHold, transfer,
    answer, decline, expectIncomingAccept,
    registerEmbedded,
  } = useSoftphone();
  const { user } = useAuth() || {};
  const userId = user?.id;
  const navigate = useNavigate();

  // Suppress floating modal while we are mounted.
  useEffect(() => {
    if (!registerEmbedded) return undefined;
    const unregister = registerEmbedded();
    return unregister;
  }, [registerEmbedded]);

  // ---------- inbound ring tracking (mirrors SoftphonePanel logic) ---------
  const [inboundRing, setInboundRing] = useState(null);
  const dismissTimerRef = useRef(null);
  const [bridging, setBridging] = useState(false);

  const dismissRing = () => {
    setInboundRing(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!userId) return undefined;
    const channel = supabase
      .channel(`pbx-ring-workspace-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pbx_ring_events' },
        (payload) => {
          const row = payload?.new;
          if (!row) return;
          const targetMe =
            row.assigned_user_id === userId || (!row.assigned_user_id && row.user_id === userId);
          if (!targetMe) return;
          if (row.event_type === 'ring_start') {
            const callId = row.metadata?.provider_call_id || null;
            setInboundRing((prev) => {
              if (prev && prev.providerCallId && callId && prev.providerCallId === callId) return prev;
              return {
                sessionId: row.call_session_id,
                ext: row.extension_number,
                from: row.from_number,
                name: row.caller_name,
                providerCallId: callId,
                startedAt: Date.now(),
              };
            });
            const ringSecs = Math.max(5, Math.min(120, Number(row.ring_timeout_secs) || 25));
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = setTimeout(() => setInboundRing(null), (ringSecs + 5) * 1000);
          } else if (['ring_stop', 'answered', 'declined', 'timeout'].includes(row.event_type)) {
            setInboundRing((prev) => {
              if (!prev) return prev;
              if (prev.sessionId && row.call_session_id && prev.sessionId !== row.call_session_id) return prev;
              return null;
            });
          }
        },
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch { /* noop */ }
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [userId]);

  useEffect(() => {
    if (activeCall) {
      dismissRing();
      setBridging(false);
    }
  }, [activeCall]);

  // ---------- local state ----------
  const [dialNumber, setDialNumber] = useState('');
  const [muted, setMutedLocal] = useState(false);
  const [held, setHeldLocal] = useState(false);
  const [showKeypadInCall, setShowKeypadInCall] = useState(false);
  const [callStarted, setCallStarted] = useState(null);
  const [callerLabel, setCallerLabel] = useState('');
  const [calling, setCalling] = useState(false);
  const [notes, setNotes] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [recentOrderIds, setRecentOrderIds] = useState([]);
  const [inCallTab, setInCallTab] = useState('order');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [dialerCollapsed, setDialerCollapsed] = useState(false);

  // Refs so we can capture the call snapshot at the moment of hangup.
  const callSnapshotRef = useRef(null);
  const lastCallSavedRef = useRef(null);
  // Direction and dialed target are known at the moment we initiate/answer,
  // not from the SIP.js Session itself. We stash them in refs so the
  // snapshot effect can pick them up when activeCall arrives.
  const pendingDirectionRef = useRef('outbound');
  const pendingTargetRef = useRef('');

  useEffect(() => {
    if (!activeCall) {
      // Call just ended (or never started this render). If we have a captured
      // snapshot, persist it as a pbx_call_logs row so notes/customer linkage
      // are saved before we clear UI state.
      const snap = callSnapshotRef.current;
      if (snap && handlers?.pbx?.call_logs?.add && snap.id !== lastCallSavedRef.current) {
        const endedAt = new Date();
        const startedAt = snap.startedAt ? new Date(snap.startedAt) : endedAt;
        const durationSecs = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
        const hasMeaningfulData =
          (snap.notes && snap.notes.trim().length > 0)
          || snap.customerId
          || durationSecs > 1;
        if (hasMeaningfulData) {
          lastCallSavedRef.current = snap.id;
          const row = {
            phone_number: snap.counterpartyNumber || '',
            from_number: snap.from || '',
            to_number: snap.to || '',
            direction: snap.direction,
            status: durationSecs > 0 ? 'completed' : 'no-answer',
            duration_seconds: durationSecs,
            started_at: startedAt.toISOString(),
            ended_at: endedAt.toISOString(),
            notes: snap.notes || null,
            customer_id: snap.customerId || null,
          };
          handlers.pbx.call_logs.add(row)
            .then(() => {
              if ((snap.notes && snap.notes.trim()) || snap.customerId) {
                toast({ title: 'Call saved to log' });
              }
            })
            .catch((e) => {
              console.warn('[softphone] save call log failed', e);
            });
        }
      }
      callSnapshotRef.current = null;
      setMutedLocal(false);
      setHeldLocal(false);
      setCallStarted(null);
      setCallerLabel('');
      setShowKeypadInCall(false);
      setShowTransfer(false);
      setTransferTarget('');
      setNotes('');
      setRecentOrderIds([]);
      setInCallTab('order');
      setSelectedOrderId(null);
      return;
    }
    const started = (prev) => prev || Date.now();
    setCallStarted(started);
    try {
      const det = activeCall?.callDetails || activeCall?.options || {};
      const label = det.to || det.target || det.caller_id_number || det.from_number;
      if (label) setCallerLabel(String(label));
    } catch { /* ignore */ }
    // Initialise (or refresh) the snapshot for this session.
    if (!callSnapshotRef.current || callSnapshotRef.current.id !== activeCall.id) {
      const dir = pendingDirectionRef.current || 'outbound';
      const target = pendingTargetRef.current || '';
      callSnapshotRef.current = {
        id: activeCall.id || `local-${Date.now()}`,
        startedAt: Date.now(),
        direction: dir,
        from: dir === 'inbound' ? (target || '') : '',
        to: dir === 'outbound' ? (target || '') : '',
        counterpartyNumber: target || '',
        notes: '',
        customerId: null,
      };
      pendingTargetRef.current = '';
    }
  }, [activeCall, handlers]);

  const inCall = !!activeCall;
  const ringing = (!!incomingCall || !!inboundRing) && !inCall;

  // ---------- derived: counterparty + customer match ----------
  const counterpartyNumber = useMemo(() => {
    if (inCall) return callerLabel;
    if (incomingCall) {
      const d = incomingCall.details || {};
      return d.caller_id_number || d.from || '';
    }
    if (inboundRing) return inboundRing.from || '';
    return '';
  }, [inCall, callerLabel, incomingCall, inboundRing]);

  const counterpartyName = useMemo(() => {
    if (incomingCall) {
      const d = incomingCall.details || {};
      if (d.caller_id_name) return d.caller_id_name;
    }
    if (inboundRing?.name) return inboundRing.name;
    return '';
  }, [incomingCall, inboundRing]);

  const matchedCustomer = useMemo(() => {
    if (!counterpartyNumber || !Array.isArray(customers) || customers.length === 0) return null;
    const target = digitsOnly(counterpartyNumber).slice(-10);
    if (target.length < 7) return null;
    return customers.find((c) => {
      const candidates = [c.phone, c.mobile, c.phone_number, c.cell_phone].filter(Boolean);
      return candidates.some((p) => digitsOnly(p).slice(-10) === target);
    }) || null;
  }, [counterpartyNumber, customers]);

  // ---------- handlers ----------
  const handleKey = (digit) => {
    if (inCall) sendDigits(digit);
    else setDialNumber((prev) => prev + digit);
  };

  const handleBackspace = () => setDialNumber((prev) => prev.slice(0, -1));

  const handleDial = async (override) => {
    const num = (override || dialNumber).trim();
    if (!num) return;
    if (status !== 'registered') {
      toast({ title: 'Softphone not connected yet', variant: 'destructive' });
      return;
    }
    setCalling(true);
    try {
      setCallerLabel(num);
      pendingDirectionRef.current = 'outbound';
      pendingTargetRef.current = num;
      await dial(num);
      setDialNumber('');
    } catch (e) {
      toast({ title: 'Call failed', description: e.message, variant: 'destructive' });
    } finally {
      setCalling(false);
    }
  };

  const handleAnswerRing = async () => {
    if (incomingCall) {
      pendingDirectionRef.current = 'inbound';
      try { await answer(); } catch (e) { console.error('[softphone] answer failed', e); }
      return;
    }
    const callId = inboundRing?.providerCallId;
    if (!callId) {
      toast({ title: 'Cannot answer here', description: 'Pick up on your desk phone.' });
      return;
    }
    if (status !== 'registered') {
      toast({ title: 'Browser softphone not ready', description: 'Pick up on your desk phone.' });
      return;
    }
    setBridging(true);
    pendingDirectionRef.current = 'inbound';
    try { expectIncomingAccept?.(20000); } catch { /* noop */ }
    try {
      const { error } = await supabase.functions.invoke('pbx-answer-in-browser', {
        body: { provider_call_id: callId },
      });
      if (error) throw error;
    } catch (e) {
      console.error('[softphone] bridge failed', e);
      toast({ title: 'Could not answer here', description: e?.message || 'Try the desk phone.' });
      setBridging(false);
    }
  };

  const handleDeclineRing = async () => {
    if (incomingCall) {
      try { await decline(); } catch { /* noop */ }
    }
    dismissRing();
  };

  const toggleMute = async () => {
    const next = !muted;
    setMutedLocal(next);
    await setMuted(next);
  };

  const toggleHold = async () => {
    const next = !held;
    setHeldLocal(next);
    try {
      await setHold(next);
    } catch (e) {
      console.warn('[softphone] hold failed', e);
    }
  };

  const handleTransfer = async () => {
    const target = transferTarget.trim();
    if (!target) return;
    setTransferring(true);
    try {
      await transfer(target);
      toast({ title: 'Transferring call', description: `Sent to ${target}` });
      setShowTransfer(false);
      setTransferTarget('');
    } catch (e) {
      toast({ title: 'Transfer failed', description: e?.message || 'Could not transfer', variant: 'destructive' });
    } finally {
      setTransferring(false);
    }
  };

  const handleAddCustomerCreated = (created) => {
    if (created?.id && callSnapshotRef.current) {
      callSnapshotRef.current.customerId = created.id;
    }
  };

  // Keep the snapshot's mutable fields in sync with current state so the
  // hangup effect captures the latest values.
  useEffect(() => {
    if (!callSnapshotRef.current) return;
    callSnapshotRef.current.notes = notes;
    if (counterpartyNumber) {
      callSnapshotRef.current.counterpartyNumber = counterpartyNumber;
      if (callSnapshotRef.current.direction === 'outbound' && !callSnapshotRef.current.to) {
        callSnapshotRef.current.to = counterpartyNumber;
      }
      if (callSnapshotRef.current.direction === 'inbound' && !callSnapshotRef.current.from) {
        callSnapshotRef.current.from = counterpartyNumber;
      }
    }
    if (matchedCustomer?.id) {
      callSnapshotRef.current.customerId = matchedCustomer.id;
    }
  }, [notes, counterpartyNumber, matchedCustomer]);

  // ---------- order history for matched customer ----------
  const customerOrders = useMemo(() => {
    if (!matchedCustomer?.id || !Array.isArray(sales)) return [];
    return sales
      .filter((s) => s.customer_id === matchedCustomer.id)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [matchedCustomer, sales]);

  const customerStats = useMemo(() => {
    if (!matchedCustomer?.id || !Array.isArray(sales)) return null;
    const list = sales.filter((s) => s.customer_id === matchedCustomer.id);
    const total = list.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    return { count: list.length, total };
  }, [matchedCustomer, sales]);


  const recentLogs = useMemo(() => {
    const list = Array.isArray(callLogs) ? callLogs.slice() : [];
    list.sort((a, b) => {
      const ta = new Date(a.started_at || a.created_at || 0).getTime();
      const tb = new Date(b.started_at || b.created_at || 0).getTime();
      return tb - ta;
    });
    return list.slice(0, 12);
  }, [callLogs]);

  // ---------- pieces ----------
  const Avatar = ({ name, size = 'lg' }) => {
    const initial = (name || '#').trim().charAt(0).toUpperCase();
    const dim = size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-12 h-12 text-lg';
    return (
      <div className={`rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-semibold shadow-lg ${dim}`}>
        {initial}
      </div>
    );
  };

  const CustomerPanel = ({ large = false }) => {
    if (!counterpartyNumber) return null;
    if (matchedCustomer) {
      return (
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-2 ${large ? 'text-base' : 'text-sm'}`}>
                <User className={large ? 'w-5 h-5' : 'w-4 h-4'} /> Customer details
              </CardTitle>
              {customerStats && customerStats.count > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {customerStats.count} order{customerStats.count === 1 ? '' : 's'} · ${customerStats.total.toFixed(2)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-3">
              <Avatar name={matchedCustomer.name} size="sm" />
              <div className="min-w-0">
                <div className="font-semibold truncate">{matchedCustomer.name || 'Customer'}</div>
                {matchedCustomer.email && (
                  <div className="text-xs text-muted-foreground truncate">{matchedCustomer.email}</div>
                )}
                {matchedCustomer.phone && (
                  <div className="text-xs text-muted-foreground">{formatPhone(matchedCustomer.phone)}</div>
                )}
              </div>
            </div>

            {matchedCustomer.address && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                {matchedCustomer.address}
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col border-t pt-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <ShoppingBag className="w-3 h-3" /> Order history
                {customerOrders.length > 0 && (
                  <span className="text-muted-foreground/70">({customerOrders.length})</span>
                )}
              </div>
              {customerOrders.length > 0 ? (
                <ScrollArea className="flex-1 min-h-0 pr-2">
                  <ul className="space-y-1">
                    {customerOrders.map((s) => (
                      <li key={s.id} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
                        <span className="truncate text-muted-foreground">
                          {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Order'}
                          {s.id ? ` · #${String(s.id).slice(0, 6)}` : ''}
                        </span>
                        <span className="tabular-nums font-medium">
                          ${Number(s.total || 0).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <div className="text-[11px] text-muted-foreground">
                  No previous orders.
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="justify-start text-xs"
              onClick={() => navigate('/app/customers')}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in customers
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Unknown caller
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs text-muted-foreground">
            No customer record matched {formatPhone(counterpartyNumber)}.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddCustomer(true)}
            disabled={!handlers?.customers?.add}
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Add as customer
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderMain = () => {
    if (ringing) {
      return (
        <motion.div
          key="ring"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-full flex flex-col items-center justify-center gap-6 p-8"
        >
          <div className="text-xs uppercase tracking-widest text-amber-600 animate-pulse">
            Incoming call
          </div>
          <Avatar name={counterpartyName || counterpartyNumber} />
          <div className="text-center">
            <div className="text-2xl font-semibold">
              {counterpartyName || formatPhone(counterpartyNumber) || 'Unknown caller'}
            </div>
            {counterpartyName && counterpartyNumber && (
              <div className="text-sm text-muted-foreground mt-1">
                {formatPhone(counterpartyNumber)}
              </div>
            )}
            {matchedCustomer && (
              <Badge variant="secondary" className="mt-3">
                Matched customer · {matchedCustomer.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleDeclineRing}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition active:scale-95"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button
              onClick={handleAnswerRing}
              disabled={bridging}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white flex items-center justify-center shadow-lg transition active:scale-95"
              title="Answer"
            >
              {bridging ? <Loader2 className="w-6 h-6 animate-spin" /> : <Phone className="w-6 h-6" />}
            </button>
          </div>
          {!incomingCall && inboundRing && (
            <div className="text-[11px] text-muted-foreground">
              You can also pick up on your desk phone.
            </div>
          )}
        </motion.div>
      );
    }

    if (inCall) {
      const tabs = [
        { id: 'customer', label: 'Customer', icon: User },
        { id: 'order', label: 'New Order', icon: ShoppingBag },
        { id: 'history', label: 'Order History', icon: History, count: customerOrders.length },
        { id: 'notes', label: 'Notes', icon: StickyNote },
      ];
      return (
        <motion.div
          key="incall"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-full flex flex-col"
        >
          {/* Compact call header strip */}
          <div className="px-4 py-2.5 border-b border-border bg-gradient-to-r from-emerald-50 to-transparent flex items-center gap-3">
            <Avatar name={matchedCustomer?.name || counterpartyName || counterpartyNumber} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">On call</span>
                <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <CallTimer startedAt={callStarted} className="text-xs text-emerald-700 font-medium" />
              </div>
              <div className="font-semibold truncate">
                {matchedCustomer?.name || counterpartyName || formatPhone(counterpartyNumber) || 'Active call'}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatPhone(counterpartyNumber)}
              </div>
            </div>

            {/* Inline call controls — compact icon buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMute}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition ${
                  muted ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background hover:bg-muted border-border'
                }`}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowKeypadInCall((v) => !v)}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition ${
                  showKeypadInCall ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background hover:bg-muted border-border'
                }`}
                title="Keypad"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleHold}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition ${
                  held ? 'bg-amber-500 text-white border-transparent' : 'bg-background hover:bg-muted border-border'
                }`}
                title={held ? 'Resume' : 'Hold'}
              >
                {held ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowTransfer((v) => !v)}
                className={`w-10 h-10 rounded-lg border flex items-center justify-center transition ${
                  showTransfer ? 'bg-primary text-primary-foreground border-transparent' : 'bg-background hover:bg-muted border-border'
                }`}
                title="Transfer"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => hangup()}
                className="ml-2 h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow transition active:scale-95"
                title="End call"
              >
                <PhoneOff className="w-4 h-4" />
                <span className="text-sm font-medium">End</span>
              </button>
            </div>
          </div>

          {/* Transfer & in-call keypad popovers (don't push content) */}
          {showTransfer && (
            <div className="px-4 py-2 border-b bg-muted/30 flex gap-2 items-center">
              <Input
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                placeholder="Number or extension to transfer to"
                className="flex-1 h-9"
                onKeyDown={(e) => { if (e.key === 'Enter') handleTransfer(); }}
                autoFocus
              />
              <Button
                onClick={handleTransfer}
                disabled={!transferTarget.trim() || transferring}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span className="ml-1.5">Transfer</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowTransfer(false); setTransferTarget(''); }}
                size="icon"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {showKeypadInCall && (
            <div className="px-4 py-3 border-b bg-muted/30 flex justify-center">
              <div className="w-64">
                <Keypad onPress={handleKey} compact />
              </div>
            </div>
          )}

          {/* Tab nav */}
          <div className="flex items-center gap-0 border-b border-border bg-card px-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setInCallTab(t.id); if (t.id !== 'history') setSelectedOrderId(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition ${
                  inCallTab === t.id
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {typeof t.count === 'number' && t.count > 0 && (
                  <span className={`ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold ${
                    inCallTab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
            {recentOrderIds.length > 0 && (
              <div className="ml-auto pr-2 flex items-center gap-1.5 text-xs text-emerald-700">
                <Check className="w-3.5 h-3.5" />
                {recentOrderIds.length} order{recentOrderIds.length === 1 ? '' : 's'} this call
              </div>
            )}
          </div>

          {/* Big tab content */}
          <div className="flex-1 min-h-0 overflow-hidden bg-muted/20">
            {inCallTab === 'customer' && (
              <div className="h-full p-4 overflow-auto">
                <CustomerPanel large />
              </div>
            )}
            {inCallTab === 'order' && (
              <div className="h-full p-4">
                <QuickOrderPanel
                  products={products}
                  customer={matchedCustomer}
                  handlers={handlers}
                  large
                  onCreated={(s) => {
                    if (s?.id) setRecentOrderIds((prev) => [...prev, s.id]);
                    toast({
                      title: 'Order saved during call',
                      description: `Total $${Number(s?.total || 0).toFixed(2)}`,
                    });
                  }}
                />
              </div>
            )}
            {inCallTab === 'history' && (
              <div className="h-full p-4 overflow-hidden">
                <OrderHistoryView
                  orders={customerOrders}
                  selectedOrderId={selectedOrderId}
                  onSelect={setSelectedOrderId}
                  handlers={handlers}
                  onCustomerMissing={!matchedCustomer}
                />
              </div>
            )}
            {inCallTab === 'notes' && (
              <div className="h-full p-4 overflow-auto">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StickyNote className="w-4 h-4" /> Call notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <Textarea
                      placeholder="Jot down something about this call…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="flex-1 min-h-[200px] resize-none"
                    />
                    <div className="text-[11px] text-muted-foreground mt-2">
                      Saved to your call log automatically when the call ends.
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </motion.div>
      );
    }

    // Idle
    return (
      <motion.div
        key="idle"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-full flex flex-col p-6 gap-4"
      >
        <div>
          <h3 className="text-lg font-semibold">Ready to call</h3>
          <p className="text-sm text-muted-foreground">
            Use the dialer on the right, or call back from a recent log.
          </p>
        </div>
        <Card className="flex-1 min-h-0 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4" /> Recent calls
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full">
              {recentLogs.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-10">
                  No recent calls yet.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <RecentCallRow key={log.id} log={log} onCall={(num) => handleDial(num)} />
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="h-full flex gap-3 p-3 min-h-0">
      {/* Main pane */}
      <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <AnimatePresence mode="wait">
          {renderMain()}
        </AnimatePresence>
      </div>

      {/* Collapsed dialer rail (in-call only) */}
      {inCall && dialerCollapsed && (
        <button
          onClick={() => setDialerCollapsed(false)}
          className="w-10 shrink-0 rounded-2xl border border-border bg-card shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-muted/40 transition"
          title="Show dialer"
        >
          <ChevronLeft className="w-4 h-4" />
          <Phone className="w-4 h-4 text-muted-foreground" />
          <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-widest text-muted-foreground">
            Dialer
          </div>
        </button>
      )}

      {/* Dialer pane */}
      {(!inCall || !dialerCollapsed) && (
      <div className="w-[340px] shrink-0 rounded-2xl border border-border bg-card shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-sm">Dialer</div>
          <div className="flex items-center gap-2">
            <StatusChip status={status} />
            {inCall && (
              <button
                onClick={() => setDialerCollapsed(true)}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                title="Collapse dialer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col">
          <div className="relative">
            <input
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              placeholder="Enter a number"
              className="w-full h-14 px-4 pr-10 rounded-xl bg-muted/50 font-mono text-2xl text-center outline-none focus:ring-2 focus:ring-primary/40"
              onKeyDown={(e) => { if (e.key === 'Enter') handleDial(); }}
            />
            {dialNumber && (
              <button
                onClick={handleBackspace}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-muted text-muted-foreground"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
              </button>
            )}
          </div>

          <Keypad onPress={handleKey} />

          <Button
            onClick={() => handleDial()}
            disabled={!dialNumber.trim() || status !== 'registered' || calling || inCall || ringing}
            className="w-full h-12 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md"
          >
            <Phone className="w-5 h-5 mr-2" />
            {calling ? 'Calling…' : inCall ? 'On call' : ringing ? 'Ringing…' : 'Call'}
          </Button>

          {status !== 'registered' && (
            <div className="text-[11px] text-center text-muted-foreground">
              {status === 'connecting'
                ? 'Connecting to network…'
                : status === 'no-credentials'
                  ? 'Softphone is not configured.'
                  : `Status: ${status}`}
            </div>
          )}
        </div>
      </div>
      )}

      {handlers?.customers?.add && (
        <QuickCreateCustomerDialog
          isOpen={showAddCustomer}
          onClose={() => setShowAddCustomer(false)}
          onCreated={handleAddCustomerCreated}
          handlers={handlers}
          defaultName={counterpartyName || ''}
          defaultPhone={counterpartyNumber || ''}
        />
      )}
    </div>
  );
};

export default SoftphoneWorkspace;
