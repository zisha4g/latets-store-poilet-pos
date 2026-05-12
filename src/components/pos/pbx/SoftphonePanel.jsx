// SoftphonePanel — centered modal dialer / ring / in-call control UI.
//
// Visibility rules:
//   - Auto-shows when there's an active or incoming call.
//   - Otherwise only shows when the user explicitly opens it
//     (e.g. via the sidebar "Softphone" item → openPanel()).

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, Grid3x3, X, Delete, Headphones,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSoftphone } from '@/contexts/SoftphoneContext';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const formatPhone = (raw) => {
  if (!raw) return '';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

const DTMF_KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

const Keypad = ({ onPress }) => (
  <div className="grid grid-cols-3 gap-2.5">
    {DTMF_KEYS.map(([k, sub]) => (
      <button
        key={k}
        type="button"
        onClick={() => onPress(k)}
        className="flex flex-col items-center justify-center h-14 rounded-xl bg-muted/60 hover:bg-muted active:scale-95 transition shadow-sm"
      >
        <span className="text-xl font-semibold leading-none">{k}</span>
        {sub && <span className="text-[10px] mt-1 text-muted-foreground tracking-widest">{sub}</span>}
      </button>
    ))}
  </div>
);

const CallTimer = ({ startedAt }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return null;
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return <span className="font-mono text-sm opacity-90">{m}:{s.toString().padStart(2, '0')}</span>;
};

const SoftphonePanel = () => {
  const {
    status, activeCall, incomingCall,
    panelOpen, closePanel,
    dial, hangup, sendDigits, setMuted,
    answer, decline, expectIncomingAccept,
    embeddedActive,
  } = useSoftphone();
  const { user } = useAuth() || {};
  const userId = user?.id;

  // Inbound ring tracked via pbx_ring_events. The DID's LaML webhook
  // dials SIP/PSTN ringers — the browser doesn't get a native invite.
  // We surface the ring here, and on Answer we redirect the live call
  // into the user's Fabric subscriber via pbx-answer-in-browser, then
  // the SDK invite arrives and auto-accepts.
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
      .channel(`pbx-ring-panel-${userId}`)
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
            // Ignore duplicate ring_starts for an already-shown call.
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

  // Once we have an active call (either via SDK auto-accept after bridge,
  // or any other path) drop the ring banner.
  useEffect(() => {
    if (activeCall) {
      dismissRing();
      setBridging(false);
    }
  }, [activeCall]);

  const [dialNumber, setDialNumber] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [muted, setMutedLocal] = useState(false);
  const [callerLabel, setCallerLabel] = useState('');
  const [callStarted, setCallStarted] = useState(null);
  const [calling, setCalling] = useState(false);

  // Reset transient state when call ends.
  useEffect(() => {
    if (!activeCall) {
      setMutedLocal(false);
      setCallStarted(null);
      setCallerLabel('');
      setShowKeypad(false);
      return;
    }
    setCallStarted((prev) => prev || Date.now());
    try {
      const det = activeCall?.callDetails || activeCall?.options || {};
      const label = det.to || det.target || det.caller_id_number || det.from_number;
      if (label) setCallerLabel(String(label));
    } catch { /* ignore */ }
  }, [activeCall]);

  const inCall = !!activeCall;
  const ringing = (!!incomingCall || !!inboundRing) && !inCall;

  // Visibility: auto-show on ringing or active call; otherwise only when
  // the user explicitly opened the panel. When an embedded workspace owns
  // the UI (e.g. /pbx/softphone page) hide the floating modal entirely.
  const shouldShow = !embeddedActive && (inCall || ringing || panelOpen);
  if (!shouldShow) return null;

  const handleDial = async () => {
    const num = dialNumber.trim();
    if (!num) return;
    if (status !== 'registered') {
      toast({ title: 'Softphone not connected yet', variant: 'destructive' });
      return;
    }
    setCalling(true);
    try {
      setCallerLabel(num);
      await dial(num);
    } catch (e) {
      toast({ title: 'Call failed', description: e.message, variant: 'destructive' });
    } finally {
      setCalling(false);
    }
  };

  const handleKeypadPress = (digit) => {
    if (inCall) {
      sendDigits(digit);
    } else {
      setDialNumber((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setDialNumber((prev) => prev.slice(0, -1));
  };

  const toggleMute = async () => {
    const next = !muted;
    setMutedLocal(next);
    await setMuted(next);
  };

  const handleClose = () => {
    if (inCall || ringing) return; // can't close while ringing or in-call
    closePanel();
  };

  const ringingFromLabel = (() => {
    if (incomingCall) {
      const d = incomingCall.details || {};
      return d.caller_id_name || d.caller_id_number || d.from || '';
    }
    if (inboundRing) {
      return inboundRing.name || inboundRing.from || '';
    }
    return '';
  })();

  const handleAnswerRing = async () => {
    if (incomingCall) {
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

  const headerLabel = ringing
    ? 'Incoming call'
    : inCall
      ? 'On call'
      : status === 'registered'
        ? 'Softphone'
        : status === 'connecting'
          ? 'Connecting…'
          : status === 'failed'
            ? 'Disconnected'
            : 'Softphone';

  const headerGradient = ringing
    ? 'from-amber-500 to-orange-600'
    : inCall
      ? 'from-emerald-600 to-green-700'
      : 'from-indigo-600 to-violet-700';

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="w-[360px] rounded-2xl bg-card text-card-foreground border border-border shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={`relative bg-gradient-to-br ${headerGradient} text-white px-5 py-5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">{headerLabel}</div>
                  {inCall && (
                    <div className="text-xs opacity-90">
                      <CallTimer startedAt={callStarted} />
                    </div>
                  )}
                </div>
              </div>
              {!inCall && !ringing && (
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-white/15"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {ringing && (
              <div className="mt-4 text-center">
                <div className="text-[11px] uppercase tracking-wider opacity-80">Calling you</div>
                <div className="text-2xl font-semibold mt-1 truncate">
                  {formatPhone(ringingFromLabel) || 'Unknown caller'}
                </div>
                <div className="mt-1 text-xs opacity-90 animate-pulse">Ringing…</div>
              </div>
            )}

            {inCall && (
              <div className="mt-4 text-center">
                <div className="text-[11px] uppercase tracking-wider opacity-80">Connected with</div>
                <div className="text-2xl font-mono font-semibold mt-1">
                  {formatPhone(callerLabel) || 'Active call'}
                </div>
              </div>
            )}

            {!inCall && !ringing && (
              <div className="mt-4">
                <Input
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                  placeholder="Enter a number"
                  className="font-mono text-2xl text-center h-14 bg-white/10 border-white/20 placeholder:text-white/60 text-white focus-visible:ring-white/40"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDial(); }}
                />
                {dialNumber && (
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={handleBackspace}
                      className="text-xs text-white/80 hover:text-white flex items-center gap-1"
                    >
                      <Delete className="w-3 h-3" /> backspace
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {ringing ? (
              incomingCall ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleDeclineRing}
                    className="flex flex-col items-center justify-center h-16 rounded-xl bg-red-600 hover:bg-red-700 text-white transition"
                  >
                    <PhoneOff className="w-5 h-5" />
                    <span className="text-[11px] mt-1">Decline</span>
                  </button>
                  <button
                    onClick={handleAnswerRing}
                    disabled={bridging}
                    className="flex flex-col items-center justify-center h-16 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition"
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-[11px] mt-1">{bridging ? 'Connecting…' : 'Answer'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Pick up on your desk phone to answer.
                  </div>
                  <button
                    onClick={handleDeclineRing}
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white transition"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span className="text-sm">Dismiss</span>
                  </button>
                </div>
              )
            ) : inCall ? (
              <>
                {showKeypad && <Keypad onPress={handleKeypadPress} />}

                <div className="grid grid-cols-3 gap-3">
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
                    onClick={() => setShowKeypad((v) => !v)}
                    className={`flex flex-col items-center justify-center h-16 rounded-xl border transition ${
                      showKeypad
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    <Grid3x3 className="w-5 h-5" />
                    <span className="text-[11px] mt-1">Keypad</span>
                  </button>
                  <button
                    onClick={() => hangup()}
                    className="flex flex-col items-center justify-center h-16 rounded-xl bg-red-600 hover:bg-red-700 text-white transition"
                  >
                    <PhoneOff className="w-5 h-5" />
                    <span className="text-[11px] mt-1">End</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Keypad onPress={handleKeypadPress} />

                <Button
                  onClick={handleDial}
                  disabled={!dialNumber.trim() || status !== 'registered' || calling}
                  className="w-full h-14 bg-green-600 hover:bg-green-700 text-white text-base rounded-xl shadow-md"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  {calling ? 'Calling…' : 'Call'}
                </Button>

                {status !== 'registered' && (
                  <div className="text-[12px] text-center text-muted-foreground">
                    {status === 'connecting'
                      ? 'Connecting to network…'
                      : status === 'no-credentials'
                        ? 'Softphone is not configured.'
                        : `Status: ${status}`}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SoftphonePanel;
