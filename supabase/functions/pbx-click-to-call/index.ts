// pbx-click-to-call — initiates an outbound desk-phone callback.
//
// Flow:
//   1. POST { to: '+15551234567' } with the user's Supabase JWT.
//   2. We look up the user's SIP credentials (pbx_webrtc_endpoints) and
//      their store DID (store_channels.inbound_phone_e164).
//   3. We POST to SignalWire's LaML Calls API to place a call from the DID
//      to the user's SIP user (which rings every device — desk + browser —
//      registered with that username).
//   4. SignalWire fetches a TwiML `Url` we provide; that URL is THIS SAME
//      function called with `?action=bridge&target=<E.164>&callerId=<DID>`
//      which returns `<Response><Dial callerId>{target}</Dial></Response>`
//      so when the user picks up, the customer is dialed and bridged in.
//
// Required secrets: SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const xml = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, "content-type": "text/xml" },
  });

const escapeXml = (s: string) =>
  String(s).replace(/[<>&'"]/g, (c) => (
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" :
    c === "'" ? "&apos;" : "&quot;"
  ));

const normalizePhone = (raw: string): string => {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+")) return raw.trim();
  return `+${digits}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ---------- TwiML callback (no auth — SignalWire calls this) ----------
  if (action === "bridge") {
    const target = url.searchParams.get("target") || "";
    const callerId = url.searchParams.get("callerId") || "";
    if (!target) return xml(`<Response><Hangup/></Response>`);
    return xml(
`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" timeout="30" answerOnBridge="true">
    <Number>${escapeXml(target)}</Number>
  </Dial>
</Response>`,
    );
  }

  // ---------- Initiate (requires user JWT) ----------
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const PROJECT_ID = Deno.env.get("SIGNALWIRE_PROJECT_ID");
  const API_TOKEN = Deno.env.get("SIGNALWIRE_API_TOKEN");
  const SPACE = Deno.env.get("SIGNALWIRE_SPACE");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!PROJECT_ID || !API_TOKEN || !SPACE || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
    return json({ error: "server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "missing auth" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);
  const userId = userRes.user.id;

  let body: { to?: string; from?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const target = normalizePhone(body.to || "");
  if (!target || target.length < 4) return json({ error: "missing or invalid target" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve user's SIP user@domain.
  const { data: ep } = await admin
    .from("pbx_webrtc_endpoints")
    .select("sip_username, desk_sip_username, sip_domain, enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (!ep || !ep.enabled) {
    return json({ error: "no sip endpoint provisioned for this user" }, 404);
  }
  // Prefer the desk-phone SIP user when set so SignalWire rings the actual
  // hardware (Yealink). The browser SIP user only works if the softphone
  // is currently registered. `?prefer=browser` (or `prefer: 'browser'` in
  // the JSON body) flips back to the WebRTC user.
  const prefer = url.searchParams.get("prefer") || (body as any)?.prefer || "";
  const sipUser = prefer === "browser"
    ? ep.sip_username
    : (ep.desk_sip_username || ep.sip_username);
  const sipDestination = `sip:${sipUser}@${ep.sip_domain}`;

  // Resolve callerID DID — explicit override or first active channel.
  let callerId = normalizePhone(body.from || "");
  if (!callerId) {
    const { data: ch } = await admin
      .from("store_channels")
      .select("inbound_phone_e164")
      .eq("user_id", userId)
      .eq("is_active", true)
      .not("inbound_phone_e164", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    callerId = normalizePhone(ch?.inbound_phone_e164 || "");
  }
  if (!callerId) {
    return json({ error: "no caller DID configured for this user" }, 400);
  }

  // Build the TwiML callback URL pointing at this same function in `bridge` mode.
  const fnBase = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/pbx-click-to-call`;
  const twimlUrl = `${fnBase}?action=bridge&target=${encodeURIComponent(target)}&callerId=${encodeURIComponent(callerId)}`;

  // Place the outbound call via LaML.
  const formBody = new URLSearchParams({
    To: sipDestination,
    From: callerId,
    Url: twimlUrl,
    Method: "GET",
  });
  const swUrl = `https://${SPACE}/api/laml/2010-04-01/Accounts/${PROJECT_ID}/Calls.json`;
  const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);

  try {
    const resp = await fetch(swUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: formBody.toString(),
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error("[click-to-call] signalwire error", resp.status, text);
      return json({ error: "signalwire call create failed", status: resp.status, body: text }, 502);
    }
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* non-json */ }
    return json({
      ok: true,
      sid: parsed?.sid,
      to: sipDestination,
      from: callerId,
      target,
      twimlUrl,
    });
  } catch (e) {
    console.error("[click-to-call] exception", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});
