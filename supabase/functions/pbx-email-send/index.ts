// pbx-email-send
// Send a new email or a reply via Gmail API users.messages.send.
//
// Body:
//   {
//     to: string | string[],
//     cc?: string | string[],
//     bcc?: string | string[],
//     subject: string,
//     body_html?: string,
//     body_text?: string,
//     reply_to_message_id?: string,   // our local pbx_email_messages.gmail_message_id
//   }
//
// When reply_to_message_id is provided we look up the source message,
// reuse its threadId, prefix the subject with "Re: " if needed and set
// In-Reply-To + References headers.

import { corsHeaders } from "../_shared/cors.ts";
import {
  adminClient,
  userFromAuthHeader,
  loadAccount,
  gmailFetch,
  buildMetadataRow,
} from "../_shared/gmail.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

function toArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

function base64UrlEncode(input: string): string {
  // Encode UTF-8 → base64 → URL-safe
  const utf8 = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMime(opts: {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
}) {
  const boundary = `bnd_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const lines: string[] = [];
  lines.push(`From: ${opts.from}`);
  lines.push(`To: ${opts.to.join(", ")}`);
  if (opts.cc.length) lines.push(`Cc: ${opts.cc.join(", ")}`);
  if (opts.bcc.length) lines.push(`Bcc: ${opts.bcc.join(", ")}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push("MIME-Version: 1.0");
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);

  if (opts.html && opts.text) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(opts.text);
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(opts.html);
    lines.push(`--${boundary}--`);
  } else if (opts.html) {
    lines.push(`Content-Type: text/html; charset="UTF-8"`);
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(opts.html);
  } else {
    lines.push(`Content-Type: text/plain; charset="UTF-8"`);
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(opts.text || "");
  }
  return lines.join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await userFromAuthHeader(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const payload = await req.json().catch(() => ({} as any));
  const to = toArray(payload.to);
  if (!to.length) return json({ error: "to required" }, 400);
  const cc = toArray(payload.cc);
  const bcc = toArray(payload.bcc);
  let subject = String(payload.subject || "").trim();
  const html = String(payload.body_html || "");
  const text = String(payload.body_text || "");
  if (!html && !text) return json({ error: "body required" }, 400);

  const admin = adminClient();
  const account = await loadAccount(admin, user.id);
  if (!account) return json({ error: "no gmail account connected" }, 404);

  let threadId: string | undefined;
  let inReplyTo: string | null = null;
  let references: string | null = null;
  if (payload.reply_to_message_id) {
    const { data: src } = await admin
      .from("pbx_email_messages")
      .select("gmail_thread_id,subject,message_id_header,references_header,in_reply_to")
      .eq("user_id", user.id)
      .eq("gmail_message_id", payload.reply_to_message_id)
      .maybeSingle();
    if (src) {
      threadId = src.gmail_thread_id;
      inReplyTo = src.message_id_header || null;
      references = [src.references_header, src.message_id_header].filter(Boolean).join(" ") || null;
      if (!subject && src.subject) subject = src.subject.match(/^re:/i) ? src.subject : `Re: ${src.subject}`;
    }
  }
  if (!subject) subject = "(no subject)";

  const mime = buildMime({
    from: account.email,
    to,
    cc,
    bcc,
    subject,
    html,
    text,
    inReplyTo,
    references,
  });
  const raw = base64UrlEncode(mime);

  const sendRes = await gmailFetch(admin, account, "/users/me/messages/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });
  if (!sendRes.ok) {
    const errText = await sendRes.text();
    return json({ error: `gmail send failed: ${errText}` }, 502);
  }
  const sent = await sendRes.json();

  // Mirror the sent message into our table immediately so the UI updates without
  // waiting for sync / push.
  try {
    const params = new URLSearchParams({ format: "metadata" });
    for (const h of ["From", "To", "Cc", "Subject", "Date", "Message-ID", "In-Reply-To", "References"]) {
      params.append("metadataHeaders", h);
    }
    const metaRes = await gmailFetch(admin, account, `/users/me/messages/${sent.id}?${params.toString()}`);
    if (metaRes.ok) {
      const msg = await metaRes.json();
      const row = buildMetadataRow(account, msg);
      await admin.from("pbx_email_messages").upsert(row, { onConflict: "account_id,gmail_message_id" });
    }
  } catch (e) {
    console.warn("[pbx-email-send] mirror failed", (e as Error).message);
  }

  return json({ ok: true, id: sent.id, threadId: sent.threadId });
});
