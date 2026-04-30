import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

type ConfigAction =
  | "get"
  | "save_draft"
  | "publish"
  | "reset_to_default"
  | "save_voice_settings"
  | "list_flows"
  | "create_flow"
  | "rename_flow"
  | "delete_flow"
  | "set_primary"
  | "set_active";

const validateGraphFlow = (flow: Record<string, unknown>) => {
  const errors: string[] = [];
  if (flow.mode !== "graph") return errors;

  const nodes = Array.isArray(flow.nodes) ? flow.nodes as Array<Record<string, unknown>> : [];
  const edges = Array.isArray(flow.edges) ? flow.edges as Array<Record<string, unknown>> : [];
  const startNodeId = typeof flow.startNodeId === "string" ? flow.startNodeId : "";

  if (!nodes.length) errors.push("Flow must include at least one node.");
  if (!startNodeId) errors.push("Flow must define startNodeId.");

  const nodeIds = new Set(nodes.map((n) => String(n.id ?? "")).filter(Boolean));
  if (startNodeId && !nodeIds.has(startNodeId)) {
    errors.push("startNodeId does not exist in nodes.");
  }

  edges.forEach((edge) => {
    const from = String(edge.from ?? "");
    const to = String(edge.to ?? "");
    const conditionType = String(edge.conditionType ?? "");
    const conditionValue = String(edge.conditionValue ?? "");
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      errors.push(`Edge ${String(edge.id ?? "") || "(no id)"} references missing nodes.`);
    }
    if (conditionType === "digit" && !conditionValue.trim()) {
      errors.push(`Edge ${String(edge.id ?? "") || "(no id)"} has digit condition with empty value.`);
    }
  });

  nodes.forEach((node) => {
    const id = String(node.id ?? "");
    const type = String(node.type ?? "");
    const prompt = String(node.prompt ?? "");
    if (!id) errors.push("One node has no id.");
    if (!type) errors.push(`Node ${id || "(unknown)"} has no type.`);
    if (["gather", "branch", "record", "message", "payment", "end"].includes(type) && !prompt.trim()) {
      errors.push(`Node ${id || "(unknown)"} requires a prompt.`);
    }
    if (type !== "end") {
      const hasOutgoing = edges.some((edge) => String(edge.from ?? "") === id);
      if (!hasOutgoing) errors.push(`Node ${id || "(unknown)"} has no outgoing transition.`);
    }
  });

  return Array.from(new Set(errors));
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Resolve which flow row a given action should operate on.
// If flowId is provided, use that one (must belong to user).
// Else fall back to the user's primary flow, or the most recent flow they have.
// deno-lint-ignore no-explicit-any
const resolveFlowForUser = async (adminClient: any, userId: string, flowId?: string) => {
  if (flowId) {
    const { data } = await adminClient
      .from("ivr_flow_configs")
      .select("id, user_id, flow, version, published, name, is_active, is_primary, updated_at")
      .eq("id", flowId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  }
  const { data: primary } = await adminClient
    .from("ivr_flow_configs")
    .select("id, user_id, flow, version, published, name, is_active, is_primary, updated_at")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();
  if (primary) return primary;
  const { data: anyRow } = await adminClient
    .from("ivr_flow_configs")
    .select("id, user_id, flow, version, published, name, is_active, is_primary, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return anyRow ?? null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "Missing Supabase env vars" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, authHeader);
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError || !userData?.user?.id) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey);
  const userId = userData.user.id;
  const body = await req.json().catch(() => null) as {
    action?: ConfigAction;
    flow?: Record<string, unknown>;
    voiceSettings?: Record<string, unknown>;
    flowId?: string;
    name?: string;
    isActive?: boolean;
  } | null;

  const action = body?.action;
  if (!action) {
    return jsonResponse({ error: "Missing action" }, 400);
  }

  // ─────────── List all flows for the user ───────────
  if (action === "list_flows") {
    const { data: flows, error } = await adminClient
      .from("ivr_flow_configs")
      .select("id, name, version, published, is_active, is_primary, updated_at")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, flows: flows ?? [] });
  }

  // ─────────── Create a new flow (named, copied from default template) ───────────
  if (action === "create_flow") {
    const name = String(body?.name ?? "").trim() || "New flow";

    const { data: template, error: templateError } = await adminClient
      .from("ivr_flow_templates")
      .select("flow")
      .eq("name", "default-voice-v1")
      .maybeSingle();
    if (templateError || !template?.flow) {
      return jsonResponse({ error: templateError?.message ?? "Default template missing" }, 500);
    }

    // First flow becomes primary by default.
    const { count } = await adminClient
      .from("ivr_flow_configs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const isPrimary = (count ?? 0) === 0;

    const { data: created, error } = await adminClient
      .from("ivr_flow_configs")
      .insert({
        user_id: userId,
        name,
        flow: template.flow,
        version: 1,
        published: false,
        is_active: true,
        is_primary: isPrimary,
      })
      .select("id, name, version, published, is_active, is_primary, updated_at")
      .single();
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, flow: created });
  }

  // ─────────── Rename a flow ───────────
  if (action === "rename_flow") {
    const flowId = String(body?.flowId ?? "");
    const name = String(body?.name ?? "").trim();
    if (!flowId || !name) return jsonResponse({ error: "flowId and name are required" }, 400);
    const { error } = await adminClient
      .from("ivr_flow_configs")
      .update({ name })
      .eq("id", flowId)
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  // ─────────── Delete a flow ───────────
  if (action === "delete_flow") {
    const flowId = String(body?.flowId ?? "");
    if (!flowId) return jsonResponse({ error: "flowId is required" }, 400);

    const { data: target } = await adminClient
      .from("ivr_flow_configs")
      .select("id, is_primary")
      .eq("id", flowId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!target) return jsonResponse({ error: "Flow not found" }, 404);
    if (target.is_primary) {
      return jsonResponse({ error: "Cannot delete the primary flow. Make another flow primary first." }, 400);
    }

    const { error } = await adminClient
      .from("ivr_flow_configs")
      .delete()
      .eq("id", flowId)
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  // ─────────── Set a flow as primary (the one phone calls trigger) ───────────
  if (action === "set_primary") {
    const flowId = String(body?.flowId ?? "");
    if (!flowId) return jsonResponse({ error: "flowId is required" }, 400);

    // Two-step to satisfy partial-unique-index "one primary per user".
    const { error: clearError } = await adminClient
      .from("ivr_flow_configs")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);
    if (clearError) return jsonResponse({ error: clearError.message }, 500);

    const { error: setError } = await adminClient
      .from("ivr_flow_configs")
      .update({ is_primary: true })
      .eq("id", flowId)
      .eq("user_id", userId);
    if (setError) return jsonResponse({ error: setError.message }, 500);

    return jsonResponse({ ok: true });
  }

  // ─────────── Toggle active on/off ───────────
  if (action === "set_active") {
    const flowId = String(body?.flowId ?? "");
    const isActive = Boolean(body?.isActive);
    if (!flowId) return jsonResponse({ error: "flowId is required" }, 400);
    const { error } = await adminClient
      .from("ivr_flow_configs")
      .update({ is_active: isActive })
      .eq("id", flowId)
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  // ─────────── Get current flow (optionally by flowId) ───────────
  if (action === "get") {
    const target = await resolveFlowForUser(adminClient, userId, body?.flowId);

    const { data: channel } = await adminClient
      .from("store_channels")
      .select("inbound_phone_e164, voice_ordering_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    const mergedConfig = target
      ? {
          ...target,
          voice_settings:
            target.flow && typeof target.flow === "object"
              ? ((target.flow as Record<string, unknown>).voice_settings ?? {})
              : {},
        }
      : null;

    return jsonResponse({ ok: true, config: mergedConfig, channel });
  }

  // ─────────── Save draft ───────────
  if (action === "save_draft") {
    if (!body?.flow || typeof body.flow !== "object") {
      return jsonResponse({ error: "flow object is required" }, 400);
    }
    const graphErrors = validateGraphFlow(body.flow);
    if (graphErrors.length) {
      return jsonResponse({ error: graphErrors[0], validationErrors: graphErrors }, 400);
    }

    const target = await resolveFlowForUser(adminClient, userId, body?.flowId);
    if (!target) return jsonResponse({ error: "No flow found. Create one first." }, 404);

    const nextVersion = (target.version ?? 0) + 1;
    const { error } = await adminClient
      .from("ivr_flow_configs")
      .update({ flow: body.flow, version: nextVersion, published: false })
      .eq("id", target.id)
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, version: nextVersion, published: false, flowId: target.id });
  }

  // ─────────── Publish ───────────
  if (action === "publish") {
    const target = await resolveFlowForUser(adminClient, userId, body?.flowId);
    if (!target) return jsonResponse({ error: "No flow found." }, 404);
    if (!target.flow || typeof target.flow !== "object") {
      return jsonResponse({ error: "No flow draft found to publish." }, 400);
    }
    const graphErrors = validateGraphFlow(target.flow as Record<string, unknown>);
    if (graphErrors.length) {
      return jsonResponse({ error: graphErrors[0], validationErrors: graphErrors }, 400);
    }
    const { error } = await adminClient
      .from("ivr_flow_configs")
      .update({ published: true })
      .eq("id", target.id)
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, published: true, flowId: target.id });
  }

  // ─────────── Reset to default ───────────
  if (action === "reset_to_default") {
    const { data: template, error: templateError } = await adminClient
      .from("ivr_flow_templates")
      .select("flow")
      .eq("name", "default-voice-v1")
      .maybeSingle();
    if (templateError || !template?.flow) {
      return jsonResponse({ error: templateError?.message ?? "Default template missing" }, 500);
    }

    const target = await resolveFlowForUser(adminClient, userId, body?.flowId);
    if (!target) return jsonResponse({ error: "No flow found." }, 404);

    const nextVersion = (target.version ?? 0) + 1;
    const { error } = await adminClient
      .from("ivr_flow_configs")
      .update({
        template_id: null,
        flow: template.flow,
        version: nextVersion,
        published: true,
      })
      .eq("id", target.id)
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, version: nextVersion, published: true, flowId: target.id });
  }

  // ─────────── Save voice settings (merged into flow.voice_settings) ───────────
  if (action === "save_voice_settings") {
    const vs = body?.voiceSettings;
    if (!vs || typeof vs !== "object") {
      return jsonResponse({ error: "voiceSettings object is required" }, 400);
    }

    const target = await resolveFlowForUser(adminClient, userId, body?.flowId);
    if (!target) return jsonResponse({ error: "No flow found." }, 404);

    const currentFlow = target.flow && typeof target.flow === "object"
      ? (target.flow as Record<string, unknown>)
      : { mode: "graph", version: 1, startNodeId: "", nodes: [], edges: [] };

    const nextFlow = { ...currentFlow, voice_settings: vs };

    const { error } = await adminClient
      .from("ivr_flow_configs")
      .update({ flow: nextFlow })
      .eq("id", target.id)
      .eq("user_id", userId);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, flowId: target.id });
  }

  return jsonResponse({ error: "Unsupported action" }, 400);
});
