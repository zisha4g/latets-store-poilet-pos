// pbx-sms-send — send an outbound SMS/MMS via SignalWire LaML.
//
// Flow:
//   1. POST { to: '+15551234567', body: 'hello', mediaUrls?: [...], from?: '+1...' }
//      with the user's Supabase JWT.
//   2. We pick the From DID (explicit, or the user's first active store_channels.inbound_phone_e164).
//   3. We POST to https://{space}/api/laml/2010-04-01/Accounts/{project}/Messages.json.
//   4. We insert a row into pbx_sms_messages with direction='outbound'.
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

const normalizePhone = (raw: string): string => {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

  let payload: { to?: string; body?: string; mediaUrls?: string[]; from?: string };
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const to = normalizePhone(payload.to || "");
  const body = String(payload.body ?? "").trim();
  const mediaUrls = Array.isArray(payload.mediaUrls) ? payload.mediaUrls.filter(Boolean) : [];

  if (!to || to.length < 4) return json({ error: "missing or invalid 'to'" }, 400);
  if (!body && mediaUrls.length === 0) return json({ error: "body or mediaUrls required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve From DID + channel.
  let fromNumber = normalizePhone(payload.from || "");
  let channelId: string | null = null;
  if (fromNumber) {
    const { data: ch } = await admin
      .from("store_channels")
      .select("id, inbound_phone_e164")
      .eq("user_id", userId)
      .eq("inbound_phone_e164", fromNumber)
      .maybeSingle();
    channelId = ch?.id ?? null;
  } else {
    const { data: ch } = await admin
      .from("store_channels")
      .select("id, inbound_phone_e164")
      .eq("user_id", userId)
      .eq("is_active", true)
      .not("inbound_phone_e164", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    fromNumber = normalizePhone(ch?.inbound_phone_e164 || "");
    channelId = ch?.id ?? null;
  }
  if (!fromNumber) return json({ error: "no SMS-capable DID configured for this user" }, 400);

  // Build LaML Messages request.
  const params = new URLSearchParams();
  params.set("To", to);
  params.set("From", fromNumber);
  if (body) params.set("Body", body);
  for (const url of mediaUrls) params.append("MediaUrl", String(url));

  const swUrl = `https://${SPACE}/api/laml/2010-04-01/Accounts/${PROJECT_ID}/Messages.json`;
  const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);

  let sid: string | null = null;
  let status = "queued";
  let errorCode: string | null = null;
  try {
    const resp = await fetch(swUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: params.toString(),
    });
    const text = await resp.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* non-json */ }
    if (!resp.ok) {
      console.error("[sms-send] signalwire error", resp.status, text);
      errorCode = String(parsed?.code ?? resp.status);
      status = "failed";
      // Insert a failed-row for visibility, then return.
      await admin.from("pbx_sms_messages").insert({
        user_id: userId,
        channel_id: channelId,
        direction: "outbound",
        from_number: fromNumber,
        to_number: to,
        thread_key: to,
        body,
        media_urls: mediaUrls,
        num_media: mediaUrls.length,
        status,
        error_code: errorCode,
      });
      return json({ error: "signalwire send failed", status: resp.status, body: parsed ?? text }, 502);
    }
    sid = parsed?.sid ?? null;
    status = String(parsed?.status ?? "queued");
  } catch (e) {
    console.error("[sms-send] exception", e);
    return json({ error: String((e as Error).message) }, 500);
  }

  // Persist outbound row.
  const { data: inserted, error: insertErr } = await admin
    .from("pbx_sms_messages")
    .insert({
      user_id: userId,
      channel_id: channelId,
      direction: "outbound",
      from_number: fromNumber,
      to_number: to,
      thread_key: to,
      body,
      media_urls: mediaUrls,
      num_media: mediaUrls.length,
      status,
      signalwire_sid: sid,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("[sms-send] insert error", insertErr);
    return json({ ok: true, sid, warn: "sent but log insert failed", details: insertErr.message });
  }
  return json({ ok: true, sid, message: inserted });
});
