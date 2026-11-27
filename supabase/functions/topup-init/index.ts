// Start a wallet top-up.
//   POST { method: "transfer" }            → the student's dedicated bank account (created once)
//   POST { method: "card", amount: 5000 }  → Paystack checkout URL (card, USSD, bank)
// Money is credited only after Paystack confirms it (paystack-webhook or topup-verify), never here.
import { AppError, handler, json, readJson, toKobo } from "../_shared/http.ts";
import { adminClient, requireCaller } from "../_shared/supabase.ts";
import { paystack, paystackEmail } from "../_shared/paystack.ts";

type Body = { method?: "transfer" | "card"; amount?: number | string };

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new AppError("method_not_allowed", 405);
  const { caller } = await requireCaller(req, { verified: true });
  const body = await readJson<Body>(req);
  const admin = adminClient();

  if (body.method === "transfer") {
    const { data: existing } = await admin.from("paystack_customers").select("*").eq("profile_id", caller.id).maybeSingle();
    if (existing?.account_number) {
      return json({ method: "transfer", account: pick(existing) });
    }

    const [first, ...rest] = caller.full_name.trim().split(/\s+/);
    const customer = existing?.customer_code
      ? { customer_code: existing.customer_code as string }
      : await paystack<{ customer_code: string }>("POST", "/customer", {
        email: paystackEmail(caller.email, caller.id),
        first_name: first,
        last_name: rest.join(" ") || first,
        metadata: { profile_id: caller.id },
      });

    const dva = await paystack<{ account_number: string; account_name: string; bank: { name: string } }>(
      "POST",
      "/dedicated_account",
      { customer: customer.customer_code, preferred_bank: Deno.env.get("PAYSTACK_DVA_BANK") ?? "wema-bank" },
    ).catch((e) => {
      // Paystack enables dedicated accounts per business on request.
      if (e instanceof AppError && /not available for your business/i.test(e.detail ?? "")) throw new AppError("dva_unavailable", 400);
      throw e;
    });

    const { data: saved, error } = await admin.rpc("svc_save_paystack_customer", {
      p_profile: caller.id,
      p_customer_code: customer.customer_code,
      p_account_number: dva.account_number,
      p_account_name: dva.account_name,
      p_bank_name: dva.bank.name,
    });
    if (error) throw new AppError("server_error", 500, error.message);
    return json({ method: "transfer", account: pick(saved) });
  }

  if (body.method === "card") {
    const amount = toKobo(body.amount);
    const reference = `tp_${crypto.randomUUID().replaceAll("-", "")}`;

    const { error } = await admin.rpc("svc_create_payment", {
      p_profile: caller.id,
      p_amount: amount,
      p_method: "checkout",
      p_reference: reference,
    });
    if (error) throw new AppError(error.code === "P0001" ? error.message : "server_error", error.code === "P0001" ? 400 : 500);

    const tx = await paystack<{ authorization_url: string; reference: string }>("POST", "/transaction/initialize", {
      email: paystackEmail(caller.email, caller.id),
      amount,
      currency: "NGN",
      reference,
      channels: ["card", "ussd", "bank", "bank_transfer"],
      callback_url: `${Deno.env.get("APP_URL") ?? "http://localhost:3000"}/wallet?topup=${reference}`,
      metadata: { profile_id: caller.id },
    });
    return json({ method: "card", reference, authorization_url: tx.authorization_url });
  }

  throw new AppError("invalid_method");
}));

function pick(row: Record<string, unknown>) {
  return { account_number: row.account_number, account_name: row.account_name, bank_name: row.bank_name };
}
