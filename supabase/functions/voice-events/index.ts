// SignalWire status-callback receiver. SignalWire posts call lifecycle
// events here (initiated, ringing, answered, completed). We upsert a row
// in pbx_call_logs keyed by CallSid so the dashboard / live-calls / reports
// see real-time call activity.
//
// Body (form-urlencoded):
//   CallSid, ParentCallSid, From, To, CallStatus, Direction,
//   CallDuration, RecordingUrl, Timestamp, ...
//
// Tenant resolution (in order):
//  1. Existing row with this CallSid -> reuse user_id.
//  2. SIP user in From -> pbx_devices.
//  3. To/From E.164 -> pbx_phone_numbers (inbound DID hit).
//
// Deploy with --no-verify-jwt.

import { createSupabaseClient } from "../_shared/supabase.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const ok = () => new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });

const parseSipUser = (v: string | null) => {
  if (!v) return null;
  const m = v.match(/sip:([^@>;\s]+)@([^>;\s]+)/i);
  if (!m) return null;
  return { user: m[1].toLowerCase(), domain: m[2].toLowerCase().split(":")[0] };
};

const isE164 = (v: string | null) => !!v && /^\+\d{6,15}$/.test(v);

// Map SignalWire/LaML CallStatus -> our pbx_call_logs.status vocabulary.
const mapStatus = (s: string | null) => {
  switch ((s || "").toLowerCase()) {
    case "queued":
    case "initiated":
      return "initiated";
    case "ringing":
      return "ringing";
    case "in-progress":
    case "answered":
      return "answered";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "no-answer":
    case "noanswer":
      return "no-answer";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "failed":
      return "failed";
    default:
      return s || "unknown";
  }
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const ct = req.headers.get("content-type") || "";

  let form: URLSearchParams;
  if (req.method === "POST" && ct.includes("application/x-www-form-urlencoded")) {
    form = new URLSearchParams(await req.text());
  } else if (req.method === "POST" && ct.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    form = new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
  } else {
    form = url.searchParams;
  }

  const callSid = form.get("CallSid") || form.get("call_sid") || "";
  const parentSid = form.get("ParentCallSid") || "";
  const from = form.get("From");
  const to = form.get("To");
  const callStatus = form.get("CallStatus") || form.get("DialCallStatus");
  const directionRaw = (form.get("Direction") || "").toLowerCase();
  const recordingUrl = form.get("RecordingUrl") || null;

  console.log(`[voice-events] sid=${callSid} parent=${parentSid} status=${callStatus} dir=${directionRaw} from=${from} to=${to}`);

  if (!callSid) {
    console.warn("[voice-events] missing CallSid");
    return ok();
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createSupabaseClient(supabaseUrl, serviceKey);

  // 1. Existing row?
  const { data: existing } = await admin
    .from("pbx_call_logs")
    .select("id, user_id, direction, device_id, extension_id, started_at")
    .eq("signalwire_call_sid", callSid)
    .maybeSingle();

  let userId: string | null = existing?.user_id ?? null;
  let deviceId: string | null = existing?.device_id ?? null;
  let extensionId: string | null = existing?.extension_id ?? null;
  let direction: string = existing?.direction ?? (directionRaw.includes("outbound") ? "outbound" : "inbound");

  // 2. Look up by SIP user (outbound from a desk phone).
  if (!userId) {
    const sip = parseSipUser(from);
    if (sip) {
      // Tolerate legacy rows that stored "user@domain" in sip_username.
      const { data: devs } = await admin
        .from("pbx_devices")
        .select("id, user_id, extension_id, sip_username, sip_domain")
        .or(`sip_username.eq.${sip.user},sip_username.eq.${sip.user}@${sip.domain}`)
        .limit(5);
      const dev = (devs || []).find((d) =>
        (d.sip_domain || "").toLowerCase() === sip.domain ||
        (d.sip_username || "").toLowerCase().endsWith(`@${sip.domain}`)
      ) || (devs || [])[0];
      if (dev) {
        userId = dev.user_id;
        deviceId = dev.id;
        extensionId = dev.extension_id;
        direction = "outbound";
      }
    }
  }

  // 3. Look up by DID (inbound to a tenant's number).
  if (!userId && isE164(to)) {
    const { data: ph } = await admin
      .from("pbx_phone_numbers")
      .select("user_id")
      .eq("number", to)
      .maybeSingle();
    if (ph) {
      userId = ph.user_id;
      direction = "inbound";
    }
  }

  if (!userId) {
    console.warn(`[voice-events] could not resolve tenant for sid=${callSid} from=${from} to=${to}`);
    return ok(); // don't 500 SignalWire
  }

  const status = mapStatus(callStatus);
  const nowIso = new Date().toISOString();
  const externalNumber = direction === "outbound" ? to : (from && isE164(from) ? from : (parseSipUser(from)?.user || from));

  // Prefer DialCallDuration (talk time on the bridged leg) over CallDuration
  // (which on SIP can include ring time). Fall back to whichever is present.
  const dialDur = parseInt(form.get("DialCallDuration") || "0", 10) || 0;
  const callDur = parseInt(form.get("CallDuration") || "0", 10) || 0;
  const talkDuration = dialDur || callDur;

  const row: Record<string, unknown> = {
    user_id: userId,
    signalwire_call_sid: callSid,
    direction,
    status,
    from_number: from,
    to_number: to,
    phone_number: externalNumber,
    duration_seconds: talkDuration || null,
    recording_url: recordingUrl,
  };
  if (deviceId) row.device_id = deviceId;
  if (extensionId) row.extension_id = extensionId;
  if (!existing?.started_at) row.started_at = nowIso;
  if (status === "answered") {
    // First time we see the call answered — record the moment so the UI
    // can compute true talk time as ended_at - answered_at.
    row.answered_at = nowIso;
  }
  if (status === "completed" || status === "failed" || status === "busy" || status === "no-answer" || status === "canceled") {
    row.ended_at = nowIso;
  }

  const { error: upErr } = await admin
    .from("pbx_call_logs")
    .upsert(row, { onConflict: "signalwire_call_sid" });

  if (upErr) console.error("[voice-events] upsert error", upErr);

  return ok();
});
