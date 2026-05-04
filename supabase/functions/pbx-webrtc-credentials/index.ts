// Returns the WebRTC SIP credentials for the authenticated user.
// Frontend uses these to register a JsSIP UA over WSS so the browser can
// receive calls (Step 6 — Answer in browser).
//
// Requires the caller's Supabase JWT in the Authorization header. Looks up
// the row in pbx_webrtc_endpoints. If no row exists (admin hasn't provisioned
// yet) returns 404 so the frontend can hide the softphone UI gracefully.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "missing auth" }, 401);

  // Resolve auth user from the caller's JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);

  const userId = userRes.user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: ep, error } = await admin
    .from("pbx_webrtc_endpoints")
    .select("sip_username, sip_password, sip_domain, ws_url, display_name, enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[pbx-webrtc-credentials] db error", error);
    return json({ error: "db error" }, 500);
  }
  if (!ep || !ep.enabled) {
    return json({ error: "no endpoint provisioned" }, 404);
  }

  return json({
    sip_username: ep.sip_username,
    sip_password: ep.sip_password,
    sip_domain: ep.sip_domain,
    ws_url: ep.ws_url,
    display_name: ep.display_name ?? null,
  });
});
