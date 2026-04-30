// Yealink (and compatible) auto-provisioning endpoint.
//
// Public URL — no Supabase auth header. The phone is identified by a
// per-device secret (provision_token) embedded in the path. Optionally we
// also verify the MAC the phone sends in its User-Agent matches the row.
//
// URLs (any of these work; pick whichever Yealink's auto-provision URL
// pattern needs):
//   GET /provision/<token>/y000000000000.cfg     (common boot file)
//   GET /provision/<token>/<MAC>.cfg              (Yealink per-MAC file)
//   GET /provision/<token>                        (returns same .cfg)
//
// All three return the same Yealink-style .cfg body for that device.

import { createSupabaseClient } from "../_shared/supabase.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const textCfg = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const notFound = (msg = "Not found") => textCfg(`#!error: ${msg}\n`, 404);

// Yealink config files are key=value lines. Comments start with `#`.
// We only ship the keys we manage. Unset keys keep their factory/local value.
const buildYealinkCfg = (
  device: {
    label?: string | null;
    sip_username: string;
    sip_domain: string;
    sip_password: string;
    config_version: number;
    account_slot?: number | null;
  },
) => {
  // Some users paste "101@domain" into the username box — strip the @part.
  const ext = String(device.sip_username).split("@")[0].trim();
  // Domain may have been pasted with sip:// or trailing slashes — normalize.
  const domain = String(device.sip_domain).replace(/^sips?:\/\//i, "").replace(/\/+$/, "").trim();
  const pass = device.sip_password;
  const label = (device.label || `Ext ${ext}`).replace(/[\r\n]/g, " ");
  const slot = Math.min(16, Math.max(1, Number(device.account_slot ?? 1)));

  // Account <slot> fields. Yealink T4x/T5x family. Other accounts left alone
  // so an existing provider on a different slot keeps working.
  return [
    `#!version:1.0.0.1`,
    `# StorePilot auto-provision  config_version=${device.config_version} slot=${slot}`,
    ``,
    `account.${slot}.enable = 1`,
    `account.${slot}.label = ${label}`,
    `account.${slot}.display_name = ${label}`,
    `account.${slot}.auth_name = ${ext}`,
    `account.${slot}.user_name = ${ext}`,
    `account.${slot}.password = ${pass}`,
    `account.${slot}.sip_server.1.address = ${domain}`,
    `account.${slot}.sip_server.1.port = 5061`,
    `account.${slot}.sip_server.1.transport_type = 2`, // 0=UDP 1=TCP 2=TLS
    `account.${slot}.outbound_proxy_enable = 0`,
    `account.${slot}.transport = 2`,
    ``,
    `# Encryption: SRTP required (matches SignalWire endpoint policy).`,
    `account.${slot}.srtp_encryption = 1`,
    ``,
    `# NAT traversal — keep registrations alive behind home/store routers.`,
    `account.${slot}.nat.nat_traversal = 0`,
    `account.${slot}.reg_expires = 300`,
    `account.${slot}.subscribe_register = 1`,
    ``,
  ].join("\n");
};

const normalizeMac = (raw: string) => raw.toLowerCase().replace(/[^a-f0-9]/g, "");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const ua = req.headers.get("user-agent") || "";
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "?";
  console.log(`[provision] ${req.method} ${url.pathname} ip=${ip} ua="${ua}"`);

  // Path layout: /provision/<token>[/<file>]
  const parts = url.pathname.split("/").filter(Boolean);
  const provIdx = parts.indexOf("provision");
  const token = provIdx >= 0 ? parts[provIdx + 1] : undefined;
  const file = provIdx >= 0 ? parts[provIdx + 2] : undefined;
  console.log(`[provision] token=${token ? token.slice(0, 8) + "…" : "none"} file=${file || "-"}`);

  if (!token) {
    console.warn("[provision] missing token");
    return notFound("Missing token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[provision] missing env SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return textCfg("#!error: server misconfigured\n", 500);
  }

  const admin = createSupabaseClient(supabaseUrl, serviceKey);

  const { data: device, error } = await admin
    .from("pbx_devices")
    .select("id, user_id, mac, label, sip_username, sip_domain, sip_password, config_version, account_slot")
    .eq("provision_token", token)
    .maybeSingle();

  if (error) {
    console.error("[provision] db lookup error", error);
    return notFound("DB error");
  }
  if (!device) {
    console.warn("[provision] no device for token");
    return notFound("Unknown device");
  }
  console.log(`[provision] device id=${device.id} mac=${device.mac} slot=${device.account_slot} ext=${device.sip_username}`);

  // If the URL contains a MAC filename like "<MAC>.cfg" or "<MAC>.boot",
  // verify it matches. Yealink also requests global "y000000000000.cfg".
  let ext = "";
  if (file) {
    const m = file.match(/^(.+)\.(cfg|boot)$/i);
    if (m) {
      const macInFile = normalizeMac(m[1]);
      ext = m[2].toLowerCase();
      const isGlobalBoot = /^y0+$/.test(macInFile);
      if (!isGlobalBoot && macInFile && macInFile !== device.mac) {
        console.warn(`[provision] MAC mismatch file=${macInFile} device=${device.mac}`);
        return notFound("MAC mismatch");
      }
    }
  }

  if (!device.sip_username || !device.sip_domain || !device.sip_password) {
    console.warn("[provision] device not fully configured");
    return textCfg("#!error: device not fully configured\n", 409);
  }

  // Best-effort: log the heartbeat.
  try {
    await admin
      .from("pbx_devices")
      .update({
        last_seen_at: new Date().toISOString(),
        last_seen_ip: ip,
        last_user_agent: ua,
      })
      .eq("id", device.id);
  } catch (e) {
    console.warn("[provision] heartbeat update failed", e);
  }

  // Return the same SIP config for both .boot and .cfg requests. Yealink's
  // boot file format accepts plain key=value lines just like cfg, so we skip
  // the manifest indirection (absolute include URLs to a different host don't
  // work reliably).
  const cfg = buildYealinkCfg(device);
  console.log(`[provision] returning ${ext || "cfg"} ${cfg.length} bytes for device ${device.id}`);
  return textCfg(cfg);
});
