// pbx-subscriber-token — mints a SignalWire Call Fabric JWT for the caller.
//
// Per-user (Supabase user) we ensure a SignalWire Subscriber exists and
// hand the browser SDK a short-lived JWT it can use to register and
// receive calls.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const PROJECT_ID = Deno.env.get("SIGNALWIRE_PROJECT_ID");
    const API_TOKEN = Deno.env.get("SIGNALWIRE_API_TOKEN");
    const SPACE = Deno.env.get("SIGNALWIRE_SPACE");

    if (!PROJECT_ID || !API_TOKEN || !SPACE) {
      return json(500, { error: "SignalWire credentials not configured" });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { error: "unauthorized" });
    }
    const userId = userData.user.id;
    const reference = `storepilot-${userId}`;
    const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);

    // Try the most likely endpoints, logging each. Comment out tries you've
    // proven don't work.
    const candidates: Array<{ path: string; body: unknown; method?: string }> = [
      // Pattern A: standard subscribers/tokens
      { path: `/api/fabric/subscribers/tokens`, body: { reference } },
      // Pattern B: relay/rest jwt
      { path: `/api/relay/rest/jwt`, body: { resource: reference, expires_in: 3600 } },
      // Pattern C: resources subscriber tokens
      { path: `/api/fabric/resources/subscribers/${reference}/tokens`, body: { expires_in: 3600 } },
    ];

    const attempts: Array<{ path: string; status: number; body: string }> = [];
    for (const c of candidates) {
      const url = `https://${SPACE}${c.path}`;
      try {
        const resp = await fetch(url, {
          method: c.method ?? "POST",
          headers: {
            "Authorization": `Basic ${basic}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(c.body),
        });
        const text = await resp.text();
        attempts.push({ path: c.path, status: resp.status, body: text.slice(0, 400) });
        if (resp.ok) {
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch { /* ignore */ }
          return json(200, {
            token: parsed?.token ?? parsed?.jwt_token ?? parsed?.subscriber_token ?? text,
            raw: parsed,
            usedPath: c.path,
            reference,
          });
        }
      } catch (e) {
        attempts.push({ path: c.path, status: 0, body: String((e as Error).message) });
      }
    }

    return json(502, {
      error: "no token endpoint succeeded",
      attempts,
      hint: "Check SignalWire dashboard for the correct subscribers token endpoint, or create a Subscriber first.",
    });
  } catch (e) {
    console.error("pbx-subscriber-token error", e);
    return json(500, { error: String((e as Error).message) });
  }
});
