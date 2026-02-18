import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

const getGatewayUrl = (env: string) => {
  switch ((env || "x1").toLowerCase()) {
    case "x2":
      return "https://x2.cardknox.com/gatewayjson";
    case "b1":
      return "https://b1.cardknox.com/gatewayjson";
    default:
      return "https://x1.cardknox.com/gatewayjson";
  }
};

Deno.serve(async (req) => {
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

  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { amount, exp, cardSut, cvvSut, invoice, customer, customerId } = payload as {
    amount?: number | string;
    exp?: string;
    cardSut?: string;
    cvvSut?: string;
    invoice?: string;
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
      zip?: string;
    };
    customerId?: string;
  };

  if (!amount || !exp || !cardSut || !cvvSut) {
    return new Response(JSON.stringify({ error: "Missing required payment fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey);
  const { data: account, error: accountError } = await adminClient
    .from("sola_accounts")
    .select("sola_xkey, env")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (accountError) {
    return new Response(JSON.stringify({ error: accountError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!account?.sola_xkey) {
    return new Response(JSON.stringify({ error: "Sola account not configured" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const amountValue = typeof amount === "string" ? amount : Number(amount).toFixed(2);
  const gatewayUrl = getGatewayUrl(account.env || "x1");

  const transactionPayload: Record<string, string> = {
    xKey: account.sola_xkey,
    xVersion: "4.5.9",
    xSoftwareName: "StorePilot POS",
    xSoftwareVersion: "1.0.0",
    xCommand: "cc:sale",
    xAmount: amountValue,
    xCardNum: cardSut,
    xCVV: cvvSut,
    xExp: exp,
  };

  if (invoice) transactionPayload.xInvoice = invoice;
  if (customer?.name) transactionPayload.xName = customer.name;
  if (customer?.email) transactionPayload.xEmail = customer.email;
  if (customer?.phone) transactionPayload.xPhone = customer.phone;
  if (customer?.zip) transactionPayload.xZip = customer.zip;

  const solaResponse = await fetch(gatewayUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transactionPayload),
  });

  const result = await solaResponse.json().catch(() => ({}));

  if (result?.xToken) {
    await adminClient.from("sola_tokens").insert({
      user_id: userData.user.id,
      customer_id: customerId ?? null,
      x_token: result.xToken,
      card_type: result.xCardType ?? null,
      masked_card: result.xMaskedCardNumber ?? null,
      exp: result.xExp ?? null,
    });
  }

  return new Response(
    JSON.stringify({
      ok: result?.xResult === "A" || result?.xResult === "V",
      result: {
        xResult: result?.xResult,
        xStatus: result?.xStatus,
        xError: result?.xError,
        xErrorCode: result?.xErrorCode,
        xRefNum: result?.xRefNum,
        xAuthAmount: result?.xAuthAmount,
        xToken: result?.xToken,
        xMaskedCardNumber: result?.xMaskedCardNumber,
        xCardType: result?.xCardType,
        xExp: result?.xExp,
      },
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: solaResponse.ok ? 200 : 502,
    }
  );
});
