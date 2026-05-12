// pbx-email-sync
// Pulls new messages from Gmail and mirrors metadata into pbx_email_messages.
//
// Two paths:
//  - First sync (no stored history_id): list recent messages (last 30 days),
//    fetch metadata, insert. Persist the largest historyId seen.
//  - Incremental sync (history_id present): users.history.list?startHistoryId=…
//    walks messagesAdded / labelsAdded / labelsRemoved → upsert affected
//    messages. Updates history_id at the end.
//
// Can be invoked by:
//  - Frontend (with user JWT) on tab open / refresh.
//  - pbx-email-pubsub (service role, with body { user_id }) on push notification.

import { corsHeaders } from "../_shared/cors.ts";
import {
  adminClient,
  userFromAuthHeader,
  loadAccount,
  gmailFetch,
  buildMetadataRow,
  type EmailAccount,
} from "../_shared/gmail.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const INITIAL_BACKFILL_DAYS = 30;

async function fetchMessageMetadata(admin: any, account: EmailAccount, id: string) {
  const params = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "To", "Cc", "Subject", "Date", "Message-ID", "In-Reply-To", "References"]) {
    params.append("metadataHeaders", h);
  }
  const res = await gmailFetch(admin, account, `/users/me/messages/${id}?${params.toString()}`);
  if (!res.ok) return null;
  return await res.json();
}

async function upsertMessages(admin: any, account: EmailAccount, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const rows: any[] = [];
  // Sequential to keep quota predictable; small concurrency batches if needed.
  for (const id of ids) {
    const msg = await fetchMessageMetadata(admin, account, id);
    if (msg) rows.push(buildMetadataRow(account, msg));
  }
  if (!rows.length) return 0;
  const { error } = await admin
    .from("pbx_email_messages")
    .upsert(rows, { onConflict: "account_id,gmail_message_id" });
  if (error) console.warn("[pbx-email-sync] upsert error", error.message);
  return rows.length;
}

async function deleteMessages(admin: any, account: EmailAccount, ids: string[]) {
  if (!ids.length) return;
  await admin
    .from("pbx_email_messages")
    .delete()
    .eq("account_id", account.id)
    .in("gmail_message_id", ids);
}

async function initialSync(admin: any, account: EmailAccount) {
  const since = Math.floor((Date.now() - INITIAL_BACKFILL_DAYS * 86400 * 1000) / 1000);
  const ids: string[] = [];
  let pageToken: string | undefined;
  let largestHistory = 0;
  do {
    const qs = new URLSearchParams({
      q: `after:${since}`,
      maxResults: "100",
    });
    if (pageToken) qs.set("pageToken", pageToken);
    const res = await gmailFetch(admin, account, `/users/me/messages?${qs.toString()}`);
    if (!res.ok) break;
    const j = await res.json();
    for (const m of j.messages || []) ids.push(m.id);
    pageToken = j.nextPageToken;
    if (ids.length >= 500) break; // safety cap on first connect
  } while (pageToken);

  await upsertMessages(admin, account, ids);

  // Find a starting historyId from a recent message
  if (ids.length > 0) {
    const res = await gmailFetch(admin, account, `/users/me/messages/${ids[0]}?format=minimal`);
    if (res.ok) {
      const m = await res.json();
      largestHistory = Number(m.historyId || 0);
    }
  }
  if (!largestHistory) {
    const pr = await gmailFetch(admin, account, `/users/me/profile`);
    if (pr.ok) {
      const j = await pr.json();
      largestHistory = Number(j.historyId || 0);
    }
  }
  if (largestHistory) {
    await admin.from("pbx_email_accounts").update({ history_id: largestHistory }).eq("id", account.id);
  }
  return { inserted: ids.length, historyId: largestHistory };
}

async function incrementalSync(admin: any, account: EmailAccount) {
  const start = account.history_id!;
  let pageToken: string | undefined;
  const upsertIds = new Set<string>();
  const deleteIds = new Set<string>();
  let latestHistory = start;
  let needsFullResync = false;

  do {
    const qs = new URLSearchParams({
      startHistoryId: String(start),
      historyTypes: "messageAdded",
      maxResults: "500",
    });
    // historyTypes can be repeated; add the rest
    qs.append("historyTypes", "messageDeleted");
    qs.append("historyTypes", "labelAdded");
    qs.append("historyTypes", "labelRemoved");
    if (pageToken) qs.set("pageToken", pageToken);

    const res = await gmailFetch(admin, account, `/users/me/history?${qs.toString()}`);
    if (res.status === 404 || res.status === 410) {
      needsFullResync = true;
      break;
    }
    if (!res.ok) break;
    const j = await res.json();
    for (const h of j.history || []) {
      if (h.id) latestHistory = Math.max(latestHistory, Number(h.id));
      for (const ma of h.messagesAdded || []) upsertIds.add(ma.message.id);
      for (const md of h.messagesDeleted || []) deleteIds.add(md.message.id);
      for (const la of h.labelsAdded || []) upsertIds.add(la.message.id);
      for (const lr of h.labelsRemoved || []) upsertIds.add(lr.message.id);
    }
    if (j.historyId) latestHistory = Math.max(latestHistory, Number(j.historyId));
    pageToken = j.nextPageToken;
  } while (pageToken);

  if (needsFullResync) {
    await admin.from("pbx_email_accounts").update({ history_id: null }).eq("id", account.id);
    return initialSync(admin, { ...account, history_id: null });
  }

  // Don't try to re-fetch deleted ones
  for (const id of deleteIds) upsertIds.delete(id);

  const inserted = await upsertMessages(admin, account, Array.from(upsertIds));
  await deleteMessages(admin, account, Array.from(deleteIds));

  if (latestHistory > start) {
    await admin.from("pbx_email_accounts").update({ history_id: latestHistory }).eq("id", account.id);
  }
  return { inserted, deleted: deleteIds.size, historyId: latestHistory };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = adminClient();

  // Two callers: end-user (JWT) → use their user_id, or service role from
  // pbx-email-pubsub passing { user_id } in body with service role auth.
  let userId: string | null = null;
  const body = await req.json().catch(() => ({} as any));
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceCall = serviceKey && authHeader === `Bearer ${serviceKey}`;
  if (isServiceCall) {
    userId = body.user_id || null;
  } else {
    const user = await userFromAuthHeader(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    userId = user.id;
  }
  if (!userId) return json({ error: "user_id required" }, 400);

  const account = await loadAccount(admin, userId);
  if (!account) return json({ error: "no gmail account connected" }, 404);

  try {
    const result = account.history_id
      ? await incrementalSync(admin, account)
      : await initialSync(admin, account);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[pbx-email-sync] failed", e);
    return json({ error: (e as Error).message || "sync failed" }, 500);
  }
});
