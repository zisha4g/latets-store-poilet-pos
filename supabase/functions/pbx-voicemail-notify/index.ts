// pbx-voicemail-notify — sends an email to the extension owner whenever a
// new voicemail is recorded.
//
// Triggered by a Postgres webhook (Database → Webhooks) configured to fire
// on INSERT into public.pbx_voicemails. The webhook sends a JSON body shaped
// like { type: "INSERT", record: { ... }, ... }.
//
// Required secrets:
//   RESEND_API_KEY       — from https://resend.com (free tier: 100/day)
//   VOICEMAIL_FROM_EMAIL — verified sender address (e.g. "noreply@yourdomain.com")
//   APP_URL              — public URL of your app (for the dashboard link)
//
// If RESEND_API_KEY is missing the function is a no-op (doesn't fail the
// webhook), so you can deploy first and configure email later.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const formatPhone = (raw: string | null | undefined): string => {
  if (!raw) return "Unknown";
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

const formatDuration = (secs: number | null | undefined): string => {
  if (!secs || secs <= 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("VOICEMAIL_FROM_EMAIL") || "noreply@storepilot.app";
  const appUrl = Deno.env.get("APP_URL") || "https://app.storepilot.com";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "server misconfigured" }, 500);
  }

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const record = payload?.record;
  if (!record || !record.user_id) {
    console.warn("[voicemail-notify] no record in payload");
    return json({ ok: true, skipped: "no record" });
  }

  // No API key configured — accept the webhook but skip sending.
  if (!resendKey) {
    console.warn("[voicemail-notify] RESEND_API_KEY not set; skipping send");
    return json({ ok: true, skipped: "no resend key" });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Look up the recipient email. Use the assigned extension owner if
  // available, otherwise the channel owner (record.user_id).
  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  let extensionLabel: string | null = null;

  if (record.extension_id) {
    const { data: ext } = await admin
      .from("pbx_extensions")
      .select("extension_number, label, assigned_user_id")
      .eq("id", record.extension_id)
      .maybeSingle();
    if (ext) {
      extensionLabel = ext.label || `Ext ${ext.extension_number}`;
      const targetUserId = ext.assigned_user_id || record.user_id;
      const { data: userRes } = await admin.auth.admin.getUserById(targetUserId);
      recipientEmail = userRes?.user?.email ?? null;
      recipientName = (userRes?.user?.user_metadata?.full_name as string) || null;
    }
  }
  if (!recipientEmail) {
    const { data: userRes } = await admin.auth.admin.getUserById(record.user_id);
    recipientEmail = userRes?.user?.email ?? null;
    recipientName = (userRes?.user?.user_metadata?.full_name as string) || null;
  }

  if (!recipientEmail) {
    console.warn("[voicemail-notify] no recipient email found");
    return json({ ok: true, skipped: "no recipient" });
  }

  const fromLabel = formatPhone(record.from_number);
  const dur = formatDuration(record.duration_seconds);
  const recordingUrl = record.recording_url || "";
  const dashboardUrl = `${appUrl.replace(/\/$/, "")}/app/pbx/voicemails`;

  const subject = `New voicemail from ${fromLabel}${extensionLabel ? ` (${extensionLabel})` : ""}`;
  const html = `
<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fb;margin:0;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <tr><td style="padding:24px 28px 16px;">
      <h2 style="margin:0 0 4px;font-size:18px;color:#111;">📞 New voicemail</h2>
      <p style="margin:0;color:#555;font-size:14px;">${extensionLabel ? `Received on ${extensionLabel}` : "Received on your line"}</p>
    </td></tr>
    <tr><td style="padding:8px 28px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#666;font-size:13px;width:120px;">From</td><td style="padding:6px 0;font-size:14px;color:#111;font-weight:600;">${fromLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px;">Length</td><td style="padding:6px 0;font-size:14px;color:#111;">${dur}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px;">Received</td><td style="padding:6px 0;font-size:14px;color:#111;">${new Date(record.created_at || Date.now()).toLocaleString()}</td></tr>
      </table>
    </td></tr>
    ${recordingUrl ? `
    <tr><td style="padding:20px 28px 8px;">
      <a href="${recordingUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;">▶ Listen to recording</a>
    </td></tr>` : ""}
    <tr><td style="padding:8px 28px 24px;">
      <a href="${dashboardUrl}" style="color:#2563eb;text-decoration:none;font-size:13px;">Open voicemail inbox →</a>
    </td></tr>
  </table>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin:16px 0 0;">StorePilot PBX</p>
</body></html>`;

  const text = `New voicemail
From: ${fromLabel}
${extensionLabel ? `Extension: ${extensionLabel}\n` : ""}Length: ${dur}
Received: ${new Date(record.created_at || Date.now()).toLocaleString()}
${recordingUrl ? `\nRecording: ${recordingUrl}\n` : ""}
Inbox: ${dashboardUrl}`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: recipientName ? `${recipientName} <${fromEmail}>` : fromEmail,
        to: [recipientEmail],
        subject,
        html,
        text,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error("[voicemail-notify] resend error", resp.status, body);
      return json({ ok: false, error: "send failed", status: resp.status }, 502);
    }
  } catch (e) {
    console.error("[voicemail-notify] send exception", e);
    return json({ ok: false, error: String(e) }, 502);
  }

  return json({ ok: true, recipient: recipientEmail });
});
