// Shared Gmail helpers: token refresh + thin REST client.
//
// Loaded by all pbx-email-* edge functions. Keeps OAuth refresh logic in one
// place and exposes a `gmailFetch` that auto-refreshes once on 401.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

export interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  history_id: number | null;
  scope: string | null;
}

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
].join(" ");

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

export async function userFromAuthHeader(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return null;
  const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

export async function loadAccount(admin: SupabaseClient, userId: string): Promise<EmailAccount | null> {
  const { data } = await admin
    .from("pbx_email_accounts")
    .select("id,user_id,email,access_token,refresh_token,token_expires_at,history_id,scope")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as EmailAccount) ?? null;
}

async function refreshAccessToken(admin: SupabaseClient, account: EmailAccount): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("missing google oauth secrets");
  if (!account.refresh_token) throw new Error("no refresh token on account");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tok = await res.json();
  if (!res.ok || !tok.access_token) {
    throw new Error(`refresh failed: ${JSON.stringify(tok)}`);
  }
  const expiresAt = new Date(Date.now() + (Number(tok.expires_in || 3600) - 60) * 1000).toISOString();
  await admin
    .from("pbx_email_accounts")
    .update({
      access_token: tok.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  account.access_token = tok.access_token;
  account.token_expires_at = expiresAt;
  return tok.access_token as string;
}

export async function ensureAccessToken(admin: SupabaseClient, account: EmailAccount): Promise<string> {
  if (!account.access_token) return refreshAccessToken(admin, account);
  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now() + 30_000) {
    return refreshAccessToken(admin, account);
  }
  return account.access_token;
}

/**
 * Fetch a Gmail API path with auto-refresh on 401.
 * @param path e.g. "/users/me/messages?maxResults=50"
 */
export async function gmailFetch(
  admin: SupabaseClient,
  account: EmailAccount,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const doFetch = async (token: string) => {
    return fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  };

  let token = await ensureAccessToken(admin, account);
  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshAccessToken(admin, account);
    res = await doFetch(token);
  }
  return res;
}

export function parseAddrList(raw: string | undefined): string[] {
  if (!raw) return [];
  // Very small RFC-5322 splitter: split on commas not inside quotes/angle brackets.
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of raw) {
    if (ch === "<" || ch === '"') depth++;
    else if (ch === ">" || (ch === '"' && depth > 0)) depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      const v = buf.trim();
      if (v) out.push(v);
      buf = "";
    } else {
      buf += ch;
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

export function extractEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim().toLowerCase();
}

export function extractName(addr: string): string {
  const m = addr.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  return (m ? m[1].trim() : "").replace(/^"+|"+$/g, "");
}

export function headerMap(headers: Array<{ name: string; value: string }> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers || []) out[h.name.toLowerCase()] = h.value;
  return out;
}

export interface MetadataInsert {
  user_id: string;
  account_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  direction: "inbound" | "outbound";
  from_addr: string | null;
  from_name: string | null;
  to_addrs: string[];
  cc_addrs: string[];
  subject: string | null;
  snippet: string | null;
  internal_date: string;
  labels: string[];
  is_read: boolean;
  has_attachments: boolean;
  in_reply_to: string | null;
  references_header: string | null;
  message_id_header: string | null;
}

export function buildMetadataRow(
  account: EmailAccount,
  msg: any,
): MetadataInsert {
  const h = headerMap(msg.payload?.headers);
  const labels: string[] = msg.labelIds || [];
  const direction: "inbound" | "outbound" = labels.includes("SENT") ? "outbound" : "inbound";
  const fromList = parseAddrList(h["from"]);
  const fromRaw = fromList[0] || "";
  const fromAddr = fromRaw ? extractEmail(fromRaw) : null;
  const fromName = fromRaw ? extractName(fromRaw) : null;
  const toAddrs = parseAddrList(h["to"]).map(extractEmail);
  const ccAddrs = parseAddrList(h["cc"]).map(extractEmail);
  const internalMs = Number(msg.internalDate || 0);
  const hasAttachments = messageHasAttachments(msg.payload);
  return {
    user_id: account.user_id,
    account_id: account.id,
    gmail_message_id: msg.id,
    gmail_thread_id: msg.threadId,
    direction,
    from_addr: fromAddr,
    from_name: fromName,
    to_addrs: toAddrs,
    cc_addrs: ccAddrs,
    subject: h["subject"] || null,
    snippet: msg.snippet || null,
    internal_date: new Date(internalMs || Date.now()).toISOString(),
    labels,
    is_read: !labels.includes("UNREAD"),
    has_attachments: hasAttachments,
    in_reply_to: h["in-reply-to"] || null,
    references_header: h["references"] || null,
    message_id_header: h["message-id"] || null,
  };
}

function messageHasAttachments(payload: any): boolean {
  if (!payload) return false;
  if (payload.filename && payload.body?.attachmentId) return true;
  if (Array.isArray(payload.parts)) {
    return payload.parts.some((p: any) => messageHasAttachments(p));
  }
  return false;
}
