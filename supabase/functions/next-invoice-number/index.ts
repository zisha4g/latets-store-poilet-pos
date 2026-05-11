// next-invoice-number — atomic per-tenant invoice number allocator
//
// Returns:
//   { number: "INV-2026-0042", seq: 42 }
//
// Format: pulled from settings row { key: "invoice_number_format", value: { value: "INV-{YYYY}-{0000}" } }
// Tokens supported: {YYYY}, {YY}, {MM}, {DD}, {seq} (no padding), {0000}/{000}/{00}/{0} (zero-padded sequence).

import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

const DEFAULT_FORMAT = "INV-{YYYY}-{0000}";

const pad = (n: number, width: number) => n.toString().padStart(width, "0");

const formatNumber = (template: string, seq: number, now: Date): string => {
  const yyyy = now.getFullYear().toString();
  const yy = yyyy.slice(-2);
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);

  return template
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{seq\}/g, seq.toString())
    .replace(/\{(0+)\}/g, (_, zeros: string) => pad(seq, zeros.length));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, authHeader);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = userData.user.id;

  // Atomic increment via RPC
  const { data: seqData, error: seqError } = await userClient.rpc("allocate_invoice_number", {
    p_user_id: userId,
  });

  if (seqError || seqData == null) {
    return new Response(
      JSON.stringify({ error: seqError?.message ?? "Failed to allocate sequence" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const seq = Number(seqData);

  // Look up format from the user's settings table
  const { data: settingRow } = await userClient
    .from("settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "invoice_number_format")
    .maybeSingle();

  let template = DEFAULT_FORMAT;
  const raw = settingRow?.value;
  if (typeof raw === "string" && raw.trim().length > 0) {
    template = raw.trim();
  } else if (raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).value === "string") {
    const inner = (raw as Record<string, string>).value.trim();
    if (inner.length > 0) template = inner;
  }

  const number = formatNumber(template, seq, new Date());

  return new Response(JSON.stringify({ number, seq }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
