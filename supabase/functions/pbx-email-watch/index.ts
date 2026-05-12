// pbx-email-watch
// Renews Gmail users.watch() subscriptions so push notifications keep flowing.
// Watches expire after 7 days; run this on a daily cron.
//
// Usage:
//   - HTTP POST with service-role auth: renews ALL accounts whose watch is
//     expiring within 24h (or already expired / never set).
//   - HTTP POST with user JWT + { account_id?: uuid }: renews the caller's
//     own account (used immediately after connect).

import { corsHeaders } from "../_shared/cors.ts";
import {
  adminClient,
  userFromAuthHeader,
  gmailFetch,
  type EmailAccount,
} from "../_shared/gmail.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

async function renewOne(admin: any, account: EmailAccount, topic: string) {
  const res = await gmailFetch(admin, account, "/users/me/watch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topicName: topic, labelIds: ["INBOX", "SENT"] }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[pbx-email-watch] renew failed for ${account.email}:`, txt);
    return { ok: false, error: txt };
  }
  const j = await res.json();
  const expiry = j.expiration ? new Date(Number(j.expiration)).toISOString() : null;
  const history = j.historyId ? Number(j.historyId) : null;
  const patch: any = { watch_expiration: expiry, updated_at: new Date().toISOString() };
  // Only seed history_id if this account never synced before.
  if (history && !account.history_id) patch.history_id = history;
  await admin.from("pbx_email_accounts").update(patch).eq("id", account.id);
  return { ok: true, expiration: expiry };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const topic = Deno.env.get("GCP_PUBSUB_TOPIC");
  if (!topic) return json({ error: "GCP_PUBSUB_TOPIC not configured" }, 500);

  const admin = adminClient();
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isService = serviceKey && authHeader === `Bearer ${serviceKey}`;

  if (isService) {
    const cutoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { data } = await admin
      .from("pbx_email_accounts")
      .select("id,user_id,email,access_token,refresh_token,token_expires_at,history_id,scope,watch_expiration")
      .or(`watch_expiration.is.null,watch_expiration.lt.${cutoff}`);
    const results: any[] = [];
    for (const acc of (data || []) as EmailAccount[]) {
      results.push({ email: acc.email, ...(await renewOne(admin, acc, topic)) });
    }
    return json({ ok: true, renewed: results.length, results });
  }

  const user = await userFromAuthHeader(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data } = await admin
    .from("pbx_email_accounts")
    .select("id,user_id,email,access_token,refresh_token,token_expires_at,history_id,scope")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return json({ error: "no gmail account connected" }, 404);
  const res = await renewOne(admin, data as EmailAccount, topic);
  return json(res, res.ok ? 200 : 502);
});
