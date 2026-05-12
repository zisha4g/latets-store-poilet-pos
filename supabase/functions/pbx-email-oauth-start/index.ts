// pbx-email-oauth-start
// Returns the Google OAuth consent URL for the current user.
// The user JWT is encoded into `state` so the callback can attribute the
// resulting tokens to the right Supabase user.

import { corsHeaders } from "../_shared/cors.ts";
import { userFromAuthHeader, GMAIL_SCOPES } from "../_shared/gmail.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI");
  if (!clientId || !redirectUri) return json({ error: "oauth not configured" }, 500);

  const user = await userFromAuthHeader(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  // We use the user's access JWT as the `state`. The callback validates it
  // by calling supabase.auth.getUser(jwt) so a stolen/forged state cannot
  // attach Gmail tokens to another account.
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", jwt);

  return json({ url: url.toString() });
});
