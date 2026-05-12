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
  ExternalLink, Check, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { QuickCreateCustomerDialog } from '@/components/customers/QuickCreateCustomerDialog';
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

const SoftphoneWorkspace = ({ callLogs = [], customers = [], sales = [], handlers = null }) => {
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
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5);
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

  const CustomerPanel = () => {
    if (!counterpartyNumber) return null;
    if (matchedCustomer) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4" /> Customer
              </CardTitle>
              {customerStats && customerStats.count > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {customerStats.count} order{customerStats.count === 1 ? '' : 's'} · ${customerStats.total.toFixed(2)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="font-semibold">{matchedCustomer.name || 'Customer'}</div>
              {matchedCustomer.email && (
                <div className="text-xs text-muted-foreground truncate">{matchedCustomer.email}</div>
              )}
              {matchedCustomer.phone && (
                <div className="text-xs text-muted-foreground">{formatPhone(matchedCustomer.phone)}</div>
              )}
            </div>

            {customerOrders.length > 0 ? (
              <div className="border-t pt-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <ShoppingBag className="w-3 h-3" /> Recent orders
                </div>
                <ul className="space-y-1">
                  {customerOrders.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-xs">
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
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground border-t pt-2">
                No previous orders.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/app/pos')}
              >
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5" /> New order
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/app/customers')}
                title="Open customers"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
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
      return (
        <motion.div
          key="incall"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-full flex flex-col p-6 gap-5"
        >
          {/* Caller hero */}
          <div className="flex items-center gap-5">
            <Avatar name={matchedCustomer?.name || counterpartyName || counterpartyNumber} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-emerald-700">On call</div>
              <div className="text-2xl font-semibold truncate">
                {matchedCustomer?.name || counterpartyName || formatPhone(counterpartyNumber) || 'Active call'}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatPhone(counterpartyNumber)}
              </div>
              <div className="mt-1 text-sm">
                <CallTimer startedAt={callStarted} className="text-emerald-700 font-medium" />
              </div>
            </div>
            <button
              onClick={() => hangup()}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition active:scale-95"
              title="End call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>

          {/* Call controls */}
          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={toggleMute}
              className={`flex flex-col items-center justify-center h-16 rounded-xl border transition ${
                muted
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-background hover:bg-muted border-border'
              }`}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span className="text-[11px] mt-1">{muted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              onClick={() => setShowKeypadInCall((v) => !v)}
              className={`flex flex-col items-center justify-center h-16 rounded-xl border transition ${
                showKeypadInCall
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-background hover:bg-muted border-border'
              }`}
            >
              <Grid3x3 className="w-5 h-5" />
              <span className="text-[11px] mt-1">Keypad</span>
            </button>
            <button
              onClick={toggleHold}
              className={`flex flex-col items-center justify-center h-16 rounded-xl border transition ${
                held
                  ? 'bg-amber-500 text-white border-transparent'
                  : 'bg-background hover:bg-muted border-border'
              }`}
              title={held ? 'Resume call' : 'Hold call'}
            >
              {held ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              <span className="text-[11px] mt-1">{held ? 'Resume' : 'Hold'}</span>
            </button>
            <button
              onClick={() => setShowTransfer((v) => !v)}
              className={`flex flex-col items-center justify-center h-16 rounded-xl border transition ${
                showTransfer
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-background hover:bg-muted border-border'
              }`}
            >
              <ArrowRightLeft className="w-5 h-5" />
              <span className="text-[11px] mt-1">Transfer</span>
            </button>
            <button
              disabled
              className="flex flex-col items-center justify-center h-16 rounded-xl border border-border bg-background opacity-50"
              title="3-way call — coming soon"
            >
              <UserPlus className="w-5 h-5" />
              <span className="text-[11px] mt-1">Add</span>
            </button>
          </div>

          {showTransfer && (
            <div className="flex gap-2 items-center bg-muted/40 rounded-xl p-2">
              <Input
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                placeholder="Number or extension to transfer to"
                className="flex-1 h-10"
                onKeyDown={(e) => { if (e.key === 'Enter') handleTransfer(); }}
                autoFocus
              />
              <Button
                onClick={handleTransfer}
                disabled={!transferTarget.trim() || transferring}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
            <div className="max-w-xs">
              <Keypad onPress={handleKey} compact />
            </div>
          )}

          {/* Two-column: customer + notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-1">
            <CustomerPanel />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Call notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Jot down something about this call…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[110px] resize-none"
                />
                <div className="text-[11px] text-muted-foreground mt-1">
                  Saved to your call log when the call ends.
                </div>
              </CardContent>
            </Card>
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
    <div className="h-full flex gap-4 p-4 min-h-0">
      {/* Main pane */}
      <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <AnimatePresence mode="wait">
          {renderMain()}
        </AnimatePresence>
      </div>

      {/* Dialer pane (always visible) */}
      <div className="w-[340px] shrink-0 rounded-2xl border border-border bg-card shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-sm">Dialer</div>
          <StatusChip status={status} />
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
