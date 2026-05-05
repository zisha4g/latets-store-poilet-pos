// pbx-discover-subscriber — one-shot diagnostic. Lists what the SignalWire
// Fabric API knows about our subscriber so we can determine the correct
// PSTN-to-subscriber dial address for inbound TwiML.
//
// Returns a JSON dump of every endpoint that responded.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const PROJECT_ID = Deno.env.get("SIGNALWIRE_PROJECT_ID")!;
    const API_TOKEN = Deno.env.get("SIGNALWIRE_API_TOKEN")!;
    const SPACE = Deno.env.get("SIGNALWIRE_SPACE")!;

    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json(401, { error: "unauthorized" });
    const reference = `storepilot-${userData.user.id}`;
    const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);

    const probes = [
      `GET /api/fabric/subscribers`,
      `GET /api/fabric/subscribers?reference=${reference}`,
      `GET /api/fabric/subscribers/${reference}`,
      `GET /api/fabric/resources`,
      `GET /api/fabric/resources?type=subscriber`,
      `GET /api/fabric/addresses`,
      `GET /api/fabric/addresses?context=storepilot-${userData.user.id}`,
      `GET /api/fabric/sip_endpoints`,
    ];

    const out: Array<{ probe: string; status: number; body: unknown }> = [];
    for (const p of probes) {
      const [method, path] = p.split(" ");
      try {
        const resp = await fetch(`https://${SPACE}${path}`, {
          method,
          headers: {
            "Authorization": `Basic ${basic}`,
            "Accept": "application/json",
          },
        });
        const text = await resp.text();
        let body: unknown = text;
        try { body = JSON.parse(text); } catch { /* keep text */ }
        out.push({ probe: p, status: resp.status, body });
      } catch (e) {
        out.push({ probe: p, status: 0, body: String((e as Error).message) });
      }
    }

    return json(200, { reference, probes: out });
  } catch (e) {
    return json(500, { error: String((e as Error).message) });
  }
});
