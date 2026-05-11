// pbx-webrtc-credentials — returns the SIP credentials the browser needs
// to register a JsSIP UA. Auto-provisions on first call:
//
//   1. Look up an existing row in pbx_webrtc_endpoints for the caller. If
//      found and enabled, return it.
//   2. Otherwise, create a fresh SignalWire SIP endpoint via the Relay REST
//      API with a deterministic username/password (derived from API_TOKEN +
//      userId via HMAC, so we never need to store the password ourselves).
//   3. Wire its `send_calls_url` to our pbx-sip-outbound function so calls
//      placed from the browser get bridged onto the PSTN automatically.
//   4. Insert the row, return creds.
//
// Required secrets (already used by pbx-subscriber-token):
//   SIGNALWIRE_PROJECT_ID
//   SIGNALWIRE_API_TOKEN
//   SIGNALWIRE_SPACE          (e.g. "4gonwheels.signalwire.com")
//   SUPABASE_URL              (auto-injected by Supabase runtime)
//   SUPABASE_ANON_KEY         (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY (auto-injected)

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

// Stable username for a user — short, lowercase, prefixed.
const usernameFor = (userId: string) =>
  `sp_${userId.replace(/-/g, "").slice(0, 16)}`;

// Deterministic password: HMAC(API_TOKEN, userId) → hex prefix + complexity
// padding. Same input always yields the same string.
const derivePassword = async (apiToken: string, userId: string): Promise<string> => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`storepilot-sip:${userId}`));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `Sp1!${hex.slice(0, 28)}`;
};

// Derive the per-space SIP domain from PROJECT_ID + SPACE.
//   space="4gonwheels.signalwire.com", project=8116ac50-c076-40f4-8784-d3049efc26a8
//   → "4gonwheels-d3049efc26a8.sip.signalwire.com"
const sipHostFor = (space: string, projectId: string) => {
  const prefix = space.split(".")[0];
  const suffix = projectId.split("-").pop();
  return `${prefix}-${suffix}.sip.signalwire.com`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const PROJECT_ID = Deno.env.get("SIGNALWIRE_PROJECT_ID");
  const API_TOKEN = Deno.env.get("SIGNALWIRE_API_TOKEN");
  const SPACE = Deno.env.get("SIGNALWIRE_SPACE");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY) {
    return json({ error: "supabase env missing" }, 500);
  }
  if (!PROJECT_ID || !API_TOKEN || !SPACE) {
    return json({ error: "SignalWire credentials not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

  const userId = userRes.user.id;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // --- 1. Existing row? Return it (but always re-sync the SignalWire
  // endpoint's send_calls_url so old rows / migrated installs self-heal).
  const { data: existing, error: existingErr } = await admin
    .from("pbx_webrtc_endpoints")
    .select("sip_username, sip_password, sip_domain, ws_url, display_name, enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) {
    console.error("[pbx-webrtc-credentials] db read error", existingErr);
    return json({ error: "db error" }, 500);
  }

  if (existing && existing.enabled) {
    // Self-heal: make sure the SignalWire endpoint still points its
    // outbound LaML hook at our pbx-sip-outbound function. Old endpoints
    // (manually provisioned, migrated installs) may have a stale or
    // missing send_calls_url, which causes outbound calls to ring forever
    // with no audio.
    try {
      const sendCallsUrl = `${SUPABASE_URL}/functions/v1/pbx-sip-outbound?user=${encodeURIComponent(userId)}`;
      const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);
      const baseUrl = `https://${SPACE}`;
      const lookup = await fetch(
        `${baseUrl}/api/relay/rest/endpoints/sip?filter_name=${encodeURIComponent(existing.sip_username)}`,
        { headers: { Authorization: `Basic ${basic}`, Accept: "application/json" } },
      );
      if (lookup.ok) {
        const j: any = await lookup.json().catch(() => null);
        const items: any[] = j?.data ?? (Array.isArray(j) ? j : []);
        const found = items.find((e) => e?.username === existing.sip_username);
        if (found?.id) {
          await fetch(`${baseUrl}/api/relay/rest/endpoints/sip/${found.id}`, {
            method: "PUT",
            headers: {
              Authorization: `Basic ${basic}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              send_calls_url: sendCallsUrl,
              send_calls_method: "POST",
            }),
          }).catch(() => { /* best-effort */ });
        }
      }
    } catch (e) {
      console.warn("[pbx-webrtc-credentials] send_calls_url self-heal failed", e);
    }

    return json({
      sip_username: existing.sip_username,
      sip_password: existing.sip_password,
      sip_domain: existing.sip_domain,
      ws_url: existing.ws_url,
      display_name: existing.display_name ?? null,
    });
  }

  // --- 2. Auto-provision on SignalWire. --------------------------------
  const username = usernameFor(userId);
  const password = await derivePassword(API_TOKEN, userId);
  const sipDomain = sipHostFor(SPACE, PROJECT_ID);
  const wsUrl = `wss://${sipDomain}:443/wss`;
  const sendCallsUrl = `${SUPABASE_URL}/functions/v1/pbx-sip-outbound?user=${encodeURIComponent(userId)}`;

  const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);
  const baseUrl = `https://${SPACE}`;

  const swFetch = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });

  // Look up by username first (idempotent re-runs won't error out).
  let endpointId: string | null = null;
  try {
    const r = await swFetch(`/api/relay/rest/endpoints/sip?filter_name=${encodeURIComponent(username)}`);
    if (r.ok) {
      const j: any = await r.json().catch(() => null);
      const items: any[] = j?.data ?? (Array.isArray(j) ? j : []);
      const found = items.find((e) => e?.username === username);
      if (found?.id) endpointId = String(found.id);
    }
  } catch (_e) { /* ignore */ }

  // Pick the user's primary phone number (if any) for caller ID. The
  // pbx-sip-outbound webhook also looks this up, but storing it in
  // `send_as` lets SignalWire show the right number on caller ID even if
  // the webhook is unreachable.
  let callerId: string | null = null;
  try {
    const { data: chan } = await admin
      .from("store_channels")
      .select("inbound_phone_e164")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (chan?.inbound_phone_e164) callerId = String(chan.inbound_phone_e164);
  } catch (_e) { /* ignore */ }

  const endpointBody: Record<string, unknown> = {
    username,
    password,
    caller_id: callerId || username,
    send_calls_url: sendCallsUrl,
    send_calls_method: "POST",
    encryption: "auto",
    ciphers: ["AEAD_AES_256_GCM", "AES_256_CM_HMAC_SHA1_80", "AES_CM_128_HMAC_SHA1_80"],
    codecs: ["OPUS", "G722", "PCMU", "PCMA"],
  };
  if (callerId) endpointBody.send_as = callerId;

  if (endpointId) {
    // Update existing endpoint to the latest password / handler URL.
    try {
      await swFetch(`/api/relay/rest/endpoints/sip/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify(endpointBody),
      });
    } catch (_e) { /* ignore */ }
  } else {
    const create = await swFetch("/api/relay/rest/endpoints/sip", {
      method: "POST",
      body: JSON.stringify(endpointBody),
    });
    if (!create.ok) {
      const text = await create.text().catch(() => "");
      console.error("[pbx-webrtc-credentials] SIP endpoint create failed", create.status, text);
      return json({ error: "could not create SIP endpoint", status: create.status, body: text.slice(0, 500) }, 502);
    }
    try {
      const j = await create.json();
      endpointId = String(j?.id ?? j?.data?.id ?? "");
    } catch { /* ignore */ }
  }

  // --- 3. Persist row. -------------------------------------------------
  const row = {
    user_id: userId,
    sip_username: username,
    sip_password: password,
    sip_domain: sipDomain,
    ws_url: wsUrl,
    display_name: (userRes.user.user_metadata?.full_name as string) ||
                  userRes.user.email || null,
    enabled: true,
  };
  const { error: upErr } = await admin
    .from("pbx_webrtc_endpoints")
    .upsert(row, { onConflict: "user_id" });
  if (upErr) {
    console.error("[pbx-webrtc-credentials] db upsert error", upErr);
    return json({ error: "db write failed", detail: upErr.message }, 500);
  }

  return json({
    sip_username: username,
    sip_password: password,
    sip_domain: sipDomain,
    ws_url: wsUrl,
    display_name: row.display_name,
    provisioned: true,
  });
});
