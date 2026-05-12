// pbx-email-oauth-callback
// Google redirects here after consent. Exchanges code → tokens, validates the
// `state` (the user's Supabase JWT) and upserts pbx_email_accounts. Then
// redirects the browser to the app at /pbx/email?connected=1 (or ?error=...).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { adminClient } from "../_shared/gmail.ts";

const APP_RETURN = Deno.env.get("PBX_EMAIL_APP_RETURN_URL") || "/pbx/email";

function htmlRedirect(target: string, errorMsg?: string) {
  const safe = target.replace(/[<>"']/g, "");
  const body = errorMsg
    ? `<p>Could not connect Gmail: ${errorMsg.replace(/</g, "&lt;")}</p>` +
      `<p><a href="${safe}">Return to app</a></p>`
    : `<p>Connected. Redirecting…</p>`;
  return new Response(
    `<!doctype html><html><body style="font-family:sans-serif;padding:24px">${body}` +
      `<script>setTimeout(()=>{location.replace(${JSON.stringify(safe)})}, 600)</script></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  const appUrl = Deno.env.get("APP_BASE_URL") || "";
  const returnUrl = appUrl ? `${appUrl.replace(/\/$/, "")}${APP_RETURN}` : APP_RETURN;

  if (errParam) return htmlRedirect(`${returnUrl}?error=${encodeURIComponent(errParam)}`);
  if (!code || !state) return htmlRedirect(`${returnUrl}?error=missing_code_or_state`);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirectUri) {
    return htmlRedirect(`${returnUrl}?error=server_misconfigured`);
  }

  // Validate state = user JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${state}` } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return htmlRedirect(`${returnUrl}?error=bad_state`);
  const userId = userRes.user.id;

  // Exchange code → tokens
  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tok = await tokRes.json();
  if (!tokRes.ok || !tok.access_token) {
    return htmlRedirect(`${returnUrl}?error=${encodeURIComponent("token_exchange_failed")}`);
  }
  const accessToken = tok.access_token as string;
  const refreshToken = (tok.refresh_token as string) || null;
  const expiresAt = new Date(Date.now() + (Number(tok.expires_in || 3600) - 60) * 1000).toISOString();

  // Fetch profile (email + sub)
  const profRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const prof = await profRes.json();
  if (!profRes.ok || !prof.email) {
    return htmlRedirect(`${returnUrl}?error=profile_failed`);
  }

  const admin = adminClient();
  // Preserve refresh token from a prior connection if Google didn't return one this time.
  const { data: existing } = await admin
    .from("pbx_email_accounts")
    .select("id, refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  const finalRefresh = refreshToken || existing?.refresh_token || null;
  if (!finalRefresh) {
    return htmlRedirect(`${returnUrl}?error=${encodeURIComponent("no_refresh_token_returned")}`);
  }

  const row = {
    user_id: userId,
    email: prof.email,
    google_sub: prof.sub,
    access_token: accessToken,
    refresh_token: finalRefresh,
    token_expires_at: expiresAt,
    scope: tok.scope || null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await admin.from("pbx_email_accounts").update(row).eq("id", existing.id);
  } else {
    await admin.from("pbx_email_accounts").insert({ ...row, connected_at: new Date().toISOString() });
  }

  return htmlRedirect(`${returnUrl}?connected=1`);
});
