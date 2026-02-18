import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey);
  const { data: account, error } = await adminClient
    .from("sola_accounts")
    .select("ifields_key, env")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!account?.ifields_key) {
    return new Response(JSON.stringify({ error: "Sola account not configured" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ifieldsVersion = Deno.env.get("SOLA_IFIELDS_VERSION") ?? "2.14";

  return new Response(
    JSON.stringify({
      ifieldsKey: account.ifields_key,
      env: account.env ?? "x1",
      ifieldsVersion,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
