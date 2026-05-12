// pbx-email-pubsub
// Receives Gmail push notifications from Google Cloud Pub/Sub.
//
// Pub/Sub push delivery posts a JSON envelope:
//   { message: { data: <base64 JSON>, messageId, publishTime, ... }, subscription }
// The decoded data is { emailAddress, historyId }.
//
// We look up the account by email and trigger pbx-email-sync for that user
// using the service role.
//
// To prevent unauthorised pings, this endpoint requires
//   ?token=<PBX_EMAIL_PUBSUB_VERIFY_TOKEN>
// which must match the secret. Configure the Pub/Sub push subscription with
// the URL including the token, and (recommended) also configure Pub/Sub OIDC
// auth on top.

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient } from "../_shared/gmail.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  const verifyToken = Deno.env.get("PBX_EMAIL_PUBSUB_VERIFY_TOKEN");
  if (verifyToken && url.searchParams.get("token") !== verifyToken) {
    return json({ error: "forbidden" }, 403);
  }

  let envelope: any;
  try { envelope = await req.json(); }
  catch { return json({ error: "bad json" }, 400); }

  const dataB64: string | undefined = envelope?.message?.data;
  if (!dataB64) return json({ ok: true, ignored: "no_data" });

  let payload: { emailAddress?: string; historyId?: string | number } = {};
  try {
    const padded = dataB64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    payload = JSON.parse(decoded);
  } catch {
    return json({ ok: true, ignored: "bad_data" });
  }

  const email = String(payload.emailAddress || "").toLowerCase();
  if (!email) return json({ ok: true, ignored: "no_email" });

  const admin = adminClient();
  const { data: account } = await admin
    .from("pbx_email_accounts")
    .select("id,user_id")
    .ilike("email", email)
    .maybeSingle();
  if (!account) {
    // Ack to stop redelivery
    return json({ ok: true, ignored: "no_account" });
  }

  // Trigger sync for this user via service role auth.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const syncRes = await fetch(`${supabaseUrl}/functions/v1/pbx-email-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ user_id: account.user_id }),
  });
  const syncJson = await syncRes.json().catch(() => ({}));
  return json({ ok: true, sync: syncJson });
});
