// pbx-email-attachment
// Returns a Gmail attachment as a base64 data URL for the browser to render
// or download.

import { corsHeaders } from "../_shared/cors.ts";
import {
  adminClient,
  userFromAuthHeader,
  loadAccount,
  gmailFetch,
} from "../_shared/gmail.ts";

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

  const { message_id, attachment_id, mime_type, filename } = await req.json().catch(() => ({} as any));
  if (!message_id || !attachment_id) return json({ error: "message_id + attachment_id required" }, 400);

  const admin = adminClient();
  const account = await loadAccount(admin, user.id);
  if (!account) return json({ error: "no gmail account connected" }, 404);

  // Verify ownership via mirror.
  const { data: row } = await admin
    .from("pbx_email_messages")
    .select("id")
    .eq("user_id", user.id)
    .eq("gmail_message_id", message_id)
    .maybeSingle();
  if (!row) return json({ error: "not found" }, 404);

  const res = await gmailFetch(
    admin,
    account,
    `/users/me/messages/${message_id}/attachments/${attachment_id}`,
  );
  if (!res.ok) return json({ error: "fetch failed" }, 502);
  const j = await res.json();
  // Convert base64url → standard base64 for data-url use.
  const std = String(j.data || "").replace(/-/g, "+").replace(/_/g, "/");
  return json({
    ok: true,
    filename: filename || "attachment",
    mimeType: mime_type || "application/octet-stream",
    size: j.size || 0,
    base64: std,
  });
});
