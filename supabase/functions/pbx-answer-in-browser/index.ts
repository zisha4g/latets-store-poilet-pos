// pbx-answer-in-browser — redirects an in-progress inbound call into the
// caller's SignalWire Call Fabric subscriber so the browser SDK receives
// an invite that can be answered in-tab.
//
// Flow:
//   1. Frontend popup ("Answer in browser") POSTs { provider_call_id }.
//   2. We verify the caller owns the matching phone_call_sessions row.
//   3. We POST to SignalWire's LaML Calls API with a new fetch URL that
//      points at voice-webhook?action=bridge_subscriber&user=<userId>.
//   4. SignalWire fetches that URL and gets SWML connecting to the
//      subscriber resource. The subscriber's online() handler fires a
//      `call.received` event in the browser, which the SoftphoneContext
//      auto-accepts when an answer was already requested.
//
// Required secrets:
//   SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE,
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   VOICE_WEBHOOK_URL (e.g. https://<project>.supabase.co/functions/v1/voice-webhook)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const PROJECT_ID = Deno.env.get("SIGNALWIRE_PROJECT_ID");
  const API_TOKEN = Deno.env.get("SIGNALWIRE_API_TOKEN");
  const SPACE = Deno.env.get("SIGNALWIRE_SPACE");
  const VOICE_WEBHOOK_URL =
    Deno.env.get("VOICE_WEBHOOK_URL") ||
    (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/voice-webhook` : "");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY ||
      !PROJECT_ID || !API_TOKEN || !SPACE || !VOICE_WEBHOOK_URL) {
    return json(500, { error: "server misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, { error: "missing auth" });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json(401, { error: "unauthorized" });
  const userId = userRes.user.id;

  let body: { provider_call_id?: string; addr?: string };
  try { body = await req.json(); } catch { return json(400, { error: "bad json" }); }

  const callSid = String(body.provider_call_id || "").trim();
  if (!callSid) return json(400, { error: "missing provider_call_id" });
  const addr = body.addr === "public" ? "public" : "private";

  // Verify the caller is allowed to grab this call. We accept it if the
  // session belongs to them OR if they are the assigned ringer on the
  // extension that's currently being dialed.
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: session } = await adminClient
    .from("phone_call_sessions")
    .select("id, user_id, metadata")
    .eq("provider", "signalwire")
    .eq("provider_call_id", callSid)
    .maybeSingle();

  if (!session) return json(404, { error: "call not found" });

  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  const assignedUserId = String(meta.assigned_user_id ?? "");
  const ownsSession = session.user_id === userId;
  const isAssigned = assignedUserId === userId;
  if (!ownsSession && !isAssigned) {
    return json(403, { error: "not authorized for this call" });
  }

  // Build the bridge URL SignalWire will fetch. It returns SWML that
  // connects the live call to /private|/public/storepilot-<userId>.
  const bridgeUrl = new URL(VOICE_WEBHOOK_URL);
  bridgeUrl.searchParams.set("action", "bridge_subscriber");
  bridgeUrl.searchParams.set("user", userId);
  bridgeUrl.searchParams.set("addr", addr);

  // Modify the live call. SignalWire's LaML API exposes call-modify at
  // POST /api/laml/2010-04-01/Accounts/{ProjectId}/Calls/{CallSid}.json
  // with form-encoded fields { Url, Method }.
  const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);
  const modifyUrl =
    `https://${SPACE}/api/laml/2010-04-01/Accounts/${PROJECT_ID}/Calls/${encodeURIComponent(callSid)}.json`;

  const form = new URLSearchParams();
  form.set("Url", bridgeUrl.toString());
  form.set("Method", "GET");

  const resp = await fetch(modifyUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: form.toString(),
  });

  const text = await resp.text();
  if (!resp.ok) {
    console.error("call-modify failed", resp.status, text);
    return json(resp.status, { error: "call-modify failed", body: text });
  }

  return json(200, { ok: true, bridgeUrl: bridgeUrl.toString() });
});
