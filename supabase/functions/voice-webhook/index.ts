import { createSupabaseClient } from "../_shared/supabase.ts";
import {
  normalizePhone,
  parseWebhookBody,
  phoneLookupCandidates,
  toXmlResponse,
  verifySha256Hmac,
} from "../_shared/voice.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

type JsonMap = Record<string, unknown>;

type GraphNode = {
  id: string;
  type: string;
  title?: string;
  prompt?: string;
  captureVar?: string;
  maxDigits?: number | null;
  finishOnKey?: string | null;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  conditionType?: string;
  conditionValue?: string;
};

type GraphFlow = {
  mode: string;
  version?: number;
  startNodeId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const defaultPrompts = {
  welcome: "Welcome to StorePilot ordering. Press 1 to enter SKU.",
  sku: "Enter product SKU, then pound.",
  qty: "Enter quantity, then pound.",
  addMore: "Press 1 to add another item, or press 2 for delivery address.",
  address: "Please say your delivery address after the tone.",
  checkout: "Thank you. We received your order details. Payment will continue now.",
};

const digitsOnly = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const canonicalTenDigitPhone = (value: unknown) => {
  const digits = digitsOnly(value);
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
};

const money = (value: unknown) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
};

const moneySpeech = (value: unknown) => {
  const amount = money(value);
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  if (!cents) return `${dollars} dollars`;
  return `${dollars} dollars and ${cents} cents`;
};

const cartSubtotal = (cart: Array<Record<string, unknown>>) =>
  Math.round(
    cart.reduce((sum, item) => {
      const qty = Number(item.quantity ?? 0);
      const price = money(item.price);
      return sum + qty * price;
    }, 0) * 100,
  ) / 100;

const getCartTotalsWithDefaultTaxes = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  cart: Array<Record<string, unknown>>,
) => {
  const subtotal = cartSubtotal(cart);
  const { data: taxRows } = await adminClient
    .from("taxes")
    .select("name, rate")
    .eq("user_id", userId)
    .eq("is_default", true);

  const appliedTaxes = (taxRows ?? []).map((t: { name: string; rate: number | string }) => {
    const rate = parseFloat(String(t.rate ?? 0)) || 0;
    return { name: String(t.name ?? "Tax"), rate, amount: Math.round(subtotal * (rate / 100) * 100) / 100 };
  });

  const totalTaxAmount = Math.round(appliedTaxes.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) * 100) / 100;
  const primaryTaxRate = appliedTaxes.length > 0 ? appliedTaxes[0].rate : 0;
  const total = Math.round((subtotal + totalTaxAmount) * 100) / 100;

  return {
    subtotal,
    appliedTaxes,
    totalTaxAmount,
    primaryTaxRate,
    total,
  };
};

const cartSummarySpeech = (
  cart: Array<Record<string, unknown>>,
  totals?: { subtotal: number; totalTaxAmount: number; total: number },
) => {
  if (!cart.length) return "Your cart is empty.";
  const lines = cart.map((item) => {
    const name = String(item.name ?? item.sku ?? "item").trim() || "item";
    const qty = Number(item.quantity ?? 1) || 1;
    const lineTotal = money(item.price) * qty;
    return `${name}, quantity ${qty}, ${moneySpeech(lineTotal)}`;
  });
  const totalQty = cart.reduce((sum, item) => sum + (Number(item.quantity ?? 1) || 1), 0);
  if (!totals || totals.totalTaxAmount <= 0) {
    return `You have ${totalQty} item${totalQty === 1 ? "" : "s"} in your cart. ${lines.join(". ")}. Your total is ${moneySpeech(totals?.total ?? cartSubtotal(cart))}.`;
  }
  return `You have ${totalQty} item${totalQty === 1 ? "" : "s"} in your cart. ${lines.join(". ")}. Subtotal is ${moneySpeech(totals.subtotal)}. Tax is ${moneySpeech(totals.totalTaxAmount)}. Your total is ${moneySpeech(totals.total)}.`;
};

const buildDeliveryAddress = (vars: JsonMap, fallbackTranscript: string | null) => {
  const streetNumber = String(vars.street_number ?? "").trim();
  const streetName = String(vars.street_name_transcript ?? vars.street_name_recording_transcript ?? fallbackTranscript ?? "").trim();
  const unitNumber = String(vars.unit_number ?? "").trim();
  const zip = String(vars.delivery_zip ?? "").trim();
  const addressParts = [
    [streetNumber, streetName].filter(Boolean).join(" ").trim(),
    unitNumber ? `Unit ${unitNumber}` : "",
    zip,
  ].filter(Boolean);
  return addressParts.join(", ").trim();
};

const buildDeliveryInstructions = (vars: JsonMap) => {
  return String(vars.delivery_instructions_transcript ?? vars.delivery_instructions_recording_transcript ?? "").trim();
};

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

const lookupProductByItemNumber = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  itemNumber: string,
) => {
  const needle = String(itemNumber || "").trim();
  if (!needle) return null;

  const { data: products } = await adminClient
    .from("products")
    .select("id, name, price, cost_price, sku, barcode, stock")
    .eq("user_id", userId);

  const normalizedNeedle = digitsOnly(needle);
  return (products || []).find((product: Record<string, unknown>) => {
    const sku = String(product.sku ?? "").trim();
    const barcode = String(product.barcode ?? "").trim();
    const id = String(product.id ?? "").trim();
    return sku === needle || barcode === needle || id === needle || (normalizedNeedle && digitsOnly(barcode) === normalizedNeedle);
  }) || null;
};

const upsertVoiceCustomer = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  phone: string,
  address: string | null,
) => {
  const normalizedPhone = canonicalTenDigitPhone(phone);
  const { data: customers } = await adminClient
    .from("customers")
    .select("id, name, phone, address")
    .eq("user_id", userId);

  const existing = (customers || []).find((customer: Record<string, unknown>) => canonicalTenDigitPhone(customer.phone) === normalizedPhone);
  if (existing) {
    const nextAddress = address?.trim() ? address.trim() : existing.address;
    if (nextAddress !== existing.address) {
      const { data: updated } = await adminClient
        .from("customers")
        .update({ address: nextAddress, phone: normalizedPhone || existing.phone })
        .eq("id", existing.id)
        .select("id, name, phone, address")
        .single();
      return updated || { ...existing, address: nextAddress };
    }
    if (normalizedPhone && String(existing.phone ?? "") !== normalizedPhone) {
      const { data: updatedPhone } = await adminClient
        .from("customers")
        .update({ phone: normalizedPhone })
        .eq("id", existing.id)
        .select("id, name, phone, address")
        .single();
      return updatedPhone || existing;
    }
    return existing;
  }

  const { data: inserted } = await adminClient
    .from("customers")
    .insert({
      user_id: userId,
      name: `Phone Order ${normalizedPhone.slice(-4) || "Customer"}`,
      phone: normalizedPhone || phone,
      address: address?.trim() || "Voice order address on file",
    })
    .select("id, name, phone, address")
    .single();

  return inserted;
};

const lookupVoiceCustomerByPhone = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  phone: string,
) => {
  const normalized = canonicalTenDigitPhone(phone);
  if (!normalized) return null;

  const { data: rows } = await adminClient
    .from("customers")
    .select("id, name, phone, address")
    .eq("user_id", userId)
    .limit(2000);

  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.find((row) => canonicalTenDigitPhone(row.phone) === normalized) || null;
};

const chargeVoiceOrder = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  amount: number,
  vars: JsonMap,
  customer: { id?: string; name?: string; phone?: string } | null,
  invoice: string,
) => {
  const cardNum = digitsOnly(vars.cc_number);
  const exp = digitsOnly(vars.cc_expiry);
  const cvv = digitsOnly(vars.cc_cvv);
  const zip = digitsOnly(vars.cc_billing_zip);

  // Test card: 12345678 with exp 1234 and CVV 123 - bypass Sola and return success
  if (cardNum === "12345678" && exp === "1234" && cvv === "123") {
    return { ok: true, message: "approved", refNum: "TEST-REF-" + Date.now(), maskedCard: "****5678" };
  }

  if (cardNum.length < 13 || exp.length < 4 || cvv.length < 3) {
    return { ok: false, message: "Missing card details.", refNum: null, maskedCard: null };
  }

  const { data: account, error: accountError } = await adminClient
    .from("sola_accounts")
    .select("sola_xkey, env")
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError || !account?.sola_xkey) {
    return { ok: false, message: accountError?.message || "Sola account not configured.", refNum: null, maskedCard: null };
  }

  const transactionPayload: Record<string, string> = {
    xKey: account.sola_xkey,
    xVersion: "4.5.9",
    xSoftwareName: "StorePilot Voice Ordering",
    xSoftwareVersion: "1.0.0",
    xCommand: "cc:sale",
    xAmount: amount.toFixed(2),
    xCardNum: cardNum,
    xCVV: cvv,
    xExp: exp.slice(0, 4),
    xInvoice: invoice,
  };

  if (customer?.name) transactionPayload.xName = customer.name;
  if (customer?.phone) transactionPayload.xPhone = customer.phone;
  if (zip) transactionPayload.xZip = zip;

  const response = await fetch(getGatewayUrl(account.env || "x1"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transactionPayload),
  });

  const result = await response.json().catch(() => ({}));
  const approved = result?.xResult === "A" || result?.xResult === "V";

  if (approved && result?.xToken && customer?.id) {
    await adminClient.from("sola_tokens").insert({
      user_id: userId,
      customer_id: customer.id,
      x_token: result.xToken,
      card_type: result.xCardType ?? null,
      masked_card: result.xMaskedCardNumber ?? null,
      exp: result.xExp ?? null,
    });
  }

  return {
    ok: approved,
    message: approved ? "approved" : (result?.xError || "Payment declined."),
    refNum: result?.xRefNum ? String(result.xRefNum) : null,
    maskedCard: result?.xMaskedCardNumber ? String(result.xMaskedCardNumber) : null,
  };
};

const createVoiceSale = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  customerId: string | null,
  cart: Array<Record<string, unknown>>,
  paymentMethod: string,
  pricing?: {
    subtotal: number;
    appliedTaxes: Array<{ name: string; rate: number; amount: number }>;
    totalTaxAmount: number;
    primaryTaxRate: number;
    total: number;
  },
) => {
  const computed = pricing ?? await getCartTotalsWithDefaultTaxes(adminClient, userId, cart);
  const subtotal = computed.subtotal;
  const appliedTaxes = computed.appliedTaxes;
  const totalTaxAmount = computed.totalTaxAmount;
  const primaryTaxRate = computed.primaryTaxRate;
  const total = computed.total;

  const { data: sale } = await adminClient
    .from("sales")
    .insert({
      user_id: userId,
      customer_id: customerId,
      items: cart.map((item) => ({
        product_id: item.product_id ?? item.id ?? null,
        quantity: Number(item.quantity ?? 1) || 1,
        price: money(item.price),
        name: String(item.name ?? "Item"),
        cost_price: money(item.cost_price),
        sku: String(item.sku ?? ""),
        isCustom: false,
      })),
      total,
      subtotal,
      payment_method: paymentMethod,
      taxes: appliedTaxes,
      service_charges_applied: [],
      tax_rate: primaryTaxRate,
      tax_amount: totalTaxAmount,
      service_charge: 0,
      timestamp: new Date().toISOString(),
    })
    .select("id, total")
    .single();

  return sale;
};

const createVoiceDelivery = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  saleId: string,
  customerId: string | null,
  address: string,
  instructions: string,
) => {
  const { data: delivery } = await adminClient
    .from("deliveries")
    .insert({
      user_id: userId,
      sale_id: saleId,
      customer_id: customerId,
      address,
      instructions,
      status: "pending",
    })
    .select("id")
    .single();

  return delivery;
};

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");

const gatherResponse = (
  prompt: string,
  actionUrl: string,
  options?: {
    numDigits?: number | null;
    finishOnKey?: string | null;
    voice?: string | null;
    rate?: string | null;
    audioUrl?: string | null;
  },
) => {
  const numDigitsAttr = options?.numDigits ? ` numDigits="${options.numDigits}"` : "";
  const finishOnKeyAttr = options?.finishOnKey ? ` finishOnKey="${options.finishOnKey}"` : "";
  const voiceAttr = options?.voice ? ` voice="${escapeXml(options.voice)}"` : "";
  const inner = options?.audioUrl
    ? `<Play>${escapeXml(options.audioUrl)}</Play>`
    : (options?.rate
        ? `<Say${voiceAttr}><prosody rate="${escapeXml(options.rate)}">${escapeXml(prompt)}</prosody></Say>`
        : `<Say${voiceAttr}>${escapeXml(prompt)}</Say>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" timeout="7" action="${escapeXml(actionUrl)}" method="POST"${numDigitsAttr}${finishOnKeyAttr}>
    ${inner}
  </Gather>
  <Redirect method="POST">${escapeXml(actionUrl)}</Redirect>
</Response>`;
};

const recordResponse = (prompt: string, actionUrl: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(prompt)}</Say>
  <Record timeout="5" maxLength="90" playBeep="true" action="${escapeXml(actionUrl)}" method="POST" />
  <Redirect method="POST">${escapeXml(actionUrl)}</Redirect>
</Response>`;

const sayAndHangup = (prompt: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(prompt)}</Say>
  <Hangup />
</Response>`;

const errorXml = (prompt: string) => toXmlResponse(sayAndHangup(prompt));

// ─────────── Call routing tree helpers ───────────
type RoutingNode =
  | { type: "flow"; flowId: string | null }
  | { type: "forward"; number: string; callerIdPassthrough?: boolean }
  | { type: "play"; message: string; voice?: string }
  | { type: "voicemail"; greeting?: string; notifySms?: string; notifyEmail?: string }
  | { type: "business_hours"; open: RoutingNode; closed: RoutingNode }
  | { type: "extension"; extensionId: string }
  | {
      type: "ivr_menu";
      menuId?: string | null;
      prompt?: string;
      promptVoice?: string | null;
      promptRate?: string | null;
      promptAudioUrl?: string | null;
      options?: Record<string, RoutingNode>;
    };

const isStoreOpenNow = async (
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  userId: string,
): Promise<boolean> => {
  const { data: rows } = await adminClient
    .from("pbx_business_hours")
    .select("day_of_week, is_open, open_time, close_time")
    .eq("user_id", userId);
  if (!rows || !rows.length) return true; // no hours configured → assume open
  const now = new Date();
  // Use UTC day index to keep behavior deterministic; store hours are stored in
  // local store time without TZ context. For v1 we treat them as UTC so calls
  // mirror the admin's saved hours; per-store TZ override is a follow-up.
  const dow = now.getUTCDay();
  const today = rows.find((r: { day_of_week: number }) => r.day_of_week === dow);
  if (!today || !today.is_open) return false;
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const cur = `${hh}:${mm}`;
  const open = String(today.open_time ?? "00:00").slice(0, 5);
  const close = String(today.close_time ?? "23:59").slice(0, 5);
  return cur >= open && cur <= close;
};

const dialResponse = (number: string, callerIdPassthrough = false, fromNumber?: string) => {
  const callerIdAttr = callerIdPassthrough && fromNumber ? ` callerId="${escapeXml(fromNumber)}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20"${callerIdAttr}>${escapeXml(number)}</Dial>
</Response>`;
};

// Builds a parallel <Dial> verb that rings every enabled SIP/PSTN ringer
// configured on an extension. SignalWire will POST back to `actionUrl` once
// the dial completes (DialCallStatus = answered | no-answer | busy | failed
// | canceled). WebRTC ringers are intentionally skipped here — the screen
// pop / browser ring is handled by a Realtime broadcast (Step 5).
// Group enabled ringers into tiers by kind, in priority order. TwiML forbids
// mixing <Sip> and <Number> in the same <Dial>, so we ring each tier in turn:
// SIP children together, then PSTN children together. Within a tier all
// ringers ring in parallel; if no one answers, we move to the next tier.
type RingerTier = { kind: "sip" | "pstn"; targets: string[] };

const buildRingerTiers = (
  ringers: Array<{ kind: string; target: string; enabled: boolean; priority?: number | null }>,
): RingerTier[] => {
  const sorted = [...ringers]
    .filter((r) => r.enabled && r.target)
    .sort((a, b) => (Number(a.priority ?? 0) - Number(b.priority ?? 0)));

  const sipTargets: string[] = [];
  const pstnTargets: string[] = [];
  for (const r of sorted) {
    const target = String(r.target).trim();
    if (r.kind === "sip") {
      sipTargets.push(target.startsWith("sip:") ? target : `sip:${target}`);
    } else if (r.kind === "pstn") {
      const e164 = normalizePhone(target);
      if (e164) pstnTargets.push(e164);
    }
    // webrtc: out-of-band screen-pop via Realtime broadcast (Step 5)
  }
  const tiers: RingerTier[] = [];
  if (sipTargets.length) tiers.push({ kind: "sip", targets: sipTargets });
  if (pstnTargets.length) tiers.push({ kind: "pstn", targets: pstnTargets });
  return tiers;
};

const extensionDialResponseForTier = (
  tier: RingerTier | null,
  options: { timeout: number; actionUrl: string; callerId?: string | null },
) => {
  // No remaining tier — Redirect with synthetic no-answer so the state machine
  // can fall through to voicemail/forward/hangup.
  if (!tier || !tier.targets.length) {
    const sep = options.actionUrl.includes("?") ? "&" : "?";
    const redirectUrl = `${options.actionUrl}${sep}DialCallStatus=no-answer&NoRingers=1`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${escapeXml(redirectUrl)}</Redirect>
</Response>`;
  }

  const children = tier.kind === "sip"
    ? tier.targets.map((t) => `  <Sip>${escapeXml(t)}</Sip>`)
    : tier.targets.map((t) => `  <Number>${escapeXml(t)}</Number>`);

  const callerIdAttr = options.callerId ? ` callerId="${escapeXml(options.callerId)}"` : "";
  const timeout = Math.max(5, Math.min(120, options.timeout || 25));
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="${timeout}" action="${escapeXml(options.actionUrl)}" method="POST"${callerIdAttr}>
${children.join("\n")}
  </Dial>
</Response>`;
};

const voicemailResponse = (greeting: string, actionUrl: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(greeting)}</Say>
  <Record timeout="5" maxLength="120" playBeep="true" action="${escapeXml(actionUrl)}" method="POST" />
  <Say>We did not record anything. Goodbye.</Say>
  <Hangup />
</Response>`;

// Walk a routing tree given a digit path. Returns either a menu (caller still
// needs to press) or a leaf action.
const walkRouting = async (
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  userId: string,
  routing: RoutingNode,
  path: string[],
): Promise<{ kind: "menu"; node: RoutingNode } | { kind: "leaf"; node: RoutingNode }> => {
  let cur: RoutingNode | undefined = routing;
  let i = 0;
  while (cur) {
    if (cur.type === "business_hours") {
      const open = await isStoreOpenNow(adminClient, userId);
      cur = open ? cur.open : cur.closed;
      continue;
    }
    if (cur.type === "ivr_menu") {
      // Reference to a reusable IVR menu (built in PBX → IVR / Auto attendant).
      // Hydrate inline so the rest of the walker can treat it as a normal menu.
      if (cur.menuId && (!cur.options || typeof cur.options !== "object")) {
        const { data: menu } = await adminClient
          .from("pbx_ivr_menus")
          .select("id, name, options, prompt_text, prompt_voice, prompt_rate, prompt_audio_id")
          .eq("id", cur.menuId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!menu) {
          return { kind: "leaf", node: { type: "play", message: "This menu is not available right now. Goodbye." } };
        }
        let promptAudioUrl: string | null = null;
        if (menu.prompt_audio_id) {
          const { data: af } = await adminClient
            .from("pbx_audio_files")
            .select("file_url")
            .eq("id", menu.prompt_audio_id)
            .eq("user_id", userId)
            .maybeSingle();
          promptAudioUrl = af?.file_url ?? null;
        }
        const opts: Record<string, RoutingNode> = {};
        for (const o of (menu.options as Array<Record<string, unknown>>) || []) {
          const key = String(o?.key ?? "");
          if (!/^[0-9*#]$/.test(key)) continue;
          const action = String(o?.action_type ?? "");
          const value = String(o?.action_value ?? "");
          if (action === "voicemail") {
            opts[key] = { type: "voicemail", greeting: "Please leave a message after the beep." };
          } else if (action === "go_to_menu" && value) {
            opts[key] = { type: "ivr_menu", menuId: value };
          } else if (action === "transfer_to_flow") {
            opts[key] = { type: "flow", flowId: value || null };
          } else if (action === "play_audio") {
            opts[key] = { type: "play", message: "Thank you. Goodbye." };
          } else if (action === "forward_to_extension") {
            opts[key] = value
              ? { type: "extension", extensionId: value }
              : { type: "play", message: "This option is not configured. Goodbye." };
          }
        }
        cur = {
          type: "ivr_menu",
          prompt: String(menu.prompt_text || cur.prompt || `You have reached ${menu.name || "the menu"}. Please make a selection.`),
          promptVoice: (menu.prompt_voice as string | null) ?? null,
          promptRate: (menu.prompt_rate as string | null) ?? null,
          promptAudioUrl,
          options: opts,
        };
      }
      if (i < (path?.length ?? 0)) {
        const digit = path[i++];
        const next = (cur.options || {})[digit];
        if (!next) {
          return { kind: "leaf", node: { type: "play", message: "Sorry, that is not a valid option. Goodbye." } };
        }
        cur = next;
        continue;
      }
      return { kind: "menu", node: cur };
    }
    return { kind: "leaf", node: cur };
  }
  return { kind: "leaf", node: { type: "play", message: "This number is not configured. Goodbye." } };
};

const ensureHttpsUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  return url;
};

const getPrompts = (
  flowConfig: JsonMap | undefined,
  defaultTemplate: JsonMap | undefined,
) => {
  const configuredPrompts = (flowConfig?.prompts ?? {}) as JsonMap;
  const templatePrompts = (defaultTemplate?.prompts ?? {}) as JsonMap;

  const choose = (key: string, fallback: string) => {
    const fromConfig = configuredPrompts[key];
    if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig;

    const fromTemplate = templatePrompts[key];
    if (typeof fromTemplate === "string" && fromTemplate.trim()) return fromTemplate;

    return fallback;
  };

  return {
    welcome: choose("welcome", defaultPrompts.welcome),
    sku: choose("sku", defaultPrompts.sku),
    qty: choose("qty", defaultPrompts.qty),
    addMore: choose("add_more", defaultPrompts.addMore),
    address: choose("address", defaultPrompts.address),
    checkout: choose("checkout", defaultPrompts.checkout),
  };
};

const isGraphFlow = (flow: unknown): flow is GraphFlow => {
  const cast = flow as GraphFlow;
  return !!cast && cast.mode === "graph" && Array.isArray(cast.nodes) && Array.isArray(cast.edges) && typeof cast.startNodeId === "string";
};

const findMatchingEdge = (
  edges: GraphEdge[],
  digits: string,
  hasRecording: boolean,
): GraphEdge | null => {
  if (!edges.length) return null;

  if (digits) {
    const digitEdge = edges.find((edge) => edge.conditionType === "digit" && String(edge.conditionValue ?? "") === digits);
    if (digitEdge) return digitEdge;
  }

  if (hasRecording) {
    const recordedEdge = edges.find((edge) => edge.conditionType === "recorded");
    if (recordedEdge) return recordedEdge;
  }

  const anyEdge = edges.find((edge) => edge.conditionType === "any");
  if (anyEdge) return anyEdge;

  const alwaysEdge = edges.find((edge) => edge.conditionType === "always" || !edge.conditionType);
  if (alwaysEdge) return alwaysEdge;

  return null;
};

const joinPrompts = (parts: string[]) => {
  return parts.map((part) => part.trim()).filter(Boolean).join(" ");
};

const resolveRenderableNode = (
  graph: GraphFlow,
  nodeMap: Map<string, GraphNode>,
  edgeMap: Map<string, GraphEdge[]>,
  startNodeId: string,
  reqUrl: string,
  promptPrefix: string[] = [],
  vars?: JsonMap,
): { xml: string; currentNodeId: string } => {
  const visited = new Set<string>();
  let cursor = startNodeId;
  const collectedPrompts = [...promptPrefix];

  for (let depth = 0; depth < 12; depth += 1) {
    if (visited.has(cursor)) {
      return { xml: sayAndHangup("Flow loop detected. Please try again later."), currentNodeId: cursor };
    }
    visited.add(cursor);

    const node = nodeMap.get(cursor);
    if (!node) {
      return { xml: sayAndHangup("Flow node is missing. Please contact support."), currentNodeId: graph.startNodeId };
    }

    // Skip Address Menu if no saved address exists
    if (node.id === "n_address_menu" && vars) {
      const savedAddress = String(vars.saved_customer_address ?? "").trim();
      if (!savedAddress) {
        const edge = findMatchingEdge(edgeMap.get(node.id) ?? [], "2", false);
        if (edge) {
          cursor = edge.to;
          continue;
        }
      }
    }

    let prompt = (node.prompt || "").trim();
    
    // Inject saved address into Address Menu prompt
    if (node.id === "n_address_menu" && vars) {
      const savedAddress = String(vars.saved_customer_address ?? "").trim();
      if (savedAddress) {
        prompt = `We have your address on file as: ${savedAddress}. ${prompt}`;
      }
    }
    
    if (node.captureVar === "callback_confirmed" || node.id === "n_confirm_callback") {
      const hasYesNoGuidance = /press\s*1/i.test(prompt) && /press\s*2/i.test(prompt);
      if (!hasYesNoGuidance) {
        prompt = joinPrompts([
          prompt || "Is the best callback number the number you are calling from?",
          "Press 1 for yes. Press 2 for no.",
        ]);
      }
    }
    if (node.type === "message") {
      if (prompt) collectedPrompts.push(prompt);
      const edge = findMatchingEdge(edgeMap.get(node.id) ?? [], "", false);
      if (!edge) {
        return { xml: sayAndHangup(joinPrompts(collectedPrompts) || "Thank you for calling."), currentNodeId: node.id };
      }
      cursor = edge.to;
      continue;
    }

    if (node.type === "record") {
      return {
        xml: recordResponse(joinPrompts([...collectedPrompts, prompt || "Please leave a message after the tone."]), reqUrl),
        currentNodeId: node.id,
      };
    }

    if (node.type === "payment") {
      // Redirect guarantees an immediate follow-up webhook call for processing.
      return {
        xml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(joinPrompts([...collectedPrompts, prompt || "Please hold while we process your payment."]))}</Say>
  <Redirect method="POST">${escapeXml(reqUrl)}</Redirect>
</Response>`,
        currentNodeId: node.id,
      };
    }

    if (node.type === "end") {
      return {
        xml: sayAndHangup(joinPrompts([...collectedPrompts, prompt || "Thank you for calling."])),
        currentNodeId: node.id,
      };
    }

    return {
      xml: gatherResponse(
        joinPrompts([...collectedPrompts, prompt || "Please provide input."]),
        reqUrl,
        { numDigits: node.maxDigits ?? null, finishOnKey: node.finishOnKey ?? null },
      ),
      currentNodeId: node.id,
    };
  }

  return { xml: sayAndHangup("Flow exceeded max depth."), currentNodeId: graph.startNodeId };
};

const handleGraphFlow = async (
  adminClient: ReturnType<typeof createSupabaseClient>,
  userId: string,
  graph: GraphFlow,
  existingSession: {
    cart?: unknown;
    address_recording_url?: string | null;
    address_transcript?: string | null;
    payment_status?: string | null;
  } | null,
  existingMetadata: JsonMap,
  body: JsonMap,
  reqUrl: string,
  providerCallId: string,
  callerPhone?: string | null,
  voiceSettings?: Record<string, unknown>,
) => {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeMap = new Map<string, GraphEdge[]>();
  graph.edges.forEach((edge) => {
    const existing = edgeMap.get(edge.from) ?? [];
    existing.push(edge);
    edgeMap.set(edge.from, existing);
  });

  const graphStateRaw = existingMetadata.graphState;
  const graphState = (graphStateRaw && typeof graphStateRaw === "object" ? graphStateRaw : {}) as JsonMap;
  const varsRaw = graphState.vars;
  const vars = (varsRaw && typeof varsRaw === "object" ? varsRaw : {}) as JsonMap;

  let currentNodeId = typeof graphState.currentNodeId === "string" ? graphState.currentNodeId : graph.startNodeId;
  if (!nodeMap.has(currentNodeId)) currentNodeId = graph.startNodeId;

  const node = nodeMap.get(currentNodeId) ?? nodeMap.get(graph.startNodeId);
  if (!node) {
    return {
      xml: sayAndHangup("Flow is unavailable."),
      nextNodeId: graph.startNodeId,
      nextMetadata: {
        ...existingMetadata,
        graphState: {
          currentNodeId: graph.startNodeId,
          vars,
        },
      },
      state: "graph:error",
      addressRecordingUrl: null as string | null,
      addressTranscript: null as string | null,
      cart: [] as Array<Record<string, unknown>>,
    };
  }

  const digits = String(body.Digits ?? body.digits ?? "").trim();
  const recordingUrl = String(body.RecordingUrl ?? body.recording_url ?? "").trim();
  const transcriptionText = String(body.TranscriptionText ?? body.transcription_text ?? "").trim();

  let nextNodeId = node.id;
  let responseXml = "";
  let nextAddressRecordingUrl: string | null = null;
  let nextAddressTranscript: string | null = null;
  const currentCart = Array.isArray(existingSession?.cart)
    ? [...(existingSession.cart as Array<Record<string, unknown>>)]
    : [];
  let paymentStatus = existingSession?.payment_status || "pending";

  const outgoing = edgeMap.get(node.id) ?? [];
  const retryCountsRaw = vars.node_retry_counts;
  const retryCounts = (retryCountsRaw && typeof retryCountsRaw === "object"
    ? { ...(retryCountsRaw as Record<string, unknown>) }
    : {}) as Record<string, unknown>;

  const clearNoInputRetry = (nodeId: string) => {
    delete retryCounts[nodeId];
    vars.node_retry_counts = retryCounts;
  };

  const nextNoInputRetry = (nodeId: string, countAsRetry: boolean) => {
    if (!countAsRetry) {
      retryCounts[nodeId] = 0;
      vars.node_retry_counts = retryCounts;
      return 0;
    }
    const current = Number(retryCounts[nodeId] ?? 0);
    const next = (Number.isFinite(current) ? current : 0) + 1;
    retryCounts[nodeId] = next;
    vars.node_retry_counts = retryCounts;
    return next;
  };

  if (node.type === "record") {
    if (!recordingUrl) {
      const missCount = nextNoInputRetry(node.id, Boolean(existingSession));
      if (missCount >= 3) {
        responseXml = sayAndHangup("We did not receive input after 3 attempts. Goodbye.");
        nextNodeId = node.id;
      } else {
        const prefix = missCount > 0 ? [`We did not receive input. Please try again. Attempt ${missCount + 1} of 3.`] : [];
        const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, prefix);
        responseXml = render.xml;
        nextNodeId = render.currentNodeId;
      }
    } else {
      clearNoInputRetry(node.id);
      if (node.captureVar) {
        vars[node.captureVar] = recordingUrl;
      }
      vars.last_recording_url = recordingUrl;
      vars.last_transcript = transcriptionText || null;
      if (node.captureVar === "address_recording") {
        vars.address_transcript = transcriptionText || null;
      }
      if (node.captureVar === "street_name_recording") {
        vars.street_name_recording_transcript = transcriptionText || null;
        vars.street_name_transcript = transcriptionText || null;
      }
      if (node.captureVar === "delivery_instructions_recording") {
        vars.delivery_instructions_recording_transcript = transcriptionText || null;
        vars.delivery_instructions_transcript = transcriptionText || null;
      }

      nextAddressRecordingUrl = recordingUrl;
      nextAddressTranscript = transcriptionText || null;

      const edge = findMatchingEdge(outgoing, digits, true);
      if (!edge) {
        responseXml = sayAndHangup("Recording received. No next step configured.");
        nextNodeId = node.id;
      } else {
        const render = resolveRenderableNode(graph, nodeMap, edgeMap, edge.to, reqUrl, [], vars);
        responseXml = render.xml;
        nextNodeId = render.currentNodeId;
      }
    }
  } else if (node.type === "gather" || node.type === "branch") {
    if (!digits) {
      const missCount = nextNoInputRetry(node.id, Boolean(existingSession));
      if (missCount >= 3) {
        responseXml = sayAndHangup("We did not receive input after 3 attempts. Goodbye.");
        nextNodeId = node.id;
      } else {
        const prefix = missCount > 0 ? [`We did not receive input. Please try again. Attempt ${missCount + 1} of 3.`] : [];
        const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, prefix);
        responseXml = render.xml;
        nextNodeId = render.currentNodeId;
      }
    } else {
      clearNoInputRetry(node.id);
      if (node.captureVar) vars[node.captureVar] = digits;
      let blockTransition = false;

      if (node.captureVar === "callback_confirmed" && digits === "1" && callerPhone) {
        // User confirmed the calling number is the best callback number
        vars.customer_phone = callerPhone;
        const existingCustomer = await lookupVoiceCustomerByPhone(adminClient, userId, callerPhone);
        if (existingCustomer?.address) {
          vars.saved_customer_address = String(existingCustomer.address);
          vars.saved_customer_name = String(existingCustomer.name ?? "");
        }
      }

      if (node.captureVar === "customer_phone") {
        const existingCustomer = await lookupVoiceCustomerByPhone(adminClient, userId, digits);
        if (existingCustomer?.address) {
          vars.saved_customer_address = String(existingCustomer.address);
          vars.saved_customer_name = String(existingCustomer.name ?? "");
        } else {
          delete vars.saved_customer_address;
          delete vars.saved_customer_name;
        }
      }

      if (node.captureVar === "address_choice") {
        const savedAddress = String(vars.saved_customer_address ?? "").trim();
        if (savedAddress && digits === "1") {
          // User chose to use saved address
          vars.address_choice_made = "1";
          vars.use_saved_address = "1";
          vars.delivery_address = savedAddress;
          // Route to payment/checkout, not through address entry
        } else if (digits === "2" || !savedAddress) {
          // User chose to enter new address or no saved address exists
          vars.address_choice_made = "1";
          vars.use_saved_address = "0";
          delete vars.saved_customer_address;
          // Will route to street_number via edges automatically
        }
      }

      if (node.captureVar === "street_number") {
        const customerPhone = String(vars.customer_phone ?? "").trim();
        if (!vars.saved_customer_address && customerPhone) {
          const existingCustomer = await lookupVoiceCustomerByPhone(adminClient, userId, customerPhone);
          if (existingCustomer?.address) {
            vars.saved_customer_address = String(existingCustomer.address);
            vars.saved_customer_name = String(existingCustomer.name ?? "");
          }
        }
      }

      if (node.captureVar === "item_number") {
        // Clear previous pending product so a failed lookup cannot reuse stale data.
        delete vars.pending_product_id;
        delete vars.pending_product_name;
        delete vars.pending_product_price;
        delete vars.pending_product_cost;
        delete vars.pending_product_sku;
        delete vars.pending_product_barcode;

        const product = await lookupProductByItemNumber(adminClient, userId, digits);
        if (!product) {
          const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, ["We could not find that item number."], vars);
          responseXml = render.xml;
          nextNodeId = render.currentNodeId;
          blockTransition = true;
        } else {
          // Check if product is restricted by voice settings
          const allowedIds = Array.isArray(voiceSettings?.allowed_product_ids) ? (voiceSettings.allowed_product_ids as string[]) : null;
          const restrictProducts = voiceSettings?.restrict_products === true;
          if (restrictProducts && allowedIds && !allowedIds.includes(String(product.id))) {
            const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, ["Sorry, that item is not available for phone ordering."], vars);
            responseXml = render.xml;
            nextNodeId = render.currentNodeId;
            blockTransition = true;
          } else {
            const stock = Number(product.stock ?? Infinity);
            const allowOutOfStock = voiceSettings?.allow_out_of_stock !== false; // default true
            if (!allowOutOfStock && stock <= 0) {
              const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, ["Sorry, that item is currently out of stock."], vars);
              responseXml = render.xml;
              nextNodeId = render.currentNodeId;
              blockTransition = true;
            } else {
              vars.pending_product_id = String(product.id ?? "");
              vars.pending_product_name = String(product.name ?? "item");
              vars.pending_product_price = money(product.price);
              vars.pending_product_cost = money(product.cost_price);
              vars.pending_product_sku = String(product.sku ?? "");
              vars.pending_product_barcode = String(product.barcode ?? "");
            }
          }
        }
      }

      if (node.captureVar === "item_qty") {
        const qty = Number.parseInt(digits, 10);
        const pendingProductId = String(vars.pending_product_id ?? "").trim();
        if (!pendingProductId || Number.isNaN(qty) || qty <= 0) {
          const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, ["Enter a valid quantity."], vars);
          responseXml = render.xml;
          nextNodeId = render.currentNodeId;
          blockTransition = true;
        } else {
          currentCart.push({
            id: pendingProductId,
            product_id: pendingProductId,
            name: String(vars.pending_product_name ?? "item"),
            price: money(vars.pending_product_price),
            cost_price: money(vars.pending_product_cost),
            sku: String(vars.pending_product_sku ?? ""),
            barcode: String(vars.pending_product_barcode ?? ""),
            quantity: qty,
          });
          vars.last_item_name = String(vars.pending_product_name ?? "item");
          vars.last_item_price = money(vars.pending_product_price) * qty;
          vars.last_item_qty = qty;
          delete vars.pending_product_id;
          delete vars.pending_product_name;
          delete vars.pending_product_price;
          delete vars.pending_product_cost;
          delete vars.pending_product_sku;
          delete vars.pending_product_barcode;
        }
      }

      if (!blockTransition) {
        if (node.captureVar === "cart_choice" && digits === "2" && !currentCart.length) {
          const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, ["Your cart is empty."], vars);
          responseXml = render.xml;
          nextNodeId = render.currentNodeId;
        } else {
          // Smart edge routing for customer phone: skip Address Menu if no saved address
          let selectedEdge = findMatchingEdge(outgoing, digits, false);
          if (node.captureVar === "customer_phone" && selectedEdge) {
            const savedAddress = String(vars.saved_customer_address ?? "").trim();
            const edges = outgoing || [];
            if (!savedAddress) {
              // New customer: route to street_number (always edge), not address_menu (any edge)
              const streetEdge = edges.find((e) => e.to === "n_street_number");
              if (streetEdge) selectedEdge = streetEdge;
            }
          }
          
          if (!selectedEdge) {
            const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, ["Input not recognized."], vars);
            responseXml = render.xml;
            nextNodeId = render.currentNodeId;
          } else {
            const promptPrefix: string[] = [];
            if (node.captureVar === "item_number") {
              promptPrefix.push(`We found ${String(vars.pending_product_name ?? "item")} for ${moneySpeech(vars.pending_product_price)}.`);
            }
            if (node.captureVar === "cart_choice" && digits === "3") {
              const totals = await getCartTotalsWithDefaultTaxes(adminClient, userId, currentCart);
              promptPrefix.push(cartSummarySpeech(currentCart, totals));
            }
            const render = resolveRenderableNode(graph, nodeMap, edgeMap, selectedEdge.to, reqUrl, promptPrefix, vars);
            responseXml = render.xml;
            nextNodeId = render.currentNodeId;
          }
        }
      }
    }
  } else if (node.type === "message") {
    const edge = findMatchingEdge(outgoing, digits, false);
    if (!edge) {
      responseXml = sayAndHangup(node.prompt || "Thank you for calling.");
      nextNodeId = node.id;
    } else {
      const render = resolveRenderableNode(graph, nodeMap, edgeMap, edge.to, reqUrl, [node.prompt || ""], vars);
      responseXml = render.xml;
      nextNodeId = render.currentNodeId;
    }
  } else if (node.type === "payment") {
    if (paymentStatus === "paid") {
      const edge = findMatchingEdge(outgoing, "", false);
      if (!edge) {
        responseXml = sayAndHangup("Your payment has already been processed.");
        nextNodeId = node.id;
      } else {
        const render = resolveRenderableNode(graph, nodeMap, edgeMap, edge.to, reqUrl, [], vars);
        responseXml = render.xml;
        nextNodeId = render.currentNodeId;
      }
    } else if (!currentCart.length) {
      responseXml = sayAndHangup("Your cart is empty. We could not process this order.");
      nextNodeId = node.id;
      paymentStatus = "failed";
    } else {
      const addressText = String(existingSession?.address_transcript ?? vars.address_transcript ?? vars.last_transcript ?? "").trim() || null;
      const structuredAddress = buildDeliveryAddress(vars, addressText);
      const savedAddress = String(vars.saved_customer_address ?? "").trim() || null;
      const finalAddress = structuredAddress || (String(vars.use_saved_address ?? "") === "1" ? savedAddress : null);
      const deliveryInstructions = buildDeliveryInstructions(vars);
      const customerPhone = String(vars.customer_phone ?? "").trim();
      const customer = await upsertVoiceCustomer(adminClient, userId, customerPhone, finalAddress || addressText);
      const totals = await getCartTotalsWithDefaultTaxes(adminClient, userId, currentCart);
      const payment = await chargeVoiceOrder(adminClient, userId, totals.total, vars, customer, providerCallId);

      if (!payment.ok) {
        const retryNodeId = "n_payment_failed";
        if (nodeMap.has(retryNodeId)) {
          const render = resolveRenderableNode(graph, nodeMap, edgeMap, retryNodeId, reqUrl, [`We could not process your payment. ${payment.message}`]);
          responseXml = render.xml;
          nextNodeId = render.currentNodeId;
        } else {
          responseXml = sayAndHangup(`We could not process your payment. ${payment.message} Please call the store for help.`);
          nextNodeId = node.id;
        }
        paymentStatus = "failed";
      } else {
        const sale = await createVoiceSale(adminClient, userId, customer?.id ?? null, currentCart, "phone_card", totals);
        if (sale?.id && finalAddress) {
          await createVoiceDelivery(adminClient, userId, sale.id, customer?.id ?? null, finalAddress, deliveryInstructions);
        }
        vars.sale_id = sale?.id ?? null;
        vars.payment_ref = payment.refNum;
        vars.masked_card = payment.maskedCard;
        vars.delivery_address = finalAddress;
        vars.delivery_instructions = deliveryInstructions;
        paymentStatus = "paid";

        const edge = findMatchingEdge(outgoing, "", false);
        if (!edge) {
          responseXml = sayAndHangup("Your payment was approved and your order has been saved.");
          nextNodeId = node.id;
        } else {
          const render = resolveRenderableNode(graph, nodeMap, edgeMap, edge.to, reqUrl, ["Your payment was approved and your order has been saved."]);
          responseXml = render.xml;
          nextNodeId = render.currentNodeId;
        }
      }
    }
  } else if (node.type === "end") {
    responseXml = sayAndHangup(node.prompt || "Thank you for calling.");
    nextNodeId = node.id;
  } else {
    const render = resolveRenderableNode(graph, nodeMap, edgeMap, node.id, reqUrl, [], vars);
    responseXml = render.xml;
    nextNodeId = render.currentNodeId;
  }

  const nextMetadata: JsonMap = {
    ...existingMetadata,
    lastWebhook: body,
    graphState: {
      currentNodeId: nextNodeId,
      vars,
      lastNodeType: node.type,
    },
  };

  return {
    xml: responseXml,
    nextNodeId,
    nextMetadata,
    state: `graph:${nextNodeId}`,
    addressRecordingUrl: nextAddressRecordingUrl,
    addressTranscript: nextAddressTranscript,
    cart: currentCart,
    paymentStatus,
  };
};

const handleLegacyFlow = (
  prompts: {
    welcome: string;
    sku: string;
    qty: string;
    addMore: string;
    address: string;
    checkout: string;
  },
  existingSession: {
    state?: string;
    metadata?: unknown;
    cart?: unknown;
    address_recording_url?: string | null;
    address_transcript?: string | null;
  } | null,
  body: JsonMap,
  reqUrl: string,
) => {
  const existingMetadata =
    existingSession?.metadata && typeof existingSession.metadata === "object"
      ? (existingSession.metadata as JsonMap)
      : {};

  const digits = String(body.Digits ?? body.digits ?? "").trim();
  const recordingUrl = String(body.RecordingUrl ?? body.recording_url ?? "").trim();
  const transcriptionText = String(body.TranscriptionText ?? body.transcription_text ?? "").trim();
  const currentState = existingSession?.state ?? "welcome";

  const currentCart = Array.isArray(existingSession?.cart)
    ? [...(existingSession.cart as Array<Record<string, unknown>>)]
    : [];

  let nextState = currentState;
  let responseXml = "";
  const nextMetadata: JsonMap = {
    ...existingMetadata,
    lastWebhook: body,
  };
  let nextAddressRecordingUrl = existingSession?.address_recording_url ?? null;
  let nextAddressTranscript = existingSession?.address_transcript ?? null;

  if (currentState === "welcome") {
    if (digits === "1") {
      nextState = "sku";
      responseXml = gatherResponse(prompts.sku, reqUrl, { finishOnKey: "#" });
    } else {
      responseXml = gatherResponse(prompts.welcome, reqUrl, { numDigits: 1 });
    }
  } else if (currentState === "sku") {
    if (!digits) {
      responseXml = gatherResponse(prompts.sku, reqUrl, { finishOnKey: "#" });
    } else {
      nextMetadata.pendingSku = digits;
      nextState = "qty";
      responseXml = gatherResponse(prompts.qty, reqUrl, { finishOnKey: "#" });
    }
  } else if (currentState === "qty") {
    const parsedQty = Number.parseInt(digits, 10);
    const pendingSku = String(nextMetadata.pendingSku ?? "").trim();
    if (!pendingSku || Number.isNaN(parsedQty) || parsedQty <= 0) {
      responseXml = gatherResponse(prompts.qty, reqUrl, { finishOnKey: "#" });
    } else {
      currentCart.push({ sku: pendingSku, qty: parsedQty });
      delete nextMetadata.pendingSku;
      nextState = "add_more";
      responseXml = gatherResponse(prompts.addMore, reqUrl, { numDigits: 1 });
    }
  } else if (currentState === "add_more") {
    if (digits === "1") {
      nextState = "sku";
      responseXml = gatherResponse(prompts.sku, reqUrl, { finishOnKey: "#" });
    } else if (digits === "2") {
      nextState = "address_record";
      responseXml = recordResponse(prompts.address, reqUrl);
    } else {
      responseXml = gatherResponse(prompts.addMore, reqUrl, { numDigits: 1 });
    }
  } else if (currentState === "address_record") {
    if (recordingUrl) {
      nextAddressRecordingUrl = recordingUrl;
      nextAddressTranscript = transcriptionText || null;
      nextState = "checkout";
      responseXml = sayAndHangup(prompts.checkout);
    } else {
      responseXml = recordResponse(prompts.address, reqUrl);
    }
  } else {
    responseXml = sayAndHangup(prompts.checkout);
  }

  return {
    xml: responseXml,
    nextState,
    nextMetadata,
    cart: currentCart,
    addressRecordingUrl: nextAddressRecordingUrl,
    addressTranscript: nextAddressTranscript,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return errorXml("Phone ordering endpoint requires a post request.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return errorXml("Phone ordering is temporarily unavailable.");
  }

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";
  const callbackUrl = ensureHttpsUrl(req.url);
  const reparsedReq = new Request(req.url, {
    method: "POST",
    headers: { "content-type": contentType },
    body: rawBody,
  });
  const body = await parseWebhookBody(reparsedReq);

  const toNumber = normalizePhone(
    String(body.To ?? body.to ?? body.Called ?? body.called ?? body.to_number ?? body.destination ?? ""),
  );
  const providerCallId = String(
    body.CallSid ?? body.call_sid ?? body.CallUUID ?? body.call_uuid ?? body.call_id ?? body.id ?? "",
  );

  console.log("voice-webhook request", {
    hasTo: !!toNumber,
    hasCallId: !!providerCallId,
    keys: Object.keys(body || {}).slice(0, 25),
  });

  if (!toNumber || !providerCallId) {
    return errorXml("We could not identify this call. Please try again in a few minutes.");
  }

  const phoneCandidates = phoneLookupCandidates(toNumber);
  if (!phoneCandidates.length) {
    return errorXml("We could not route this phone number. Please contact the store.");
  }

  const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey);
  const { data: channel, error: channelError } = await adminClient
    .from("store_channels")
    .select("id, user_id, webhook_secret, voice_ordering_enabled, is_active, configured, routing, label, inbound_phone_e164")
    .in("inbound_phone_e164", phoneCandidates)
    .maybeSingle();

  if (channelError) {
    console.error("voice-webhook routing lookup failed", channelError);
    return errorXml("Store routing is temporarily unavailable.");
  }

  if (!channel || !channel.is_active) {
    console.log("voice-webhook channel unavailable", {
      found: !!channel,
      isActive: channel?.is_active ?? null,
      phoneCandidates,
    });
    return errorXml("This number is not in service. Please contact the store.");
  }

  if (!channel.configured) {
    return errorXml("This number has not been configured yet. Please contact the store.");
  }

  if (channel.webhook_secret) {
    const signature = req.headers.get("x-signalwire-signature") ?? req.headers.get("x-twilio-signature");
    const isSignatureValid = await verifySha256Hmac(rawBody, channel.webhook_secret, signature);
    if (!isSignatureValid) {
      console.warn("voice-webhook invalid signature", { hasSignature: !!signature, providerCallId });
      return errorXml("We could not verify this call request. Please try again shortly.");
    }
  }

  const { data: existingSession } = await adminClient
    .from("phone_call_sessions")
    .select("id, state, metadata, cart, address_recording_url, address_transcript, payment_status")
    .eq("provider", "signalwire")
    .eq("provider_call_id", providerCallId)
    .maybeSingle();

  // ─────────── Call routing layer ───────────
  // Routing tree decides what to do with this call (run a flow / forward /
  // play message / voicemail / business-hours branch / IVR menu). Once we land
  // on a "flow" leaf we set metadata.flow_id and fall through to the existing
  // flow runner. Once any other leaf fires it terminates the call by itself.
  const sessionMeta: JsonMap =
    (existingSession?.metadata && typeof existingSession.metadata === "object")
      ? (existingSession.metadata as JsonMap)
      : {};
  const sessionState = String(existingSession?.state ?? "");

  // Post-dial leg: SignalWire calls back here when our <Dial> for an
  // extension finishes. DialCallStatus tells us if anyone picked up.
  if (sessionState === "routing_extension_dial") {
    const dialStatus = String(body.DialCallStatus ?? body.dial_call_status ?? "").toLowerCase();

    // Helper: dismiss the screen-pop popup on the assigned user's POS.
    // Called whenever a terminal outcome happens (answered, voicemail, etc).
    const broadcastRingStop = async (kind: "answered" | "declined" | "timeout" | "ring_stop") => {
      try {
        await adminClient.from("pbx_ring_events").insert({
          user_id: channel.user_id,
          assigned_user_id: (sessionMeta.assigned_user_id as string | null | undefined) || null,
          event_type: kind,
          call_session_id: existingSession?.id ?? null,
          channel_id: channel.id,
          extension_id: (sessionMeta.extension_id as string | null | undefined) || null,
          extension_number: String(sessionMeta.extension_number ?? ""),
          metadata: { dial_status: dialStatus },
        });
      } catch (ringErr) {
        console.warn("voice-webhook ring_stop broadcast failed", ringErr);
      }
    };

    // If the call was answered the bridged audio is already flowing — when
    // the called party hangs up, SignalWire still POSTs back here. We just
    // hang up gracefully.
    if (dialStatus === "answered" || dialStatus === "completed") {
      await adminClient
        .from("phone_call_sessions")
        .update({ call_status: "completed", state: "routing_extension_answered" })
        .eq("id", existingSession!.id);
      await broadcastRingStop("answered");
      return toXmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Hangup />\n</Response>`);
    }

    const noAnswerAction = String(sessionMeta.no_answer_action ?? "voicemail");
    const forwardExternalNumber = String(sessionMeta.forward_external_number ?? "").trim();
    const voicemailEnabled = sessionMeta.voicemail_enabled !== false;
    const extNumber = sessionMeta.extension_number ?? "";

    // Sequential ringer tiers: if the previous tier got no answer/busy/failed
    // and we still have tiers left, ring the next one. This is how we ring
    // SIP (desk) and PSTN (cell) one after another \u2014 TwiML forbids mixing
    // them in the same <Dial>.
    const pendingTiersRaw = Array.isArray(sessionMeta.pending_ringer_tiers)
      ? (sessionMeta.pending_ringer_tiers as Array<{ kind: string; targets: string[] }>)
      : [];
    if (dialStatus !== "answered" && dialStatus !== "completed" && pendingTiersRaw.length > 0) {
      const nextTier = pendingTiersRaw[0];
      const remaining = pendingTiersRaw.slice(1);
      const ringTimeout = Number(sessionMeta.ring_timeout_secs) || 25;
      const callerId = (sessionMeta.caller_id_for_dial as string | null | undefined) || null;
      await adminClient
        .from("phone_call_sessions")
        .update({
          state: "routing_extension_dial",
          metadata: { ...sessionMeta, pending_ringer_tiers: remaining },
        })
        .eq("id", existingSession!.id);
      const xml = extensionDialResponseForTier(
        nextTier && nextTier.targets && nextTier.targets.length
          ? { kind: nextTier.kind === "pstn" ? "pstn" : "sip", targets: nextTier.targets }
          : null,
        { timeout: ringTimeout, actionUrl: callbackUrl, callerId },
      );
      return toXmlResponse(xml);
    }

    if (noAnswerAction === "forward_external" && forwardExternalNumber) {
      const fromNumber = normalizePhone(String(body.From ?? body.from ?? ""));
      await adminClient
        .from("phone_call_sessions")
        .update({
          state: "routing_extension_forwarded",
          metadata: { ...sessionMeta, forwarded_to: forwardExternalNumber },
        })
        .eq("id", existingSession!.id);
      await broadcastRingStop("timeout");
      return toXmlResponse(dialResponse(forwardExternalNumber, true, fromNumber));
    }

    if (noAnswerAction === "hangup" || (noAnswerAction === "voicemail" && !voicemailEnabled)) {
      await adminClient
        .from("phone_call_sessions")
        .update({ call_status: "completed", state: "routing_extension_hangup" })
        .eq("id", existingSession!.id);
      await broadcastRingStop("timeout");
      return toXmlResponse(sayAndHangup("Sorry, no one is available right now. Please call back later. Goodbye."));
    }

    // Default: voicemail
    const greeting = `You have reached extension ${extNumber}. Please leave a message after the beep.`;
    await adminClient
      .from("phone_call_sessions")
      .update({
        state: "routing_voicemail",
        metadata: { ...sessionMeta, came_from: "extension_no_answer" },
      })
      .eq("id", existingSession!.id);
    await broadcastRingStop("timeout");
    return toXmlResponse(voicemailResponse(greeting, callbackUrl));
  }

  // Voicemail leg: Twilio just POSTed the recording for our <Record action>.
  if (sessionState === "routing_voicemail" && (body.RecordingUrl || body.recording_url)) {
    const recordingUrl = String(body.RecordingUrl ?? body.recording_url ?? "");
    const duration = Number(body.RecordingDuration ?? body.recording_duration ?? 0) || null;
    const fromNumber = normalizePhone(String(body.From ?? body.from ?? ""));
    const extensionId = (sessionMeta.extension_id as string | undefined) || null;
    // Write to pbx_voicemails — that's what the PBX → Voicemails view reads.
    const { error: vmErr } = await adminClient.from("pbx_voicemails").insert({
      user_id: channel.user_id,
      channel_id: channel.id,
      extension_id: extensionId,
      from_number: fromNumber || null,
      recording_url: recordingUrl || null,
      duration_seconds: duration,
    });
    if (vmErr) {
      console.error("voice-webhook voicemail insert failed", vmErr);
      // Fallback to legacy table so we still keep a record.
      await adminClient.from("voicemails").insert({
        user_id: channel.user_id,
        channel_id: channel.id,
        from_number: fromNumber || null,
        recording_url: recordingUrl || null,
        duration_seconds: duration,
      });
    }
    await adminClient
      .from("phone_call_sessions")
      .update({
        call_status: "completed",
        state: "routing_voicemail_done",
        metadata: { ...sessionMeta, voicemail_url: recordingUrl },
      })
      .eq("id", existingSession!.id);
    return toXmlResponse(sayAndHangup("Thank you. Your message has been received. Goodbye."));
  }

  // Resolve which flow id to use (if any). If routing has already picked a
  // flow on a previous turn, reuse it.
  let selectedFlowId: string | null = (typeof sessionMeta.flow_id === "string" ? sessionMeta.flow_id as string : null);
  let routingMeta: JsonMap = sessionMeta;

  if (!selectedFlowId) {
    const routingTree: RoutingNode = (channel.routing && typeof channel.routing === "object")
      ? channel.routing as RoutingNode
      : { type: "flow", flowId: null };

    // Build the digit path for routing menus: previous path + this turn's digits
    // (only when caller is responding to a routing menu, not a flow gather).
    const prevPath: string[] = Array.isArray(sessionMeta.routing_path)
      ? (sessionMeta.routing_path as string[]).filter((d) => typeof d === "string")
      : [];
    const newDigit = String(body.Digits ?? body.digits ?? "").trim();
    const path = (sessionState === "routing_menu" && newDigit) ? [...prevPath, newDigit] : prevPath;

    const resolved = await walkRouting(adminClient, channel.user_id, routingTree, path);

    if (resolved.kind === "menu") {
      const menu = resolved.node as Extract<RoutingNode, { type: "ivr_menu" }>;
      const xml = gatherResponse(menu.prompt || "", callbackUrl, {
        numDigits: 1,
        voice: menu.promptVoice ?? null,
        rate: menu.promptRate ?? null,
        audioUrl: menu.promptAudioUrl ?? null,
      });
      const upsertPayload = {
        user_id: channel.user_id,
        store_channel_id: channel.id,
        provider: "signalwire",
        provider_call_id: providerCallId,
        call_status: String(body.CallStatus ?? body.call_status ?? "in_progress"),
        state: "routing_menu",
        last_digits: newDigit || null,
        cart: existingSession?.cart ?? [],
        address_recording_url: existingSession?.address_recording_url ?? null,
        address_transcript: existingSession?.address_transcript ?? null,
        payment_status: existingSession?.payment_status ?? "pending",
        metadata: { ...sessionMeta, routing_path: path },
      };
      const { error: sErr } = await adminClient
        .from("phone_call_sessions")
        .upsert(upsertPayload, { onConflict: "provider,provider_call_id" });
      if (sErr) console.error("voice-webhook routing menu upsert failed", sErr);
      return toXmlResponse(xml);
    }

    // Leaf
    const leaf = resolved.node;
    if (leaf.type === "forward") {
      const fromNumber = normalizePhone(String(body.From ?? body.from ?? ""));
      const xml = dialResponse(leaf.number, !!leaf.callerIdPassthrough, fromNumber);
      await adminClient
        .from("phone_call_sessions")
        .upsert({
          user_id: channel.user_id,
          store_channel_id: channel.id,
          provider: "signalwire",
          provider_call_id: providerCallId,
          call_status: String(body.CallStatus ?? body.call_status ?? "in_progress"),
          state: "routing_forward",
          metadata: { ...sessionMeta, routing_path: path, forward_to: leaf.number },
        }, { onConflict: "provider,provider_call_id" });
      return toXmlResponse(xml);
    }
    if (leaf.type === "play") {
      await adminClient
        .from("phone_call_sessions")
        .upsert({
          user_id: channel.user_id,
          store_channel_id: channel.id,
          provider: "signalwire",
          provider_call_id: providerCallId,
          call_status: "completed",
          state: "routing_play",
          metadata: { ...sessionMeta, routing_path: path },
        }, { onConflict: "provider,provider_call_id" });
      return toXmlResponse(sayAndHangup(leaf.message));
    }
    if (leaf.type === "voicemail") {
      const greeting = leaf.greeting?.trim() || "Please leave a message after the beep.";
      const xml = voicemailResponse(greeting, callbackUrl);
      await adminClient
        .from("phone_call_sessions")
        .upsert({
          user_id: channel.user_id,
          store_channel_id: channel.id,
          provider: "signalwire",
          provider_call_id: providerCallId,
          call_status: String(body.CallStatus ?? body.call_status ?? "in_progress"),
          state: "routing_voicemail",
          metadata: {
            ...sessionMeta,
            routing_path: path,
            vm_notify_sms: leaf.notifySms ?? null,
            vm_notify_email: leaf.notifyEmail ?? null,
          },
        }, { onConflict: "provider,provider_call_id" });
      return toXmlResponse(xml);
    }
    if (leaf.type === "extension") {
      // Look up the extension + its configured ringers and dial them all in
      // parallel. SignalWire will call us back when the dial completes —
      // sessionState "routing_extension_dial" handles that callback below.
      const { data: ext } = await adminClient
        .from("pbx_extensions")
        .select("id, name, extension_number, ring_timeout_secs, no_answer_action, forward_external_number, voicemail_enabled, email_for_voicemail, assigned_user_id")
        .eq("id", leaf.extensionId)
        .eq("user_id", channel.user_id)
        .maybeSingle();

      if (!ext) {
        return toXmlResponse(sayAndHangup("That extension is no longer available. Goodbye."));
      }

      const { data: ringers } = await adminClient
        .from("pbx_extension_ringers")
        .select("kind, target, enabled, priority")
        .eq("extension_id", ext.id)
        .eq("user_id", channel.user_id)
        .order("priority", { ascending: true });

      // Resolve webrtc ringers (target = "webrtc:<user_id>") to concrete SIP
      // URIs by looking up the per-user browser SIP credential. This makes
      // the browser softphone ring in parallel with desk phones.
      const resolvedRingers: Array<{ kind: string; target: string; enabled: boolean; priority?: number | null }> = [];
      for (const r of (ringers || [])) {
        if (r.kind === "webrtc" && typeof r.target === "string" && r.target.startsWith("webrtc:")) {
          const targetUserId = r.target.slice("webrtc:".length);
          const { data: ep } = await adminClient
            .from("pbx_webrtc_endpoints")
            .select("sip_username, sip_domain, enabled")
            .eq("user_id", targetUserId)
            .maybeSingle();
          if (ep && ep.enabled && ep.sip_username && ep.sip_domain) {
            resolvedRingers.push({
              kind: "sip",
              target: `sip:${ep.sip_username}@${ep.sip_domain}`,
              enabled: r.enabled,
              priority: r.priority,
            });
          }
          continue;
        }
        resolvedRingers.push(r);
      }

      console.log("voice-webhook extension dial", {
        extensionId: ext.id,
        extensionNumber: ext.extension_number,
        ringerCount: resolvedRingers.length,
        ringers: resolvedRingers.map((r) => ({ kind: r.kind, target: r.target, enabled: r.enabled })),
      });

      const fromNumber = normalizePhone(String(body.From ?? body.from ?? ""));
      // For outbound PSTN dialing SignalWire requires a callerId that is owned
      // (or verified) on the account AND in E.164 format. The caller's own
      // number isn't owned, so using it silently kills the <Number> leg while
      // <Sip> succeeds. Use the store's DID instead — and force E.164: the
      // raw column value sometimes lacks the `+1` and that alone causes the
      // PSTN child to fail before it ever rings.
      const callerIdForDial =
        normalizePhone(String(channel.inbound_phone_e164 || "")) || fromNumber || null;
      const tiers = buildRingerTiers(resolvedRingers);
      const ringTimeout = Number(ext.ring_timeout_secs) || 25;
      const xml = extensionDialResponseForTier(tiers[0] || null, {
        timeout: ringTimeout,
        actionUrl: callbackUrl,
        callerId: callerIdForDial,
      });

      await adminClient
        .from("phone_call_sessions")
        .upsert({
          user_id: channel.user_id,
          store_channel_id: channel.id,
          provider: "signalwire",
          provider_call_id: providerCallId,
          call_status: String(body.CallStatus ?? body.call_status ?? "in_progress"),
          state: "routing_extension_dial",
          metadata: {
            ...sessionMeta,
            routing_path: path,
            extension_id: ext.id,
            extension_number: ext.extension_number,
            no_answer_action: ext.no_answer_action || "voicemail",
            forward_external_number: ext.forward_external_number || null,
            voicemail_enabled: ext.voicemail_enabled !== false,
            email_for_voicemail: ext.email_for_voicemail || null,
            assigned_user_id: ext.assigned_user_id || null,
            ring_timeout_secs: ringTimeout,
            caller_id_for_dial: callerIdForDial,
            // Remaining tiers to ring after this one finishes with no answer.
            pending_ringer_tiers: tiers.slice(1),
          },
        }, { onConflict: "provider,provider_call_id" });

      // Fire a screen-pop event for the assigned user (Step 5). Frontend
      // subscribes to pbx_ring_events via Realtime and shows the popup.
      // Best-effort — never block the dial if this fails.
      try {
        const { data: existingSessionForRing } = await adminClient
          .from("phone_call_sessions")
          .select("id")
          .eq("provider", "signalwire")
          .eq("provider_call_id", providerCallId)
          .maybeSingle();
        await adminClient.from("pbx_ring_events").insert({
          user_id: channel.user_id,
          assigned_user_id: ext.assigned_user_id || null,
          event_type: "ring_start",
          call_session_id: existingSessionForRing?.id ?? null,
          channel_id: channel.id,
          extension_id: ext.id,
          extension_number: String(ext.extension_number ?? ""),
          from_number: fromNumber || null,
          caller_name: String(body.CallerName ?? body.caller_name ?? "") || null,
          ring_timeout_secs: ringTimeout,
          metadata: {
            channel_label: channel.label || null,
            extension_name: ext.name || null,
          },
        });
      } catch (ringErr) {
        console.warn("voice-webhook ring_start broadcast failed", ringErr);
      }

      return toXmlResponse(xml);
    }
    if (leaf.type === "flow") {
      // Voice ordering must be enabled on this channel for flows to run.
      if (!channel.voice_ordering_enabled) {
        return errorXml("This store is not enabled for phone ordering.");
      }
      selectedFlowId = leaf.flowId ?? null;
      routingMeta = { ...sessionMeta, routing_path: path, flow_id: selectedFlowId };
    } else {
      // Unknown leaf type — fail safe.
      return errorXml("This number is not configured correctly.");
    }
  }

  // Make the routing decision visible to the flow runner & the upsert below.
  const baseMetadata: JsonMap = routingMeta;

  const flowQuery = adminClient
    .from("ivr_flow_configs")
    .select("flow, id");
  const { data: flowConfig } = selectedFlowId
    ? await flowQuery.eq("id", selectedFlowId).eq("user_id", channel.user_id).maybeSingle()
    : await flowQuery
        .eq("user_id", channel.user_id)
        .eq("is_primary", true)
        .eq("is_active", true)
        .eq("published", true)
        .maybeSingle();

  const voiceSettings = (
    flowConfig?.flow && typeof flowConfig.flow === "object"
      ? ((flowConfig.flow as JsonMap).voice_settings ?? {})
      : {}
  ) as Record<string, unknown>;

  const { data: defaultTemplate } = await adminClient
    .from("ivr_flow_templates")
    .select("flow")
    .eq("name", "default-voice-v1")
    .maybeSingle();

  const activeFlow = (flowConfig?.flow as JsonMap | undefined) ?? (defaultTemplate?.flow as JsonMap | undefined);
  const legacyPrompts = getPrompts(
    flowConfig?.flow as JsonMap | undefined,
    defaultTemplate?.flow as JsonMap | undefined,
  );

  const existingMetadata =
    existingSession?.metadata && typeof existingSession.metadata === "object"
      ? { ...(existingSession.metadata as JsonMap), ...baseMetadata }
      : baseMetadata;

  let runtimeResult:
    | {
        xml: string;
        nextState: string;
        nextMetadata: JsonMap;
        cart: Array<Record<string, unknown>>;
        addressRecordingUrl: string | null;
        addressTranscript: string | null;
        paymentStatus?: string;
      }
    | {
        xml: string;
        nextNodeId: string;
        nextMetadata: JsonMap;
        state: string;
        cart: Array<Record<string, unknown>>;
        addressRecordingUrl: string | null;
        addressTranscript: string | null;
        paymentStatus?: string;
      };

  if (isGraphFlow(activeFlow)) {
    const callerPhone = normalizePhone(String(body.From ?? body.from ?? ""));
    runtimeResult = await handleGraphFlow(adminClient, channel.user_id, activeFlow, existingSession, existingMetadata, body, callbackUrl, providerCallId, callerPhone, voiceSettings);
  } else {
    runtimeResult = handleLegacyFlow(legacyPrompts, existingSession, body, callbackUrl);
  }

  const upsertPayload = {
    user_id: channel.user_id,
    store_channel_id: channel.id,
    provider: "signalwire",
    provider_call_id: providerCallId,
    call_status: String(body.CallStatus ?? body.call_status ?? "in_progress"),
    state: "nextState" in runtimeResult ? runtimeResult.nextState : runtimeResult.state,
    last_digits: String(body.Digits ?? body.digits ?? "").trim() || null,
    cart: runtimeResult.cart,
    address_recording_url: runtimeResult.addressRecordingUrl,
    address_transcript: runtimeResult.addressTranscript,
    payment_status: runtimeResult.paymentStatus ?? existingSession?.payment_status ?? "pending",
    metadata: { ...runtimeResult.nextMetadata, flow_id: selectedFlowId ?? (runtimeResult.nextMetadata as JsonMap).flow_id ?? null },
  };

  const { error: sessionError } = await adminClient
    .from("phone_call_sessions")
    .upsert(upsertPayload, { onConflict: "provider,provider_call_id" });

  if (sessionError) {
    console.error("voice-webhook session upsert failed", sessionError);
    return errorXml("We hit a temporary issue saving this call. Please try again.");
  }

  return toXmlResponse(runtimeResult.xml);
});
