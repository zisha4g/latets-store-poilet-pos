// pbx-sip-outbound — LaML webhook hit by SignalWire when a SIP endpoint
// (the browser softphone) places a call. We bridge it to the dialed PSTN
// number, using the user's first store_channels phone number as caller ID.
//
// SignalWire POSTs form-encoded params:
//   From    = "sip:USERNAME@..."        (the registered endpoint)
//   To      = "sip:+18005551212@..."    (whatever the browser dialed)
//   ToUser  = "+18005551212"            (just the user part)
//   CallSid, CallerName, etc.
//
// Auto-wired by pbx-webrtc-credentials when it provisions the SIP endpoint:
//   send_calls_url = .../functions/v1/pbx-sip-outbound?user=<supabaseUserId>
//
// This function MUST allow unauthenticated requests (config.toml entry
// already added).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const xml = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/xml; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Parse application/x-www-form-urlencoded body OR JSON, whichever arrives.
const readParams = async (req: Request): Promise<Record<string, string>> => {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j ?? {})) out[k] = String(v ?? "");
      return out;
    }
    const text = await req.text();
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    params.forEach((v, k) => { out[k] = v; });
    return out;
  } catch (_e) {
    return {};
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user") ?? "";
    const params = await readParams(req);

    // Pull the dialed number out of either ToUser or the To SIP URI.
    let dialed = String(params.ToUser ?? "");
    if (!dialed) {
      const to = String(params.To ?? "");
      const m = to.match(/sip:([^@]+)@/i);
      if (m) dialed = m[1];
    }
    dialed = (dialed || "").trim();

    if (!dialed) {
      return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry, no number was dialed.</Say><Hangup/></Response>`);
    }

    // Resolve caller ID: first store_channels.inbound_phone_e164 for this
    // user. If we don't have one, fall back to the first phone number on
    // the SignalWire project so the call can still go through.
    let callerId = "";
    if (userId) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: chan } = await admin
          .from("store_channels")
          .select("inbound_phone_e164")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (chan?.inbound_phone_e164) callerId = String(chan.inbound_phone_e164);
      } catch (e) {
        console.warn("[pbx-sip-outbound] caller-id lookup failed", e);
      }
    }

    // Fall back to any phone number on the SignalWire project.
    if (!callerId) {
      try {
        const PROJECT_ID = Deno.env.get("SIGNALWIRE_PROJECT_ID");
        const API_TOKEN = Deno.env.get("SIGNALWIRE_API_TOKEN");
        const SPACE = Deno.env.get("SIGNALWIRE_SPACE");
        if (PROJECT_ID && API_TOKEN && SPACE) {
          const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);
          const r = await fetch(`https://${SPACE}/api/relay/rest/phone_numbers?max=1`, {
            headers: {
              "Authorization": `Basic ${basic}`,
              "Accept": "application/json",
            },
          });
          if (r.ok) {
            const j: any = await r.json().catch(() => null);
            const items: any[] = j?.data ?? (Array.isArray(j) ? j : []);
            const first = items[0];
            const num = first?.number ?? first?.phone_number ?? first?.e164;
            if (num) callerId = String(num);
          }
        }
      } catch (e) {
        console.warn("[pbx-sip-outbound] sw fallback caller-id failed", e);
      }
    }

    // Normalise dialed number to E.164 if it looks like a US number.
    let dest = dialed;
    if (!dest.startsWith("+")) {
      const digits = dest.replace(/[^0-9]/g, "");
      if (digits.length === 10) dest = `+1${digits}`;
      else if (digits.length === 11 && digits.startsWith("1")) dest = `+${digits}`;
      else if (digits.length > 0) dest = `+${digits}`;
    }

    const callerAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";
    const laml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerAttr} answerOnBridge="true" timeout="30">
    <Number>${escapeXml(dest)}</Number>
  </Dial>
</Response>`;
    return xml(laml);
  } catch (e) {
    console.error("[pbx-sip-outbound] error", e);
    return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry, an error occurred placing the call.</Say><Hangup/></Response>`, 200);
  }
});
