// SoftphoneProvider — single SignalWire Call Fabric client per app session.
//
// Public API (consumed by IncomingCallPopup and any other UI):
//   - status:        'idle' | 'connecting' | 'registered' | 'no-credentials' | 'failed'
//   - incomingCall:  null | { accept, reject, details }    (an unanswered invite)
//   - activeCall:    null | FabricRoomSession              (an answered/active call)
//   - answer():      pick up the current incomingCall
//   - decline():     reject the current incomingCall
//   - hangup():      end the activeCall
//
// SignalWire handles all of the SIP/WebRTC/TURN plumbing internally — we
// just hold one client, mark it online, and surface the events.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SignalWire } from '@signalwire/js';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const SoftphoneContext = createContext(null);

export const useSoftphone = () => {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    return {
      status: 'idle', incomingCall: null, activeCall: null,
      answer: () => {}, decline: () => {}, hangup: () => {},
    };
  }
  return ctx;
};

// ---------- Module-level singletons ----------
// These survive React StrictMode's double-mount and HMR so we never end up
// with two SignalWire clients fighting over the same subscriber identity.

let sharedAudioEl = null;
let moduleClient = null;        // active SignalWire client
let moduleClientUserId = null;  // Supabase user id this client is for
let moduleClientStarting = null; // Promise<client> while connecting (de-dupe)
let moduleStopTimer = null;

const ensureAudioElement = () => {
  if (sharedAudioEl) return sharedAudioEl;
  const el = document.createElement('audio');
  el.autoplay = true;
  el.id = 'pbx-softphone-audio';
  el.setAttribute('playsinline', '');
  document.body.appendChild(el);
  sharedAudioEl = el;
  return el;
};

const fetchSubscriberToken = async () => {
  const { data, error } = await supabase.functions.invoke('pbx-subscriber-token');
  if (error) throw new Error(error.message || 'failed to mint subscriber token');
  if (!data?.token) throw new Error('subscriber token missing in response');
  return data.token;
};

export const SoftphoneProvider = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const incomingCallRef = useRef(null);
  const activeCallRef = useRef(null);

  const setIncoming = useCallback((val) => {
    incomingCallRef.current = val;
    setIncomingCall(val);
  }, []);
  const setActive = useCallback((val) => {
    activeCallRef.current = val;
    setActiveCall(val);
  }, []);

  // Wire common events onto an answered/joined FabricRoomSession.
  const wireSession = useCallback((session) => {
    const cleanup = () => {
      console.log('[softphone] session ended');
      setActive((cur) => (cur === session ? null : cur));
    };
    try {
      session.on('destroy', cleanup);
      session.on('room.left', cleanup);
      session.on('call.left', cleanup);
      session.on('call.state', (params) => {
        console.log('[softphone] call.state', params?.callState);
        if (['ended', 'destroy', 'terminated'].includes(String(params?.callState))) cleanup();
      });
    } catch (e) {
      console.warn('[softphone] wireSession error', e);
    }
  }, [setActive]);

  useEffect(() => {
    if (!user?.id) return undefined;

    // Reuse an existing client for this user (StrictMode / HMR safety).
    if (moduleStopTimer) { clearTimeout(moduleStopTimer); moduleStopTimer = null; }

    let cancelled = false;
    const audioEl = ensureAudioElement();

    const handleIncoming = ({ invite }) => {
      console.log('[softphone] incoming call', invite?.details?.caller_id_number);
      // Reject duplicate forks while one is already on the line.
      if (incomingCallRef.current || activeCallRef.current) {
        console.log('[softphone] rejecting duplicate invite');
        try { invite.reject(); } catch { /* noop */ }
        return;
      }
      const wrapped = {
        accept: async () => {
          // Pre-warm audio inside the user-gesture for autoplay policies.
          try { audioEl.play().catch(() => {}); } catch { /* noop */ }
          const session = await invite.accept({
            audio: true,
            video: false,
            rootElement: audioEl,
            negotiateAudio: true,
            negotiateVideo: false,
          });
          console.log('[softphone] accepted, session=', session?.id);
          setIncoming(null);
          setActive(session);
          wireSession(session);
          return session;
        },
        reject: async () => {
          try { await invite.reject(); } catch (e) { console.warn('[softphone] reject failed', e); }
          setIncoming(null);
        },
        details: invite.details,
      };
      setIncoming(wrapped);
    };

    const startClient = async () => {
      // De-dupe concurrent starts (StrictMode invokes effect twice).
      if (moduleClient && moduleClientUserId === user.id) {
        return moduleClient;
      }
      if (moduleClientStarting) return moduleClientStarting;

      moduleClientStarting = (async () => {
        setStatus('connecting');
        const token = await fetchSubscriberToken();
        if (cancelled) return null;
        // SDK speaks SignalWire's Relay/Fabric protocol over WSS at
        // relay.signalwire.com:443. This host MUST be allow-listed by the
        // network filter — it is not interchangeable with the SIP-WSS host
        // (different server, different protocol).
        const client = await SignalWire({ token });
        if (cancelled) {
          try { await client.disconnect?.(); } catch { /* noop */ }
          return null;
        }
        moduleClient = client;
        moduleClientUserId = user.id;
        await client.online({
          incomingCallHandlers: {
            all: handleIncoming,
          },
        });
        console.log('[softphone] client online');
        return client;
      })().catch((e) => {
        console.error('[softphone] start failed', e);
        moduleClient = null;
        moduleClientUserId = null;
        if (!cancelled) setStatus('failed');
        return null;
      }).finally(() => {
        moduleClientStarting = null;
      });

      return moduleClientStarting;
    };

    startClient().then((client) => {
      if (cancelled || !client) return;
      setStatus('registered');
    });

    return () => {
      cancelled = true;
      // Defer client disconnect so a quick remount can reuse it.
      moduleStopTimer = setTimeout(async () => {
        if (moduleClient) {
          try { await moduleClient.offline?.(); } catch { /* noop */ }
          try { await moduleClient.disconnect?.(); } catch { /* noop */ }
        }
        moduleClient = null;
        moduleClientUserId = null;
        moduleStopTimer = null;
      }, 1000);
    };
  }, [user?.id, setIncoming, setActive, wireSession]);

  const answer = useCallback(async () => {
    const inv = incomingCallRef.current;
    if (!inv) return;
    try {
      await inv.accept();
    } catch (e) {
      console.error('[softphone] answer failed', e);
    }
  }, []);

  const decline = useCallback(async () => {
    const inv = incomingCallRef.current;
    if (!inv) return;
    try { await inv.reject(); } catch (e) { console.warn('[softphone] decline failed', e); }
  }, []);

  const hangup = useCallback(async () => {
    const session = activeCallRef.current;
    if (!session) return;
    try {
      if (typeof session.hangup === 'function') await session.hangup();
      else if (typeof session.leave === 'function') await session.leave();
    } catch (e) { console.warn('[softphone] hangup failed', e); }
    setActive(null);
  }, [setActive]);

  return (
    <SoftphoneContext.Provider value={{ status, incomingCall, activeCall, answer, decline, hangup }}>
      {children}
    </SoftphoneContext.Provider>
  );
};
