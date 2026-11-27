// Confirms a card/USSD top-up when the student returns from Paystack checkout.
//   POST { reference }
// Asks Paystack directly (GET /transaction/verify) instead of trusting the
// browser, then credits through the same idempotent path as the webhook, so a
// payment is credited once whichever arrives first. Needed locally, where
// Paystack's webhook cannot reach localhost; harmless in production.
import { AppError, handler, json, readJson } from "../_shared/http.ts";
import { adminClient, requireCaller } from "../_shared/supabase.ts";
import { paystack } from "../_shared/paystack.ts";

type Tx = {
  status: string;
  reference: string;
  amount: number;
  channel: string;
  metadata?: { profile_id?: string } | string | null;
  gateway_response?: string;
};

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new AppError("method_not_allowed", 405);
  const { caller } = await requireCaller(req);
  const { reference } = await readJson<{ reference?: string }>(req);
  if (!reference || !/^[A-Za-z0-9_-]{6,100}$/.test(reference)) throw new AppError("invalid_reference");

  // Only the student who started this payment may confirm it.
  const db = adminClient();
  const { data: payment } = await db.from("payments").select("profile_id, status").eq("paystack_reference", reference).maybeSingle();
  if (!payment || payment.profile_id !== caller.id) throw new AppError("payment_not_found", 404);
  if (payment.status === "success") return json({ status: "success", credited: false });

  const tx = await paystack<Tx>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
  const meta = typeof tx.metadata === "string" ? safeParse(tx.metadata) : tx.metadata;
  if (meta?.profile_id && meta.profile_id !== caller.id) throw new AppError("payment_not_found", 404);

  if (tx.status === "success") {
    const { error } = await db.rpc("svc_confirm_payment", {
      p_reference: reference, p_profile: caller.id, p_amount: tx.amount, p_method: tx.channel ?? "checkout", p_raw: tx,
    });
    if (error) throw new AppError("server_error", 500, error.message);
    return json({ status: "success", credited: true, amount: tx.amount });
  }
  // "abandoned" just means not paid yet (the checkout tab may still be open), so only "failed" is final.
  if (tx.status === "failed") {
    await db.rpc("svc_fail_payment", { p_reference: reference, p_raw: tx });
  }
  return json({ status: tx.status, detail: tx.gateway_response ?? null });
}));

function safeParse(s: string): { profile_id?: string } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
