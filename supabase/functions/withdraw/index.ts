// Withdraw to the student's saved bank account.
//   POST { amount }   (naira)
// 1. request_withdrawal (as the caller) moves money to payouts_in_transit.
// 2. Paystack transfer is started; paystack-webhook settles success/failure.
// 3. If Paystack refuses outright, the payout is reversed here.
import { AppError, fromPg, handler, json, readJson, toKobo } from "../_shared/http.ts";
import { adminClient, requireCaller } from "../_shared/supabase.ts";
import { paystack } from "../_shared/paystack.ts";

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new AppError("method_not_allowed", 405);
  const { db } = await requireCaller(req, { verified: true });
  const { amount } = await readJson<{ amount?: number | string }>(req);
  const kobo = toKobo(amount);

  const { data: payout, error } = await db.rpc("request_withdrawal", { p_amount: kobo });
  if (error) throw fromPg(error)!;
  const { reference, recipient } = payout as { reference: string; recipient: string; payout_id: string };

  try {
    const transfer = await paystack<{ transfer_code: string; status: string }>("POST", "/transfer", {
      source: "balance",
      amount: kobo,
      recipient,
      reference,
      reason: "299 RELAY wallet withdrawal",
      currency: "NGN",
    });
    if (transfer.status === "failed") {
      await adminClient().rpc("svc_settle_payout", {
        p_reference: reference, p_success: false, p_transfer_code: transfer.transfer_code, p_reason: "failed",
      });
      throw new AppError("payout_failed", 502);
    }
    return json({ reference, status: "pending" });
  } catch (e) {
    if (e instanceof AppError && e.code === "payment_provider_error") {
      await adminClient().rpc("svc_settle_payout", {
        p_reference: reference, p_success: false, p_transfer_code: null, p_reason: e.detail ?? "provider_error",
      });
      throw new AppError("payout_failed", 502, "Your money is back in your wallet.");
    }
    throw e;
  }
}));
