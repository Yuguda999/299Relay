// Payout bank account.
//   GET                                         → list of Nigerian banks
//   POST { account_number, bank_code }          → resolve name via Paystack, must match the verified name
// Full account numbers are never stored: only last four digits and Paystack's recipient code.
import { AppError, handler, json, readJson } from "../_shared/http.ts";
import { adminClient, requireCaller } from "../_shared/supabase.ts";
import { paystack } from "../_shared/paystack.ts";

type Bank = { name: string; code: string; active: boolean };

Deno.serve(handler(async (req) => {
  if (req.method === "GET") {
    await requireCaller(req);
    const banks = await paystack<Bank[]>("GET", "/bank?country=nigeria&perPage=200");
    // Paystack lists some codes twice (renames, or two banks sharing a code). Transfers
    // go by code, so show one option per code with every distinct name on it.
    const byCode = new Map<string, string[]>();
    for (const b of banks.filter((x) => x.active)) {
      const names = byCode.get(b.code) ?? [];
      if (!names.includes(b.name)) names.push(b.name);
      byCode.set(b.code, names);
    }
    const list = [...byCode].map(([code, names]) => ({ code, name: names.join(" / ") }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json({ banks: list });
  }
  if (req.method !== "POST") throw new AppError("method_not_allowed", 405);

  const { caller } = await requireCaller(req, { verified: true });
  const { account_number, bank_code } = await readJson<{ account_number?: string; bank_code?: string }>(req);
  if (!account_number || !/^\d{10}$/.test(account_number)) throw new AppError("invalid_account_number");
  if (!bank_code || !/^[0-9A-Za-z]{2,10}$/.test(bank_code)) throw new AppError("invalid_bank");

  const resolved = await paystack<{ account_name: string }>(
    "GET",
    `/bank/resolve?account_number=${account_number}&bank_code=${encodeURIComponent(bank_code)}`,
  );

  const recipient = await paystack<{ recipient_code: string; details: { bank_name: string } }>("POST", "/transferrecipient", {
    type: "nuban",
    name: resolved.account_name,
    account_number,
    bank_code,
    currency: "NGN",
    metadata: { profile_id: caller.id },
  });

  const { data, error } = await adminClient().rpc("svc_save_bank_account", {
    p_profile: caller.id,
    p_bank_code: bank_code,
    p_bank_name: recipient.details.bank_name,
    p_last4: account_number.slice(-4),
    p_resolved_name: resolved.account_name,
    p_recipient: recipient.recipient_code,
  });
  if (error) {
    throw error.code === "P0001" ? new AppError(error.message, 400, error.details) : new AppError("server_error", 500);
  }
  return json({
    bank_account: {
      id: data.id,
      bank_name: data.bank_name,
      account_last4: data.account_last4,
      resolved_name: data.resolved_name,
    },
  });
}));
