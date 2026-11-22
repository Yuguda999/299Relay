// Minimal Paystack client. Docs: https://paystack.com/docs/api/
import { AppError, requireEnv } from "./http.ts";

const BASE = "https://api.paystack.co";

type PaystackResponse<T> = { status: boolean; message: string; data: T };

export async function paystack<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv("PAYSTACK_SECRET_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload: PaystackResponse<T> | null = null;
  try {
    payload = await res.json();
  } catch {
    // fall through
  }
  if (!res.ok || !payload?.status) {
    console.error("paystack error", method, path, res.status, payload?.message);
    throw new AppError("payment_provider_error", 502, payload?.message ?? `HTTP ${res.status}`);
  }
  return payload.data;
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("PAYSTACK_SECRET_KEY")),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, signature.toLowerCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
