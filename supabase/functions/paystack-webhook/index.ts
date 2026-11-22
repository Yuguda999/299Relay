// Paystack webhook: the only path that credits wallets or settles payouts.
// Signature checked; every handler is idempotent (unique Paystack reference).
// Configure in Paystack dashboard → Settings → API Keys & Webhooks.
import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { verifySignature } from "../_shared/paystack.ts";

type Event = {
  event: string;
  data: {
    reference: string;
    amount: number;
    channel?: string;
    status?: string;
    transfer_code?: string;
    reason?: string;
    gateway_response?: string;
    metadata?: { profile_id?: string } | string | null;
    customer?: { customer_code?: string };
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("x-paystack-signature")))) {
    return json({ error: "invalid_signature" }, 401);
  }

  let evt: Event;
  try {
    evt = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const db = adminClient();
  const d = evt.data;

  switch (evt.event) {
    case "charge.success": {
      const profileId = await resolveProfile(db, d);
      if (!profileId) {
        console.error("charge.success with no profile", d.reference);
        return json({ ok: true, ignored: "unknown_customer" }); // 200 so Paystack stops retrying; alert via logs
      }
      const { error } = await db.rpc("svc_confirm_payment", {
        p_reference: d.reference,
        p_profile: profileId,
        p_amount: d.amount,
        p_method: d.channel ?? "unknown",
        p_raw: evt,
      });
      if (error) return retry("svc_confirm_payment", error);
      break;
    }
    case "charge.failed": {
      await db.rpc("svc_fail_payment", { p_reference: d.reference, p_raw: evt });
      break;
    }
    case "transfer.success":
    case "transfer.failed":
    case "transfer.reversed": {
      const { error } = await db.rpc("svc_settle_payout", {
        p_reference: d.reference,
        p_success: evt.event === "transfer.success",
        p_transfer_code: d.transfer_code ?? null,
        p_reason: d.reason ?? d.gateway_response ?? evt.event,
      });
      if (error && error.message !== "payout_not_found") return retry("svc_settle_payout", error);
      break;
    }
    default:
      break;
  }
  return json({ ok: true });
});

async function resolveProfile(db: ReturnType<typeof adminClient>, d: Event["data"]): Promise<string | null> {
  const meta = typeof d.metadata === "string" ? safeParse(d.metadata) : d.metadata;
  if (meta?.profile_id) return meta.profile_id;
  // Bank transfer into a dedicated virtual account: map by customer code.
  if (d.customer?.customer_code) {
    const { data } = await db.rpc("svc_profile_for_customer", { p_customer_code: d.customer.customer_code });
    return (data as string | null) ?? null;
  }
  return null;
}

function safeParse(s: string): { profile_id?: string } | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Non-2xx makes Paystack retry later.
function retry(what: string, error: { message: string }) {
  console.error(what, "failed", error.message);
  return json({ error: "retry" }, 500);
}
