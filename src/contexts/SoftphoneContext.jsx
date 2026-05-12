// SoftphoneProvider — browser SIP softphone backed by SIP.js.
//
// Behaves like a regular SIP desk phone (MicroSIP, Yealink) registered
// against SignalWire's SIP edge. Inbound DID → LaML <Dial> with multiple
// <Sip> children → browser + desk ring in parallel.
//
// Credentials come from `pbx-webrtc-credentials` (auto-provisions a SIP
// endpoint per user on SignalWire and persists username/password in the
// pbx_webrtc_endpoints table).
//
// Public API (unchanged from prior Fabric implementation):
//   status, incomingCall, activeCall,
//   panelOpen, openPanel, closePanel,
//   answer, decline, hangup,
//   dial, sendDigits, setMuted, expectIncomingAccept

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  UserAgent,
  Inviter,
  Registerer,
  RegistererState,
  SessionState,
} from 'sip.js';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const SoftphoneContext = createContext(null);

export const useSoftphone = () => {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    return {
      status: 'idle', incomingCall: null, activeCall: null,
      panelOpen: false, openPanel: () => {}, closePanel: () => {},
      answer: () => {}, decline: () => {}, hangup: () => {},
      dial: async () => { throw new Error('Softphone not mounted'); },
      sendDigits: async () => {},
      setMuted: async () => {},
      setHold: async () => {},
      transfer: async () => { throw new Error('Softphone not mounted'); },
      expectIncomingAccept: () => {},
      registerEmbedded: () => () => {},
      embeddedActive: false,
    };
  }
  return ctx;
};

// ---------- Module singletons (StrictMode / HMR safe) ----------
let sharedAudioEl = null;
let moduleUA = null;
let moduleRegisterer = null;
let moduleUserId = null;
let moduleStarting = null;
let moduleStopTimer = null;
let moduleAutoAcceptUntil = 0;

const ensureAudioElement = () => {
  if (sharedAudioEl && document.body.contains(sharedAudioEl)) return sharedAudioEl;
  const el = document.createElement('audio');
  el.autoplay = true;
  el.id = 'pbx-softphone-audio';
  el.setAttribute('playsinline', '');
  document.body.appendChild(el);
  sharedAudioEl = el;
  return el;
};

const fetchSipCredentials = async () => {
  const { data, error } = await supabase.functions.invoke('pbx-webrtc-credentials');
  if (error) throw new Error(error.message || 'failed to fetch SIP credentials');
  if (!data?.sip_username || !data?.sip_password || !data?.sip_domain) {
    throw new Error('SIP credentials missing in response');
  }
  return data;
};

const attachRemoteAudio = (session, audioEl) => {
  try {
    const sdh = session?.sessionDescriptionHandler;
    const pc = sdh?.peerConnection;
    if (!pc) return;

    const rebuild = () => {
      const stream = new MediaStream();
      pc.getReceivers().forEach((r) => {
        if (r.track && r.track.kind === 'audio') stream.addTrack(r.track);
      });
      if (stream.getAudioTracks().length === 0) return;
      // Only swap srcObject if it actually changed to avoid restarting playback.
      const cur = audioEl.srcObject;
      const sameTracks = cur && cur.getAudioTracks
        && cur.getAudioTracks().length === stream.getAudioTracks().length
        && cur.getAudioTracks().every((t, i) => t.id === stream.getAudioTracks()[i].id);
      if (!sameTracks) audioEl.srcObject = stream;
      audioEl.play().catch(() => { /* needs gesture */ });
    };

    rebuild();
    // SIP.js / WebRTC may add the remote track slightly after Established —
    // listen for late arrivals so we don't end up with a silent call.
    if (!pc.__sp_trackHooked) {
      pc.addEventListener('track', () => rebuild());
      pc.__sp_trackHooked = true;
    }
  } catch (e) {
    console.warn('[softphone] attachRemoteAudio failed', e);
  }
};

const extractCallerId = (invitation) => {
  try {
    const fromUri = invitation?.remoteIdentity?.uri;
    return {
      caller_id_number: fromUri?.user || '',
      caller_id_name: invitation?.remoteIdentity?.displayName || '',
      from: fromUri?.user || '',
    };
  } catch {
    return { caller_id_number: '', caller_id_name: '', from: '' };
  }
};

const buildTargetUri = (target, sipDomain) => {
  const t = String(target || '').trim();
  if (t.startsWith('sip:') || t.startsWith('sips:')) return t;
  const digits = t.replace(/[^0-9+]/g, '');
  let e164 = digits;
  if (!e164.startsWith('+')) {
    const numeric = digits.replace(/[^0-9]/g, '');
    if (numeric.length === 10) e164 = `+1${numeric}`;
    else if (numeric.length === 11 && numeric.startsWith('1')) e164 = `+${numeric}`;
    else e164 = `+${numeric}`;
  }
  return `sip:${e164}@${sipDomain}`;
};

export const SoftphoneProvider = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  // When an embedded softphone workspace (e.g. the /pbx/softphone page) is
  // mounted, the floating modal panel hides — the embedded UI fully owns
  // the dial/in-call/ringing experience while it is visible.
  const [embeddedCount, setEmbeddedCount] = useState(0);
  const registerEmbedded = useCallback(() => {
    setEmbeddedCount((n) => n + 1);
    return () => setEmbeddedCount((n) => Math.max(0, n - 1));
  }, []);
  const embeddedActive = embeddedCount > 0;
  const incomingCallRef = useRef(null);
  const activeCallRef = useRef(null);
  const sipDomainRef = useRef(null);

  const setIncoming = useCallback((val) => {
    incomingCallRef.current = val;
    setIncomingCall(val);
  }, []);
  const setActive = useCallback((val) => {
    activeCallRef.current = val;
    setActiveCall(val);
  }, []);

  // Wrap a SIP.js Session with the API the rest of the app expects.
  const wrapSession = useCallback((session, audioEl) => {
    session.stateChange.addListener((state) => {
      console.log('[softphone] session', session.id, 'state →', state);
      if (state === SessionState.Establishing || state === SessionState.Established) {
        attachRemoteAudio(session, audioEl);
      }
      if (state === SessionState.Terminated) {
        // Surface why the call ended (SIP response code / reason) so we can
        // tell "rejected by carrier" apart from "user hung up".
        try {
          const resp = session.response || session.outgoingResponse || session.incomingResponse;
          if (resp) {
            console.log('[softphone] terminated reason',
              resp.statusCode, resp.reasonPhrase || '');
          }
        } catch { /* noop */ }
        setActive((cur) => (cur && cur.__session === session ? null : cur));
      }
    });
    const wrapped = {
      __session: session,
      id: session.id,
      hangup: async () => {
        try {
          if (session.state === SessionState.Establishing) await session.cancel();
          else if (session.state === SessionState.Established) await session.bye();
          else if (typeof session.reject === 'function') await session.reject();
        } catch (e) { console.warn('[softphone] hangup failed', e); }
      },
      leave: async () => { try { await session.bye(); } catch (e) { console.warn(e); } },
      sendDigits: async (digits) => {
        try {
          const body = String(digits).split('').map((d) =>
            `Signal=${d}\r\nDuration=160`
          ).join('\r\n');
          await session.info({
            requestOptions: {
              body: {
                contentDisposition: 'render',
                contentType: 'application/dtmf-relay',
                content: body,
              },
            },
          });
        } catch (e) {
          console.warn('[softphone] sendDigits failed', e);
        }
      },
      audioMute: async () => {
        try {
          const pc = session?.sessionDescriptionHandler?.peerConnection;
          pc?.getSenders().forEach((s) => {
            if (s.track && s.track.kind === 'audio') s.track.enabled = false;
          });
        } catch (e) { console.warn(e); }
      },
      audioUnmute: async () => {
        try {
          const pc = session?.sessionDescriptionHandler?.peerConnection;
          pc?.getSenders().forEach((s) => {
            if (s.track && s.track.kind === 'audio') s.track.enabled = true;
          });
        } catch (e) { console.warn(e); }
      },
      // Local-track-based hold. This is NOT a true SIP re-INVITE hold (carrier
      // won't play music on hold), but it gives the user a working two-way
      // mute experience until we wire up proper re-INVITE + MOH.
      audioHold: async () => {
        try {
          const pc = session?.sessionDescriptionHandler?.peerConnection;
          pc?.getSenders().forEach((s) => {
            if (s.track && s.track.kind === 'audio') s.track.enabled = false;
          });
          pc?.getReceivers().forEach((r) => {
            if (r.track && r.track.kind === 'audio') r.track.enabled = false;
          });
        } catch (e) { console.warn('[softphone] hold failed', e); }
      },
      audioUnhold: async () => {
        try {
          const pc = session?.sessionDescriptionHandler?.peerConnection;
          pc?.getSenders().forEach((s) => {
            if (s.track && s.track.kind === 'audio') s.track.enabled = true;
          });
          pc?.getReceivers().forEach((r) => {
            if (r.track && r.track.kind === 'audio') r.track.enabled = true;
          });
        } catch (e) { console.warn('[softphone] unhold failed', e); }
      },
      // Blind transfer via SIP REFER.
      transfer: async (targetUri) => {
        try {
          if (!targetUri) throw new Error('No transfer target');
          await session.refer(targetUri);
        } catch (e) {
          console.warn('[softphone] transfer failed', e);
          throw e;
        }
      },
    };
    return wrapped;
  }, [setActive]);

  const handleInvitation = useCallback((invitation) => {
    const audioEl = ensureAudioElement();
    const remote = invitation?.remoteIdentity?.uri?.toString?.();
    console.log('[softphone] incoming INVITE from', remote);

    if (incomingCallRef.current || activeCallRef.current) {
      console.log('[softphone] busy — rejecting incoming invite');
      try { invitation.reject(); } catch { /* noop */ }
      return;
    }

    const acceptInvite = async () => {
      try { audioEl.play().catch(() => {}); } catch { /* noop */ }
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        },
      });
      const wrapped = wrapSession(invitation, audioEl);
      setIncoming(null);
      setActive(wrapped);
      return wrapped;
    };

    const wrapped = {
      accept: acceptInvite,
      reject: async () => {
        try { await invitation.reject(); } catch (e) { console.warn('[softphone] reject failed', e); }
        setIncoming(null);
      },
      details: extractCallerId(invitation),
    };
    setIncoming(wrapped);

    if (Date.now() < moduleAutoAcceptUntil) {
      moduleAutoAcceptUntil = 0;
      acceptInvite().catch((e) => console.warn('[softphone] auto-accept failed', e));
    }
  }, [setActive, setIncoming, wrapSession]);

  useEffect(() => {
    if (!user?.id) return undefined;
    if (moduleStopTimer) { clearTimeout(moduleStopTimer); moduleStopTimer = null; }

    let cancelled = false;

    const start = async () => {
      if (moduleUA && moduleUserId === user.id) return moduleUA;
      if (moduleStarting) return moduleStarting;

      moduleStarting = (async () => {
        setStatus('connecting');
        let creds;
        try {
          creds = await fetchSipCredentials();
        } catch (e) {
          console.error('[softphone] cred fetch failed', e);
          if (!cancelled) setStatus('no-credentials');
          return null;
        }
        if (cancelled) return null;

        sipDomainRef.current = creds.sip_domain;
        const uri = UserAgent.makeURI(`sip:${creds.sip_username}@${creds.sip_domain}`);
        if (!uri) {
          console.error('[softphone] bad SIP URI');
          if (!cancelled) setStatus('failed');
          return null;
        }

        const ua = new UserAgent({
          uri,
          authorizationUsername: creds.sip_username,
          authorizationPassword: creds.sip_password,
          displayName: creds.display_name || creds.sip_username,
          transportOptions: {
            server: creds.ws_url,
            traceSip: false,
          },
          sessionDescriptionHandlerFactoryOptions: {
            iceGatheringTimeout: 200,
            peerConnectionConfiguration: {
              iceServers: [
                { urls: [
                  'stun:stun.l.google.com:19302',
                  'stun:stun1.l.google.com:19302',
                  'stun:stun.cloudflare.com:3478',
                ] },
              ],
            },
          },
          delegate: {
            onInvite: (invitation) => handleInvitation(invitation),
          },
        });

        try {
          await ua.start();
        } catch (e) {
          console.error('[softphone] UA start failed', e);
          if (!cancelled) setStatus('failed');
          return null;
        }
        if (cancelled) {
          try { await ua.stop(); } catch { /* noop */ }
          return null;
        }

        // Pre-warm mic permission + device so getUserMedia at dial time is instant.
        try {
          const warm = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          warm.getTracks().forEach((t) => t.stop());
          console.log('[softphone] mic pre-warmed');
        } catch (e) {
          console.warn('[softphone] mic pre-warm failed (will request at dial time)', e?.name || e);
        }

        const registerer = new Registerer(ua);
        registerer.stateChange.addListener((state) => {
          console.log('[softphone] registerer state', state);
          if (state === RegistererState.Registered) setStatus('registered');
        });
        try {
          await registerer.register();
        } catch (e) {
          console.error('[softphone] register failed', e);
          if (!cancelled) setStatus('failed');
        }

        moduleUA = ua;
        moduleRegisterer = registerer;
        moduleUserId = user.id;
        return ua;
      })().catch((e) => {
        console.error('[softphone] start failed', e);
        moduleUA = null;
        moduleRegisterer = null;
        moduleUserId = null;
        if (!cancelled) setStatus('failed');
        return null;
      }).finally(() => {
        moduleStarting = null;
      });

      return moduleStarting;
    };

    start();

    return () => {
      cancelled = true;
      moduleStopTimer = setTimeout(async () => {
        if (moduleRegisterer) {
          try { await moduleRegisterer.unregister(); } catch { /* noop */ }
        }
        if (moduleUA) {
          try { await moduleUA.stop(); } catch { /* noop */ }
        }
        moduleUA = null;
        moduleRegisterer = null;
        moduleUserId = null;
        moduleStopTimer = null;
      }, 1000);
    };
  }, [user?.id, handleInvitation]);

  const answer = useCallback(async () => {
    const inv = incomingCallRef.current;
    if (!inv) return;
    try { await inv.accept(); } catch (e) { console.error('[softphone] answer failed', e); }
  }, []);

  const decline = useCallback(async () => {
    const inv = incomingCallRef.current;
    if (!inv) return;
    try { await inv.reject(); } catch (e) { console.warn('[softphone] decline failed', e); }
  }, []);

  const hangup = useCallback(async () => {
    const cur = activeCallRef.current;
    if (!cur) return;
    try {
      if (typeof cur.hangup === 'function') await cur.hangup();
      else if (typeof cur.leave === 'function') await cur.leave();
    } catch (e) { console.warn('[softphone] hangup failed', e); }
    setActive(null);
  }, [setActive]);

  const sendDigits = useCallback(async (digits) => {
    const cur = activeCallRef.current;
    if (!cur || !digits) return;
    try { if (typeof cur.sendDigits === 'function') await cur.sendDigits(digits); }
    catch (e) { console.warn('[softphone] sendDigits failed', e); }
  }, []);

  const setMuted = useCallback(async (muted) => {
    const cur = activeCallRef.current;
    if (!cur) return;
    try {
      if (muted) await cur.audioMute?.();
      else await cur.audioUnmute?.();
    } catch (e) { console.warn('[softphone] setMuted failed', e); }
  }, []);

  const setHold = useCallback(async (held) => {
    const cur = activeCallRef.current;
    if (!cur) return;
    try {
      if (held) await cur.audioHold?.();
      else await cur.audioUnhold?.();
    } catch (e) { console.warn('[softphone] setHold failed', e); }
  }, []);

  const transfer = useCallback(async (target) => {
    const cur = activeCallRef.current;
    if (!cur || !sipDomainRef.current) throw new Error('No active call');
    const uriStr = buildTargetUri(target, sipDomainRef.current);
    const targetUri = UserAgent.makeURI(uriStr);
    if (!targetUri) throw new Error('Invalid transfer target');
    console.log('[softphone] transfer →', uriStr);
    await cur.transfer(targetUri);
  }, []);

  const dial = useCallback(async (target) => {
    if (!moduleUA || !sipDomainRef.current) {
      console.warn('[softphone] dial blocked — UA not ready');
      throw new Error('Softphone not connected');
    }
    const audioEl = ensureAudioElement();
    try { audioEl.play().catch(() => {}); } catch { /* noop */ }

    const uriStr = buildTargetUri(target, sipDomainRef.current);
    const targetUri = UserAgent.makeURI(uriStr);
    if (!targetUri) throw new Error('Invalid dial target');
    console.log('[softphone] dial →', uriStr, '(input:', target, ')');

    const inviter = new Inviter(moduleUA, targetUri, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      },
    });
    const wrapped = wrapSession(inviter, audioEl);
    setActive(wrapped);
    try {
      await inviter.invite();
      console.log('[softphone] INVITE sent for', uriStr);
    } catch (e) {
      console.error('[softphone] invite failed', e);
      setActive(null);
      throw e;
    }
    return wrapped;
  }, [setActive, wrapSession]);

  const expectIncomingAccept = useCallback((ms = 15000) => {
    moduleAutoAcceptUntil = Date.now() + Math.max(1000, Math.min(60000, ms));
  }, []);

  return (
    <SoftphoneContext.Provider value={{
      status, incomingCall, activeCall,
      panelOpen, openPanel, closePanel,
      answer, decline, hangup,
      dial, sendDigits, setMuted,
      setHold, transfer,
      expectIncomingAccept,
      registerEmbedded, embeddedActive,
    }}>
      {children}
    </SoftphoneContext.Provider>
  );
};
