// useSoftphone — registers the browser as a SIP endpoint via JsSIP over WSS.
// When SignalWire dials the user's SIP URI (sip:<user>@<space>.sip.signalwire.com)
// JsSIP fires an `incomingCall` event and the call can be answered in-browser.
//
// Usage:
//   const { status, incomingCall, answer, hangup, decline, activeCall } =
//     useSoftphone();
//
// status:        'idle' | 'connecting' | 'registered' | 'unregistered' | 'failed' | 'no-credentials'
// incomingCall:  RTCSession or null  (set while ringing)
// activeCall:    RTCSession or null  (set after answer until hangup)

import { useEffect, useRef, useState, useCallback } from 'react';
import JsSIP from 'jssip';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export function useSoftphone() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const uaRef = useRef(null);
  const audioRef = useRef(null);

  // Lazily create the <audio> sink for remote media.
  const ensureAudioElement = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.id = 'pbx-softphone-audio';
    document.body.appendChild(el);
    audioRef.current = el;
    return el;
  }, []);

  // Wire RTCSession events (peer connection + media routing + state).
  const wireSession = useCallback((session) => {
    const audio = ensureAudioElement();

    session.on('peerconnection', (ev) => {
      const pc = ev.peerconnection;
      pc.addEventListener('track', (e) => {
        if (e.streams && e.streams[0]) {
          audio.srcObject = e.streams[0];
        }
      });
    });
    session.on('ended', () => {
      setActiveCall(null);
      setIncomingCall(null);
    });
    session.on('failed', () => {
      setActiveCall(null);
      setIncomingCall(null);
    });
    session.on('accepted', () => {
      setActiveCall(session);
      setIncomingCall(null);
    });
  }, [ensureAudioElement]);

  // Boot the UA when the user logs in.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let ua = null;

    (async () => {
      setStatus('connecting');
      try {
        const { data, error } = await supabase.functions.invoke('pbx-webrtc-credentials');
        if (cancelled) return;
        if (error || !data?.sip_username) {
          // 404 = not provisioned; treat as no-op (softphone hidden)
          setStatus('no-credentials');
          return;
        }

        const socket = new JsSIP.WebSocketInterface(data.ws_url);
        ua = new JsSIP.UA({
          uri: `sip:${data.sip_username}@${data.sip_domain}`,
          password: data.sip_password,
          display_name: data.display_name || undefined,
          sockets: [socket],
          register: true,
          session_timers: false,
          user_agent: 'StorePilot-Web/1.0',
        });

        ua.on('connected', () => setStatus('connecting'));
        ua.on('disconnected', () => setStatus('unregistered'));
        ua.on('registered', () => setStatus('registered'));
        ua.on('unregistered', () => setStatus('unregistered'));
        ua.on('registrationFailed', (e) => {
          console.warn('[softphone] registration failed', e?.cause);
          setStatus('failed');
        });

        ua.on('newRTCSession', (ev) => {
          const { session, originator } = ev;
          if (originator !== 'remote') return; // outbound — we drive it manually
          wireSession(session);
          setIncomingCall(session);
          session.on('ended', () => setIncomingCall((cur) => (cur === session ? null : cur)));
          session.on('failed', () => setIncomingCall((cur) => (cur === session ? null : cur)));
        });

        ua.start();
        uaRef.current = ua;
      } catch (e) {
        console.error('[softphone] boot error', e);
        if (!cancelled) setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      try { ua?.stop(); } catch { /* noop */ }
      uaRef.current = null;
    };
  }, [user?.id, wireSession]);

  const answer = useCallback(() => {
    if (!incomingCall) return;
    try {
      incomingCall.answer({
        mediaConstraints: { audio: true, video: false },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      });
    } catch (e) {
      console.error('[softphone] answer failed', e);
    }
  }, [incomingCall]);

  const decline = useCallback(() => {
    if (!incomingCall) return;
    try { incomingCall.terminate({ status_code: 486, reason_phrase: 'Busy Here' }); }
    catch (e) { console.warn('[softphone] decline failed', e); }
    setIncomingCall(null);
  }, [incomingCall]);

  const hangup = useCallback(() => {
    if (!activeCall) return;
    try { activeCall.terminate(); }
    catch (e) { console.warn('[softphone] hangup failed', e); }
    setActiveCall(null);
  }, [activeCall]);

  return { status, incomingCall, activeCall, answer, decline, hangup };
}
