// run-recurring-invoices — scheduled (cron) edge function.
// 1. Marks overdue invoices via mark_overdue_invoices() RPC.
// 2. For every active invoice_recurring_templates whose next_run_at <= now(),
//    clones template_json into a new invoice (copying customer, items, notes,
//    terms, currency, due-date offset), allocates a fresh invoice number, and
//    advances next_run_at by the template's cadence.
//
// Auth: must be called with the service role key (Supabase scheduled triggers
// always pass it). Rejects anon/user JWTs.

import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

const advanceDate = (from: Date, cadence: Cadence): Date => {
  const d = new Date(from);
  switch (cadence) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      return d;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      return d;
  }
};

const pad = (n: number, w: number) => n.toString().padStart(w, "0");
const formatNumber = (template: string, seq: number, now: Date): string => {
  const yyyy = now.getFullYear().toString();
  return template
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(-2))
    .replace(/\{MM\}/g, pad(now.getMonth() + 1, 2))
    .replace(/\{DD\}/g, pad(now.getDate(), 2))
    .replace(/\{seq\}/g, seq.toString())
    .replace(/\{(0+)\}/g, (_, z: string) => pad(seq, z.length));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Require either service-role bearer or x-cron-secret to prevent abuse.
  const auth = req.headers.get("Authorization") ?? "";
  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const expectedCronSecret = Deno.env.get("RECURRING_CRON_SECRET") ?? "";
  const isService = auth.includes(serviceKey);
  const isCron = expectedCronSecret.length > 0 && cronSecret === expectedCronSecret;
  if (!isService && !isCron) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createSupabaseClient(supabaseUrl, serviceKey);

  // Mark overdue.
  const { data: overdueCount, error: overdueErr } = await admin.rpc("mark_overdue_invoices");
  if (overdueErr) {
    console.error("mark_overdue_invoices failed:", overdueErr);
  }

  // Pull templates that are due.
  const nowIso = new Date().toISOString();
  const { data: templates, error: tErr } = await admin
    .from("invoice_recurring_templates")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", nowIso);

  if (tErr) {
    return new Response(JSON.stringify({ error: tErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const created: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const tpl of templates ?? []) {
    try {
      // Allocate invoice number for the tenant.
      const { data: seqRaw, error: seqErr } = await admin.rpc("allocate_invoice_number", {
        p_user_id: tpl.user_id,
      });
      // RPC checks auth.uid() — bypass by inlining the same logic as service role:
      let seq = Number(seqRaw);
      if (seqErr || !Number.isFinite(seq)) {
        // Fallback: increment directly with service role.
        const { data: seqRow } = await admin
          .from("invoice_number_sequences")
          .upsert({ user_id: tpl.user_id, next_value: 1 }, { onConflict: "user_id", ignoreDuplicates: true })
          .select()
          .maybeSingle();
        const current = (seqRow?.next_value as number | undefined) ?? 1;
        const { data: bumped } = await admin
          .from("invoice_number_sequences")
          .update({ next_value: current + 1, updated_at: new Date().toISOString() })
          .eq("user_id", tpl.user_id)
          .select()
          .maybeSingle();
        seq = (bumped?.next_value as number) - 1;
      }

      // Resolve number format.
      const { data: fmtRow } = await admin
        .from("settings")
        .select("value")
        .eq("user_id", tpl.user_id)
        .eq("key", "invoice_number_format")
        .maybeSingle();
      let template = "INV-{YYYY}-{0000}";
      const fmt = fmtRow?.value;
      if (typeof fmt === "string" && fmt.trim()) template = fmt.trim();
      else if (fmt && typeof fmt === "object" && typeof (fmt as Record<string, unknown>).value === "string") {
        const inner = (fmt as Record<string, string>).value.trim();
        if (inner) template = inner;
      }

      const issuedAt = new Date();
      const invoiceNumber = formatNumber(template, seq, issuedAt);

      const tplData = (tpl.template_json ?? {}) as Record<string, unknown>;
      const dueOffsetDays = Number((tplData.due_offset_days as number | undefined) ?? 30);
      const dueDate = new Date(issuedAt);
      dueDate.setDate(dueDate.getDate() + dueOffsetDays);

      const newInvoice = {
        user_id: tpl.user_id,
        invoice_number: invoiceNumber,
        invoice_number_seq: seq,
        customer_id: tplData.customer_id ?? null,
        items: tplData.items ?? [],
        subtotal: tplData.subtotal ?? 0,
        tax_rate: tplData.tax_rate ?? 0,
        tax_amount: tplData.tax_amount ?? 0,
        total: tplData.total ?? 0,
        currency: tplData.currency ?? "USD",
        discount_type: tplData.discount_type ?? "none",
        discount_value: tplData.discount_value ?? 0,
        discount_amount: tplData.discount_amount ?? 0,
        notes: tplData.notes ?? null,
        terms: tplData.terms ?? null,
        status: "sent",
        issued_at: issuedAt.toISOString(),
        due_date: dueDate.toISOString().slice(0, 10),
        recurring_template_id: tpl.id,
      };

      const { data: inserted, error: insErr } = await admin
        .from("invoices")
        .insert(newInvoice)
        .select()
        .single();

      if (insErr) throw insErr;

      const nextRun = advanceDate(new Date(tpl.next_run_at), tpl.cadence as Cadence);
      const stop = tpl.end_date && new Date(tpl.end_date) < nextRun;

      await admin
        .from("invoice_recurring_templates")
        .update({
          last_run_at: issuedAt.toISOString(),
          last_invoice_id: inserted?.id ?? null,
          next_run_at: nextRun.toISOString(),
          active: !stop,
          updated_at: issuedAt.toISOString(),
        })
        .eq("id", tpl.id);

      if (inserted?.id) created.push(inserted.id as string);
    } catch (e) {
      console.error("recurring invoice failed", tpl.id, e);
      failed.push({ id: tpl.id, error: (e as Error).message });
    }
  }

  return new Response(
    JSON.stringify({
      overdueMarked: overdueCount ?? 0,
      createdCount: created.length,
      created,
      failed,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
