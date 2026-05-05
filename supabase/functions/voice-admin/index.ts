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
  | "list_user_phone_numbers"
  | "unassign_phone_number"
  | "save_user_ivr_flow"
  | "publish_user_ivr_flow"
  | "list_user_profiles"
  | "approve_user"
  | "reject_user"
  | "add_user_manually"
  | "set_user_disabled"
  | "delete_user";

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
    label?: string;
    channelId?: string;
    flow?: Record<string, unknown>;
    statusFilter?: "pending" | "approved" | "rejected" | "disabled" | "no_profile" | "all";
    rejectionReason?: string;
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    storeName?: string;
    businessType?: string;
    disabled?: boolean;
  } | null;

  if (!body?.action) {
    return badRequest("Missing action");
  }

  const action = body.action;
  const targetUserId = body.targetUserId;

  if (action === "list_user_profiles") {
    const filter = body.statusFilter ?? "all";
    const { data: profiles, error: profErr } = await adminClient
      .from("user_profiles")
      .select("id, user_id, full_name, phone, store_name, business_type, approval_status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const profileByUser: Record<string, typeof profiles[number]> = {};
    for (const p of profiles ?? []) profileByUser[p.user_id] = p;
    const now = Date.now();
    const merged = (usersPage?.users ?? []).map((u: { id: string; email?: string; created_at?: string; banned_until?: string | null }) => {
      const p = profileByUser[u.id];
      const banUntil = u.banned_until ? Date.parse(u.banned_until) : 0;
      const isDisabled = banUntil && banUntil > now ? true : false;
      return {
        id: p?.id ?? null,
        user_id: u.id,
        email: u.email ?? null,
        auth_created_at: u.created_at ?? null,
        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
        store_name: p?.store_name ?? null,
        business_type: p?.business_type ?? null,
        approval_status: p?.approval_status ?? "no_profile",
        rejection_reason: p?.rejection_reason ?? null,
        reviewed_by: p?.reviewed_by ?? null,
        reviewed_at: p?.reviewed_at ?? null,
        created_at: p?.created_at ?? u.created_at ?? null,
        is_disabled: isDisabled,
        banned_until: u.banned_until ?? null,
      };
    }).sort((a: { created_at: string | null }, b: { created_at: string | null }) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );

    const filtered = merged.filter((u: { is_disabled: boolean; approval_status: string }) => {
      if (filter === "all") return true;
      if (filter === "disabled") return u.is_disabled;
      if (filter === "no_profile") return u.approval_status === "no_profile";
      return u.approval_status === filter;
    });

    return new Response(JSON.stringify({ ok: true, profiles: filtered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "set_user_disabled") {
    if (!targetUserId) return badRequest("targetUserId is required");
    const disabled = !!body.disabled;
    const banDuration = disabled ? "876000h" : "none"; // ~100 years vs unban
    // @ts-ignore - ban_duration is a runtime-supported option on updateUserById
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { ban_duration: banDuration });
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
      new_value: { disabled },
    });
    return new Response(JSON.stringify({ ok: true, action, disabled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "approve_user") {
    if (!targetUserId) return badRequest("targetUserId is required");
    const { data: existing } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    let error;
    if (existing) {
      ({ error } = await adminClient
        .from("user_profiles")
        .update({
          approval_status: "approved",
          rejection_reason: null,
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId));
    } else {
      const { data: targetAuth } = await adminClient.auth.admin.getUserById(targetUserId);
      const md = (targetAuth?.user?.user_metadata ?? {}) as Record<string, unknown>;
      ({ error } = await adminClient
        .from("user_profiles")
        .insert({
          id: crypto.randomUUID(),
          user_id: targetUserId,
          email: targetAuth?.user?.email ?? null,
          full_name: (md.full_name as string) ?? null,
          phone: (md.phone as string) ?? null,
          store_name: (md.store_name as string) ?? null,
          business_type: (md.business_type as string) ?? "retail",
          approval_status: "approved",
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        }));
    }
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
      new_value: { approval_status: "approved" },
    });
    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "reject_user") {
    if (!targetUserId) return badRequest("targetUserId is required");
    const reason = String(body.rejectionReason ?? "").trim() || null;
    const { data: existing } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    let error;
    if (existing) {
      ({ error } = await adminClient
        .from("user_profiles")
        .update({
          approval_status: "rejected",
          rejection_reason: reason,
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("user_id", targetUserId));
    } else {
      const { data: targetAuth } = await adminClient.auth.admin.getUserById(targetUserId);
      const md = (targetAuth?.user?.user_metadata ?? {}) as Record<string, unknown>;
      ({ error } = await adminClient
        .from("user_profiles")
        .insert({
          id: crypto.randomUUID(),
          user_id: targetUserId,
          email: targetAuth?.user?.email ?? null,
          full_name: (md.full_name as string) ?? null,
          phone: (md.phone as string) ?? null,
          store_name: (md.store_name as string) ?? null,
          business_type: (md.business_type as string) ?? "retail",
          approval_status: "rejected",
          rejection_reason: reason,
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        }));
    }
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
      new_value: { approval_status: "rejected", rejection_reason: reason },
    });
    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "add_user_manually") {
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!email || !password) return badRequest("email and password are required");
    if (password.length < 8) return badRequest("password must be at least 8 characters");

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user?.id) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const newUserId = created.user.id;
    const { error: profErr } = await adminClient.from("user_profiles").insert({
      user_id: newUserId,
      full_name: body.fullName ?? null,
      phone: body.phone ?? null,
      store_name: body.storeName ?? null,
      business_type: body.businessType ?? null,
      approval_status: "approved",
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    });
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await adminClient.from("voice_admin_audit_logs").insert({
      admin_user_id: userData.user.id,
      target_user_id: newUserId,
      action,
      new_value: { email, store_name: body.storeName ?? null },
    });
    return new Response(JSON.stringify({ ok: true, action, userId: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "delete_user") {
    if (!targetUserId) return badRequest("targetUserId is required");
    if (targetUserId === userData.user.id) return badRequest("You cannot delete your own admin account.");

    // Capture profile snapshot for audit before deletion.
    const { data: profileSnap } = await adminClient
      .from("user_profiles")
      .select("user_id, full_name, store_name, approval_status")
      .eq("user_id", targetUserId)
      .maybeSingle();

    // Remove profile row first (FK to auth.users typically has ON DELETE CASCADE,
    // but we delete explicitly to keep audit clean even when the constraint is missing).
    await adminClient.from("user_profiles").delete().eq("user_id", targetUserId);

    const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
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
      new_value: { deleted: true, profile: profileSnap ?? null },
    });
    return new Response(JSON.stringify({ ok: true, action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

    const [{ data: channels, error: channelError }, { data: flow, error: flowError }] = await Promise.all([
      adminClient
        .from("store_channels")
        .select("user_id, provider, provider_account_id, inbound_phone_e164, voice_ordering_enabled, is_active")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: true })
        .limit(1),
      adminClient
        .from("ivr_flow_configs")
        .select("flow, version, published, updated_at")
        .eq("user_id", targetUserId)
        .order("is_primary", { ascending: false })
        .limit(1),
    ]);
    const channel = (channels && channels.length) ? channels[0] : null;
    const flowRow = (Array.isArray(flow) && flow.length) ? flow[0] : flow;

    if (channelError || flowError) {
      return new Response(JSON.stringify({ error: channelError?.message ?? flowError?.message ?? "Failed to fetch user channel" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, channel, flow: flowRow }), {
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

    // Resolve target channel: explicit channelId, else the user's first channel.
    let channelRow: { id: string; voice_ordering_enabled: boolean } | null = null;
    if (body.channelId) {
      const { data } = await adminClient
        .from("store_channels")
        .select("id, voice_ordering_enabled")
        .eq("id", body.channelId)
        .eq("user_id", targetUserId)
        .maybeSingle();
      channelRow = data ?? null;
    } else {
      const { data } = await adminClient
        .from("store_channels")
        .select("id, voice_ordering_enabled")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: true })
        .limit(1);
      channelRow = (data && data.length) ? data[0] : null;
    }

    if (!channelRow) {
      return badRequest("No phone channel found for user. Assign a phone number first.");
    }

    const { error } = await adminClient
      .from("store_channels")
      .update({ voice_ordering_enabled: body.enabled, updated_at: new Date().toISOString() })
      .eq("id", channelRow.id);

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
      old_value: { voice_ordering_enabled: channelRow.voice_ordering_enabled },
      new_value: { voice_ordering_enabled: body.enabled, channel_id: channelRow.id },
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

    // If this exact number is already assigned to anyone, reject (number is globally unique).
    const { data: existing } = await adminClient
      .from("store_channels")
      .select("id, user_id")
      .eq("inbound_phone_e164", storedPhone)
      .maybeSingle();
    if (existing) {
      if (existing.user_id === targetUserId) {
        return badRequest("This number is already assigned to this user.");
      }
      return badRequest("This number is already assigned to another user.");
    }

    const label = String(body.label ?? "").trim() || "New line";

    const { data: inserted, error } = await adminClient
      .from("store_channels")
      .insert({
        user_id: targetUserId,
        inbound_phone_e164: storedPhone,
        provider_account_id: body.providerAccountId ?? null,
        webhook_secret: body.webhookSecret ?? null,
        label,
        is_active: true,
        configured: false,
      })
      .select("id, inbound_phone_e164, label, configured, is_active")
      .single();

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
      new_value: {
        channel_id: inserted.id,
        inbound_phone_e164: storedPhone,
        provider_account_id: body.providerAccountId ?? null,
        label,
      },
    });

    return new Response(JSON.stringify({ ok: true, action, channel: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "list_user_phone_numbers") {
    const { data, error } = await adminClient
      .from("store_channels")
      .select("id, inbound_phone_e164, label, voice_ordering_enabled, is_active, configured, routing, provider_account_id, created_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: true });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, channels: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "unassign_phone_number") {
    if (!body.channelId) {
      return badRequest("channelId is required");
    }
    const { data: oldRow } = await adminClient
      .from("store_channels")
      .select("id, inbound_phone_e164, label")
      .eq("id", body.channelId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!oldRow) return badRequest("Phone number not found for this user.");

    const { error } = await adminClient
      .from("store_channels")
      .delete()
      .eq("id", body.channelId)
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
      old_value: oldRow,
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
