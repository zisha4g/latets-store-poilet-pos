export const jsonHeaders = {
  "Content-Type": "application/json",
};

export const phoneDigitsOnly = (value: string | null | undefined) => {
  if (!value) return "";
  return value.replace(/\D/g, "");
};

export const canonicalStorePhone = (value: string | null | undefined) => {
  const digits = phoneDigitsOnly(value);
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
};

export const phoneLookupCandidates = (value: string | null | undefined) => {
  const digits = phoneDigitsOnly(value);
  if (!digits) return [];

  const tenDigit = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const candidates = new Set<string>();

  if (tenDigit.length === 10) {
    candidates.add(tenDigit);
    candidates.add(`1${tenDigit}`);
    candidates.add(`+1${tenDigit}`);
  } else {
    candidates.add(digits);
    candidates.add(`+${digits}`);
  }

  return Array.from(candidates);
};

export const normalizePhone = (value: string | null | undefined) => {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

export const parseWebhookBody = async (req: Request): Promise<Record<string, unknown>> => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const body: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      body[key] = value;
    }
    return body;
  }

  return {};
};

export const toXmlResponse = (xml: string) =>
  new Response(xml, {
    headers: {
      "Content-Type": "text/xml",
    },
  });

const enc = new TextEncoder();

const hexToBytes = (hex: string): Uint8Array => {
  const cleanHex = hex.trim().replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex length");
  }

  const out = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    out[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return out;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const verifySha256Hmac = async (
  payload: string,
  secret: string,
  providedSignature: string | null,
): Promise<boolean> => {
  if (!providedSignature || !secret) return false;

  const sig = providedSignature.trim().toLowerCase();
  const sigHex = sig.startsWith("sha256=") ? sig.slice(7) : sig;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const computed = bytesToHex(new Uint8Array(digest));

  let providedBytes: Uint8Array;
  let computedBytes: Uint8Array;
  try {
    providedBytes = hexToBytes(sigHex);
    computedBytes = hexToBytes(computed);
  } catch {
    return false;
  }

  if (providedBytes.length !== computedBytes.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < providedBytes.length; i += 1) {
    mismatch |= providedBytes[i] ^ computedBytes[i];
  }

  return mismatch === 0;
};
