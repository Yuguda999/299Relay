// Hourly housekeeping, called by pg_cron with the service-role key.
// 1. Deletes ID photos 30 days after the verification decision (NDPA: keep no longer than needed).
// 2. Re-checks payouts pending over an hour with Paystack and settles them;
//    alerts admins about any Paystack still can't settle.
import { AppError, handler, json, requireEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { paystack } from "../_shared/paystack.ts";

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new AppError("method_not_allowed", 405);
  if (req.headers.get("Authorization") !== `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`) {
    throw new AppError("forbidden", 403);
  }
  const db = adminClient();
  const report = { photos_deleted: 0, payouts_settled: 0, payouts_flagged: 0, errors: [] as string[] };

  // ── ID photos ──
  const { data: due, error: dueErr } = await db.rpc("svc_photos_due_for_deletion", { p_limit: 200 });
  if (dueErr) report.errors.push(`photos: ${dueErr.message}`);
  const rows = (due ?? []) as { id: string; selfie_path: string; id_photo_path: string }[];
  if (rows.length) {
    const paths = rows.flatMap((r) => [r.selfie_path, r.id_photo_path]);
    const { error } = await db.storage.from("id-documents").remove(paths);
    if (error) {
      report.errors.push(`storage: ${error.message}`);
    } else {
      const { data: n } = await db.rpc("svc_mark_photos_deleted", { p_ids: rows.map((r) => r.id) });
      report.photos_deleted = (n as number) ?? 0;
    }
  }

  // ── Stuck payouts ──
  const { data: stuck } = await db.rpc("svc_stuck_payouts", { p_limit: 50 });
  const canVerify = Boolean(Deno.env.get("PAYSTACK_SECRET_KEY"));
  for (const p of (stuck ?? []) as { id: string; paystack_reference: string }[]) {
    let settled = false;
    if (canVerify) {
      try {
        const t = await paystack<{ status: string; transfer_code?: string; reason?: string }>(
          "GET", `/transfer/verify/${encodeURIComponent(p.paystack_reference)}`);
        if (t.status === "success" || t.status === "failed" || t.status === "reversed") {
          const { error } = await db.rpc("svc_settle_payout", {
            p_reference: p.paystack_reference, p_success: t.status === "success",
            p_transfer_code: t.transfer_code ?? null, p_reason: t.reason ?? t.status,
          });
          settled = !error;
          if (error) report.errors.push(`settle ${p.id}: ${error.message}`);
        }
      } catch (e) {
        report.errors.push(`verify ${p.id}: ${e instanceof AppError ? e.detail ?? e.code : String(e)}`);
      }
    }
    if (settled) {
      report.payouts_settled++;
    } else {
      const { data: flagged } = await db.rpc("svc_flag_stuck_payout", { p_payout: p.id });
      if (flagged) report.payouts_flagged++;
    }
  }

  console.log("maintenance", JSON.stringify(report));
  return json(report);
}));
