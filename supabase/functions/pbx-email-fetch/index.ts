// pbx-email-fetch
// Returns the full body + attachment list for a single Gmail message.
// Body is returned as both HTML (preferred) and plain text.
// Also marks UNREAD off if `markRead=true` was provided.

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

function decodeB64Url(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  try {
    const bin = atob(padded + pad);
    // Convert binary string → UTF-8
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

interface ExtractedBody {
  html: string;
  text: string;
  attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId: string }>;
}

function extractParts(payload: any, out: ExtractedBody) {
  if (!payload) return;
  const mime = payload.mimeType || "";
  if (payload.body?.attachmentId && (payload.filename || mime.startsWith("image/") || mime.startsWith("application/"))) {
    out.attachments.push({
      filename: payload.filename || "attachment",
      mimeType: mime,
      size: payload.body.size || 0,
      attachmentId: payload.body.attachmentId,
    });
  } else if (mime === "text/html" && payload.body?.data && !out.html) {
    out.html = decodeB64Url(payload.body.data);
  } else if (mime === "text/plain" && payload.body?.data && !out.text) {
    out.text = decodeB64Url(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const p of payload.parts) extractParts(p, out);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await userFromAuthHeader(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const { message_id, markRead } = await req.json().catch(() => ({} as any));
  if (!message_id) return json({ error: "message_id required" }, 400);

  const admin = adminClient();
  const account = await loadAccount(admin, user.id);
  if (!account) return json({ error: "no gmail account connected" }, 404);

  // Confirm the message belongs to this user (via our mirror) — defence in depth.
  const { data: row } = await admin
    .from("pbx_email_messages")
    .select("id,labels")
    .eq("user_id", user.id)
    .eq("gmail_message_id", message_id)
    .maybeSingle();
  if (!row) return json({ error: "not found" }, 404);

  const res = await gmailFetch(admin, account, `/users/me/messages/${message_id}?format=full`);
  if (!res.ok) {
    const errText = await res.text();
    return json({ error: `gmail fetch failed: ${errText}` }, 502);
  }
  const msg = await res.json();

  const out: ExtractedBody = { html: "", text: "", attachments: [] };
  extractParts(msg.payload, out);

  // Optionally mark read
  if (markRead && (msg.labelIds || []).includes("UNREAD")) {
    await gmailFetch(admin, account, `/users/me/messages/${message_id}/modify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    });
    await admin
      .from("pbx_email_messages")
      .update({ is_read: true, labels: (msg.labelIds || []).filter((l: string) => l !== "UNREAD") })
      .eq("user_id", user.id)
      .eq("gmail_message_id", message_id);
  }

  return json({
    ok: true,
    id: msg.id,
    threadId: msg.threadId,
    labels: msg.labelIds || [],
    html: out.html,
    text: out.text,
    attachments: out.attachments,
  });
});
