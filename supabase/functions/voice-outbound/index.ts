// SignalWire LaML handler for outbound calls placed by SIP endpoints (desk
// phones / softphones) registered to this project.
//
// SignalWire posts here when a SIP credential dials out. The body looks like:
//   From=sip:101@4gonwheels-d3049efc26a8.sip.signalwire.com
//   To=+18452740451
//   CallSid=...
//
// We:
//  1. Identify the tenant via the SIP username/domain in From -> pbx_devices.
//  2. Pick the outbound caller-ID for that tenant (default DID).
//  3. Return LaML that dials the destination as the chosen caller-ID with a
//     statusCallback pointing at our voice-events function so the call gets
//     logged to pbx_call_logs.
//
// Deploy with --no-verify-jwt so SignalWire can hit it.

import { createSupabaseClient } from "../_shared/supabase.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const xml = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });

const escapeXml = (v: string) =>
  v.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

const parseSipUser = (from: string | null) => {
  if (!from) return null;
  // Forms: sip:101@host[:port][;params]   or   "Label" <sip:101@host>
  const m = from.match(/sip:([^@>;\s]+)@([^>;\s]+)/i);
  if (!m) return null;
  return { user: m[1].toLowerCase(), domain: m[2].toLowerCase().split(":")[0] };
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  console.log(`[voice-outbound] ${req.method} ${url.pathname}`);

  const form = req.method === "POST"
    ? new URLSearchParams(await req.text())
    : url.searchParams;

  const from = form.get("From");
  const toRaw = form.get("To");
  const callSid = form.get("CallSid") || "";

  console.log(`[voice-outbound] CallSid=${callSid} From=${from} To=${toRaw}`);

  // Normalize destination. The phone may send a SIP URI like
  //   sip:8452740451@<our-space>.sip.signalwire.com
  // We want a dialable number (E.164 if possible).
  const normalizeDest = (raw: string | null): string | null => {
    if (!raw) return null;
    // sip:digits@... -> digits
    const m = raw.match(/sip:([^@>;\s]+)@/i);
    let v = m ? m[1] : raw;
    v = v.trim();
    if (v.startsWith("+")) return v;
    const digits = v.replace(/[^0-9]/g, "");
    if (!digits) return null;
    if (digits.length === 10) return `+1${digits}`;        // US/CA NANP
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return `+${digits}`;
  };
  const to = normalizeDest(toRaw);

  const sip = parseSipUser(from);
  if (!sip || !to) {
    console.warn(`[voice-outbound] cannot parse from=${from} to=${toRaw}`);
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>Missing call parameters.</Say><Hangup/></Response>`,
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createSupabaseClient(supabaseUrl, serviceKey);

  // Find the device by SIP username + domain to determine the tenant.
  // Also tolerate legacy rows that stored "user@domain" in sip_username.
  const userOnly = sip.user;
  const userAtDomain = `${sip.user}@${sip.domain}`;
  const { data: devices, error: devErr } = await admin
    .from("pbx_devices")
    .select("id, user_id, sip_username, sip_domain, extension_id")
    .or(`sip_username.eq.${userOnly},sip_username.eq.${userAtDomain}`)
    .limit(5);

  if (devErr) console.warn("[voice-outbound] device lookup error", devErr);

  const device = (devices || []).find((d) =>
    (d.sip_domain || "").toLowerCase() === sip.domain ||
    (d.sip_username || "").toLowerCase().endsWith(`@${sip.domain}`)
  ) || (devices || [])[0];

  if (!device) {
    console.warn(`[voice-outbound] no device for ${sip.user}@${sip.domain}`);
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>This phone is not provisioned. Goodbye.</Say><Hangup/></Response>`,
      403,
    );
  }

  // Pick caller ID: tenant's default outbound DID, else any DID they own.
  const { data: cliRow } = await admin
    .from("pbx_phone_numbers")
    .select("number")
    .eq("user_id", device.user_id)
    .order("is_default_outbound_cli", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const callerId = cliRow?.number || "";

  // Pre-create / upsert a call log row so the UI sees it before the call ends.
  try {
    const { error: logErr, data: logData } = await admin
      .from("pbx_call_logs")
      .upsert({
        user_id: device.user_id,
        device_id: device.id,
        extension_id: device.extension_id,
        direction: "outbound",
        status: "initiated",
        from_number: callerId || sip.user,
        to_number: to,
        phone_number: to,
        signalwire_call_sid: callSid || null,
        started_at: new Date().toISOString(),
      }, { onConflict: "signalwire_call_sid" })
      .select("id")
      .maybeSingle();
    if (logErr) console.error("[voice-outbound] pre-log upsert error", logErr);
    else console.log(`[voice-outbound] pre-log row id=${logData?.id} for tenant=${device.user_id}`);
  } catch (e) {
    console.error("[voice-outbound] pre-log threw", e);
  }

  const eventsUrl = `${supabaseUrl}/functions/v1/voice-events`;
  const callerIdAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";

  const laml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerIdAttr} answerOnBridge="true" timeout="30"
        action="${escapeXml(eventsUrl)}"
        method="POST">
    <Number statusCallback="${escapeXml(eventsUrl)}"
            statusCallbackMethod="POST"
            statusCallbackEvent="initiated ringing answered completed">${escapeXml(to)}</Number>
  </Dial>
</Response>`;

  console.log(`[voice-outbound] dialing ${to} as ${callerId || "(no CLI)"} for tenant ${device.user_id}`);
  return xml(laml);
});
