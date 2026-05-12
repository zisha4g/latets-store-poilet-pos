// pbx-email-disconnect
// Revokes Google OAuth tokens and deletes the user's pbx_email_accounts row
// (cascading away their mirrored messages).

import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, userFromAuthHeader, loadAccount } from "../_shared/gmail.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await userFromAuthHeader(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = adminClient();
  const account = await loadAccount(admin, user.id);
  if (!account) return json({ ok: true, already: true });

  // Best-effort token revocation; don't fail the disconnect on errors.
  const token = account.refresh_token || account.access_token;
  if (token) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch (e) {
      console.warn("[pbx-email-disconnect] revoke failed", (e as Error).message);
    }
  }

  await admin.from("pbx_email_accounts").delete().eq("id", account.id);
  return json({ ok: true });
});
