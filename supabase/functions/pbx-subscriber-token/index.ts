// pbx-subscriber-token — mints a SignalWire Call Fabric token for the caller.
//
// Per Supabase user we ensure a SignalWire Subscriber exists with a known
// deterministic password (HMAC of API token + user id), then mint a Fabric
// token via POST /api/fabric/subscribers/tokens { reference, password }.
//
// Required secrets:
//   SIGNALWIRE_PROJECT_ID
//   SIGNALWIRE_API_TOKEN
//   SIGNALWIRE_SPACE          (e.g. "4gonwheels.signalwire.com")

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

// Deterministic per-user password so we don't need to store it. Same input
// always yields the same string, but it's not guessable without API_TOKEN.
const derivePassword = async (apiToken: string, userId: string): Promise<string> => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(apiToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`storepilot:${userId}`));
  // Hex, take first 32 chars + a fixed special so it satisfies any
  // password-complexity rules SignalWire might enforce.
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `Sp1!${hex.slice(0, 28)}`;
};

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
    const user = userData.user;
    const userId = user.id;
    const email = String(user.email ?? `${userId}@user.local`);
    const reference = `storepilot-${userId}`;
    const password = await derivePassword(API_TOKEN, userId);
    const basic = btoa(`${PROJECT_ID}:${API_TOKEN}`);
    const baseUrl = `https://${SPACE}`;

    const swFetch = (path: string, init: RequestInit = {}) => fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    // ---- Step 1: ensure subscriber exists. ------------------------------
    let subscriberId: string | null = null;
    const listPaths = [
      `/api/fabric/resources/subscribers?reference=${encodeURIComponent(reference)}`,
      `/api/fabric/subscribers?reference=${encodeURIComponent(reference)}`,
    ];
    for (const p of listPaths) {
      try {
        const r = await swFetch(p);
        if (!r.ok) continue;
        const j: any = await r.json().catch(() => null);
        const items: any[] = j?.data ?? j?.subscribers ?? (Array.isArray(j) ? j : []);
        const found = items.find((s) => s?.reference === reference || s?.email === email);
        if (found?.id) { subscriberId = String(found.id); break; }
      } catch (_e) { /* try next */ }
    }

    // Create if missing.
    if (!subscriberId) {
      const createBody = {
        reference,
        email,
        password,
        first_name: (user.user_metadata?.first_name as string) || "StorePilot",
        last_name: (user.user_metadata?.last_name as string) || "User",
      };
      const createPaths = [
        `/api/fabric/resources/subscribers`,
        `/api/fabric/subscribers`,
      ];
      for (const p of createPaths) {
        const resp = await swFetch(p, { method: "POST", body: JSON.stringify(createBody) });
        if (resp.ok) {
          try {
            const j = await resp.json();
            subscriberId = String(j?.id ?? j?.subscriber?.id ?? j?.data?.id ?? "");
          } catch { /* ignore */ }
          if (subscriberId) break;
        }
      }
    }

    if (!subscriberId) {
      return json(502, { error: "could not create or find subscriber" });
    }

    // ---- Step 2: ensure password is the deterministic one. --------------
    // The subscriber may have been created previously with a different
    // (random) password. PATCH it to our deterministic value so token mint
    // succeeds. Best-effort — ignore failure and try mint anyway.
    const patchPaths = [
      `/api/fabric/resources/subscribers/${subscriberId}`,
      `/api/fabric/subscribers/${subscriberId}`,
    ];
    for (const p of patchPaths) {
      try {
        const r = await swFetch(p, { method: "PATCH", body: JSON.stringify({ password }) });
        if (r.ok) break;
        // Some APIs use PUT.
        const r2 = await swFetch(p, { method: "PUT", body: JSON.stringify({ password }) });
        if (r2.ok) break;
      } catch (_e) { /* ignore */ }
    }

    // ---- Step 3: mint Fabric token via password grant. ------------------
    const mintAttempts: Array<{ path: string; status: number; body: string }> = [];
    const mintCandidates: Array<{ path: string; body: unknown }> = [
      { path: `/api/fabric/subscribers/tokens`, body: { reference, password } },
      { path: `/api/fabric/resources/subscribers/${subscriberId}/tokens`, body: { password } },
      { path: `/api/fabric/subscribers/${subscriberId}/tokens`, body: { password } },
    ];

    for (const c of mintCandidates) {
      try {
        const resp = await swFetch(c.path, { method: "POST", body: JSON.stringify(c.body) });
        const text = await resp.text();
        mintAttempts.push({ path: c.path, status: resp.status, body: text.slice(0, 300) });
        if (resp.ok) {
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch { /* ignore */ }
          const token =
            parsed?.token ??
            parsed?.subscriber_token ??
            parsed?.access_token ??
            parsed?.jwt_token ?? null;
          if (token) {
            return json(200, { token, subscriberId, reference, usedPath: c.path });
          }
        }
      } catch (e) {
        mintAttempts.push({ path: c.path, status: 0, body: String((e as Error).message) });
      }
    }

    return json(502, {
      error: "no Fabric token endpoint succeeded",
      subscriberId,
      reference,
      attempts: mintAttempts,
    });
  } catch (e) {
    console.error("pbx-subscriber-token error", e);
    return json(500, { error: String((e as Error).message) });
  }
});
