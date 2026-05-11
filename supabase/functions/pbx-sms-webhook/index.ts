// pbx-sms-webhook — receives inbound SMS/MMS from SignalWire.
//
// Configure in SignalWire: each DID's "Message Handler" → external URL → this function.
// SignalWire posts application/x-www-form-urlencoded with fields like:
//   MessageSid, AccountSid, From, To, Body, NumMedia, MediaUrl0, MediaContentType0, ...
//
// We look up the user that owns the To DID via store_channels.inbound_phone_e164,
// insert a row into pbx_sms_messages, and return an empty <Response/>.
//
// To send an auto-reply, return a <Response><Message>...</Message></Response>.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const xml = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, "content-type": "text/xml" },
  });

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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[sms-webhook] missing env");
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
  }

  // Parse form-encoded payload (or JSON for tests).
  const params: Record<string, string> = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      for (const [k, v] of Object.entries(body || {})) params[k] = String(v);
    } else {
      const form = await req.formData();
      form.forEach((v, k) => { params[k] = String(v); });
    }
  } catch (e) {
    console.error("[sms-webhook] parse error", e);
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
  }

  const from = normalizePhone(params.From || params.from || "");
  const to = normalizePhone(params.To || params.to || "");
  const body = String(params.Body ?? params.body ?? "");
  const sid = String(params.MessageSid ?? params.messageSid ?? "");
  const numMedia = parseInt(String(params.NumMedia ?? "0"), 10) || 0;
  const mediaUrls: string[] = [];
  for (let i = 0; i < numMedia; i++) {
    const u = params[`MediaUrl${i}`];
    if (u) mediaUrls.push(u);
  }

  if (!from || !to) {
    console.warn("[sms-webhook] missing From/To", params);
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve owning user via channel.
  const { data: ch, error: chErr } = await admin
    .from("store_channels")
    .select("id, user_id, inbound_phone_e164")
    .eq("inbound_phone_e164", to)
    .maybeSingle();

  if (chErr || !ch) {
    console.warn("[sms-webhook] no channel for To=", to, chErr?.message);
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
  }

  // De-dupe on SignalWire SID.
  if (sid) {
    const { data: existing } = await admin
      .from("pbx_sms_messages")
      .select("id")
      .eq("signalwire_sid", sid)
      .maybeSingle();
    if (existing) {
      return xml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
    }
  }

  const { error: insErr } = await admin.from("pbx_sms_messages").insert({
    user_id: ch.user_id,
    channel_id: ch.id,
    direction: "inbound",
    from_number: from,
    to_number: to,
    thread_key: from,
    body,
    media_urls: mediaUrls,
    num_media: numMedia,
    status: "received",
    signalwire_sid: sid || null,
  });
  if (insErr) {
    console.error("[sms-webhook] insert error", insErr);
  }

  return xml(`<?xml version="1.0" encoding="UTF-8"?><Response/>`);
});
