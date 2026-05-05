import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Monitor, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useSoftphone } from '@/contexts/SoftphoneContext';

// Subscribe to pbx_ring_events for the current user. Whenever a `ring_start`
// row arrives we pop a non-blocking notification card in the lower-right
// corner. A subsequent `ring_stop` / `answered` / `timeout` row for the same
// `call_session_id` (or any newer event for the same extension) auto-dismisses
// it. We also auto-dismiss after the configured ring timeout in case the
// realtime stop event is missed.
//
// Two action buttons are surfaced:
//   - "Answer in browser" (Step 6 will hook this up to the WebRTC client SDK).
//     For now it just shows a toast — your desk phone is already ringing in
//     parallel, so picking that up is what actually answers the call.
//   - "Answer on desk phone" — informational; just dismisses the card.
//   - "Decline" — dismisses the card on this device only. Other ringers
//     (cell phone, voicemail fallback) keep going per the extension settings.
const formatPhone = (raw) => {
  if (!raw) return 'Unknown caller';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

const IncomingCallPopup = () => {
  const { user } = useAuth() || {};
  const [active, setActive] = useState(null); // { sessionId, ext, from, name, ringTimeoutSecs, startedAt }
  const dismissTimerRef = useRef(null);
  const { status: sipStatus, incomingCall, activeCall, answer, decline, hangup } = useSoftphone();

  const userId = user?.id;

  // If a SIP call rings via the WebRTC client (filter-resilient path: works
  // even if Supabase Realtime is blocked) surface it via the same popup.
  useEffect(() => {
    if (!incomingCall) return;
    // SignalWire SDK shape: { details: { caller_id_number, caller_id_name, ... } }
    // (legacy JsSIP shape supported as a fallback)
    const details = incomingCall.details || {};
    const remoteIdentity = incomingCall.remote_identity || {};
    const fromUri =
      details.caller_id_number ||
      details.from ||
      remoteIdentity?.uri?.user ||
      remoteIdentity?.uri?.toString?.() ||
      '';
    const display = details.caller_id_name || remoteIdentity?.display_name || '';
    setActive((prev) => prev || {
      sessionId: null,
      ext: '',
      from: fromUri,
      name: display,
      ringTimeoutSecs: 30,
      startedAt: Date.now(),
      sipDriven: true,
    });
  }, [incomingCall]);

  // Auto-dismiss when SIP session ends. Once a SIP call has been wired
  // through this popup (either we created the popup from the SIP invite OR
  // the SIP invite arrived after a Realtime ring_start) we consider the
  // popup tied to that call's lifecycle.
  const sawSipRef = useRef(false);
  useEffect(() => {
    if (incomingCall || activeCall) sawSipRef.current = true;
  }, [incomingCall, activeCall]);
  useEffect(() => {
    if (!activeCall && !incomingCall && sawSipRef.current) {
      sawSipRef.current = false;
      setActive(null);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    }
  }, [activeCall, incomingCall]);

  const dismiss = () => {
    setActive(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  // Realtime subscription. Listens to inserts on pbx_ring_events filtered to
  // events relevant to this user — either the row owner OR the extension's
  // assigned user. RLS already restricts what we can SELECT to those two
  // cases, so a simple `*` filter is fine.
  useEffect(() => {
    if (!userId) return undefined;
    const channel = supabase
      .channel(`pbx-ring-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pbx_ring_events' },
        (payload) => {
          const row = payload?.new;
          if (!row) return;
          // RLS already guarantees user_id=me OR assigned_user_id=me, but
          // double-check assignment so we don't pop on a coworker's ring.
          const targetMe =
            row.assigned_user_id === userId || (!row.assigned_user_id && row.user_id === userId);
          if (!targetMe) return;
          if (row.event_type === 'ring_start') {
            const ringSecs = Math.max(5, Math.min(120, Number(row.ring_timeout_secs) || 25));
            setActive({
              sessionId: row.call_session_id,
              ext: row.extension_number,
              from: row.from_number,
              name: row.caller_name,
              ringTimeoutSecs: ringSecs,
              startedAt: Date.now(),
              extLabel: row.metadata?.extension_name,
              channelLabel: row.metadata?.channel_label,
            });
            // Safety net: auto-dismiss if no stop event arrives in time.
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = setTimeout(() => {
              setActive(null);
            }, (ringSecs + 5) * 1000);
          } else if (
            ['ring_stop', 'answered', 'declined', 'timeout'].includes(row.event_type)
          ) {
            // Match on session id; fall back to extension number if missing.
            setActive((prev) => {
              if (!prev) return prev;
              if (prev.sessionId && row.call_session_id && prev.sessionId !== row.call_session_id) {
                return prev;
              }
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

  const pendingAnswerRef = useRef(false);
  const handleAnswerBrowser = () => {
    console.log('[popup] answer clicked, incomingCall:', !!incomingCall, 'sipStatus:', sipStatus);
    if (incomingCall) {
      answer();
      return;
    }
    if (sipStatus !== 'registered') {
      toast({
        title: 'Browser softphone not connected',
        description: 'Pick up on your desk phone or cell instead.',
      });
      return;
    }
    // SIP INVITE may not have reached us yet. Queue the answer for ~5s.
    pendingAnswerRef.current = true;
    toast({ title: 'Connecting…', description: 'Picking up the call.' });
    setTimeout(() => {
      if (pendingAnswerRef.current) {
        pendingAnswerRef.current = false;
        toast({ title: 'No active ring', description: 'The call may have already been answered elsewhere.' });
      }
    }, 5000);
  };

  // If a SIP INVITE arrives after the user already clicked Answer, pick it up.
  useEffect(() => {
    if (incomingCall && pendingAnswerRef.current) {
      pendingAnswerRef.current = false;
      answer();
    }
  }, [incomingCall, answer]);

  const handleHangup = () => {
    hangup();
    pendingAnswerRef.current = false;
    setActive(null);
  };

  const handleAnswerDesk = () => {
    pendingAnswerRef.current = false;
    toast({ title: 'Pick up on your desk phone to answer.' });
    dismiss();
  };

  const handleDecline = () => {
    pendingAnswerRef.current = false;
    if (incomingCall) decline();
    dismiss();
    toast({ title: 'Dismissed on this device', description: 'Other ringers continue.' });
  };

  const fromLabel = useMemo(() => formatPhone(active?.from), [active?.from]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed bottom-6 right-6 z-[1000] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden"
          role="dialog"
          aria-live="polite"
        >
          {/* Pulsing accent bar */}
          <div className="h-1 bg-emerald-500 relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-emerald-300/60"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Phone className="h-5 w-5" />
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Incoming call</p>
                  <p className="text-sm font-medium">
                    Ext {active.ext}{active.extLabel ? ` · ${active.extLabel}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-base font-semibold leading-tight">
                {active.name || fromLabel}
              </p>
              {active.name && active.from && (
                <p className="text-xs text-muted-foreground">{fromLabel}</p>
              )}
              {active.channelLabel && (
                <p className="text-[11px] text-muted-foreground mt-0.5">via {active.channelLabel}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {activeCall ? (
                <Button
                  size="sm"
                  onClick={handleHangup}
                  className="col-span-2 justify-center bg-red-600 hover:bg-red-700 text-white"
                >
                  <PhoneOff className="h-4 w-4 mr-1.5" />
                  Hang up
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAnswerBrowser}
                    className="justify-start"
                    disabled={sipStatus !== 'registered' && !incomingCall}
                  >
                    <Monitor className="h-4 w-4 mr-1.5" />
                    Browser
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAnswerDesk}
                    className="justify-start bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Phone className="h-4 w-4 mr-1.5" />
                    Desk phone
                  </Button>
                </>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDecline}
              className="w-full text-destructive hover:text-destructive"
            >
              <PhoneOff className="h-4 w-4 mr-1.5" />
              Dismiss
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallPopup;
