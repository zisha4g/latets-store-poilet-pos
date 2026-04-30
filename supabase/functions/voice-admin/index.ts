import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import { canonicalStorePhone } from "../_shared/voice.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

type AdminAction =
  | "get_admin_context"
  | "get_user_channel"
  | "set_voice_enabled"
  | "assign_phone_number"
  | "save_user_ivr_flow"
  | "publish_user_ivr_flow";

const badRequest = (message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey);

  const { data: adminRow } = await adminClient
    .from("platform_admins")
    .select("id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!adminRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => null) as {
    action?: AdminAction;
    targetUserId?: string;
    enabled?: boolean;
    phoneNumberE164?: string;
    providerAccountId?: string;
    webhookSecret?: string;
    flow?: Record<string, unknown>;
  } | null;

  if (!body?.action) {
    return badRequest("Missing action");
  }

  const action = body.action;
  const targetUserId = body.targetUserId;

  if (action === "get_admin_context") {
    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });

    if (usersError) {
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const users = (usersPage?.users ?? []).map((u: { id: string; email?: string; created_at?: string }) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
    }));

    return new Response(JSON.stringify({ ok: true, isAdmin: true, users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "get_user_channel") {
    if (!targetUserId) {
      return badRequest("targetUserId is required");
    }

    const [{ data: channel, error: channelError }, { data: flow, error: flowError }] = await Promise.all([
      adminClient
        .from("store_channels")
        .select("user_id, provider, provider_account_id, inbound_phone_e164, voice_ordering_enabled, is_active")
        .eq("user_id", targetUserId)
        .maybeSingle(),
      adminClient
        .from("ivr_flow_configs")
        .select("flow, version, published, updated_at")
        .eq("user_id", targetUserId)
        .maybeSingle(),
    ]);

    if (channelError || flowError) {
      return new Response(JSON.stringify({ error: channelError?.message ?? flowError?.message ?? "Failed to fetch user channel" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, channel, flow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!targetUserId) {
    return badRequest("Missing targetUserId");
  }

  if (action === "set_voice_enabled") {
    if (typeof body.enabled !== "boolean") {
      return badRequest("enabled must be boolean");
    }

    const { data: oldRow } = await adminClient
      .from("store_channels")
      .select("voice_ordering_enabled")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const { error } = await adminClient
      .from("store_channels")
      .upsert({
        user_id: targetUserId,
        voice_ordering_enabled: body.enabled,
      }, { onConflict: "user_id" });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("voice_admin_audit_logs").insert({
      admin_user_id: userData.user.id,
      target_user_id: targetUserId,
      action,
      old_value: oldRow ?? null,
      new_value: { voice_ordering_enabled: body.enabled },
    });

    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "assign_phone_number") {
    if (!body.phoneNumberE164) {
      return badRequest("phoneNumberE164 is required");
    }

    const storedPhone = canonicalStorePhone(body.phoneNumberE164);
    if (!storedPhone) {
      return badRequest("phoneNumberE164 is invalid");
    }

    const { data: oldRow } = await adminClient
      .from("store_channels")
      .select("inbound_phone_e164, provider_account_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const { error } = await adminClient
      .from("store_channels")
      .upsert({
        user_id: targetUserId,
        inbound_phone_e164: storedPhone,
        provider_account_id: body.providerAccountId ?? null,
        webhook_secret: body.webhookSecret ?? null,
        is_active: true,
      }, { onConflict: "user_id" });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("voice_admin_audit_logs").insert({
      admin_user_id: userData.user.id,
      target_user_id: targetUserId,
      action,
      old_value: oldRow ?? null,
      new_value: {
        inbound_phone_e164: storedPhone,
        provider_account_id: body.providerAccountId ?? null,
      },
    });

    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "save_user_ivr_flow") {
    if (!body.flow || typeof body.flow !== "object") {
      return badRequest("flow object is required");
    }

    const { data: current } = await adminClient
      .from("ivr_flow_configs")
      .select("version")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const nextVersion = (current?.version ?? 0) + 1;

    const { error } = await adminClient
      .from("ivr_flow_configs")
      .upsert({
        user_id: targetUserId,
        flow: body.flow,
        version: nextVersion,
        published: false,
      }, { onConflict: "user_id" });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("voice_admin_audit_logs").insert({
      admin_user_id: userData.user.id,
      target_user_id: targetUserId,
      action,
      new_value: { version: nextVersion, published: false },
    });

    return new Response(JSON.stringify({ ok: true, action, version: nextVersion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "publish_user_ivr_flow") {
    const { error } = await adminClient
      .from("ivr_flow_configs")
      .update({ published: true })
      .eq("user_id", targetUserId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("voice_admin_audit_logs").insert({
      admin_user_id: userData.user.id,
      target_user_id: targetUserId,
      action,
      new_value: { published: true },
    });

    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return badRequest("Unsupported action");
});
