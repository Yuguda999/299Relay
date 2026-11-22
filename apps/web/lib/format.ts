// Display helpers. Money is kobo everywhere; times are shown in Lagos time.
export const TZ = "Africa/Lagos";

export function naira(kobo: number | null | undefined): string {
  const n = (kobo ?? 0) / 100;
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** Naira typed by a user → kobo, or null if not a valid positive amount. */
export function toKobo(input: string): number | null {
  const n = Number(input.replace(/[₦,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function time(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: TZ }).replace(" ", "").toLowerCase();
}

export function dayTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const today = day(new Date());
  const tomorrow = day(new Date(Date.now() + 864e5));
  const label = day(d) === today ? "" : day(d) === tomorrow ? "tomorrow " : d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }) + " ";
  return label + time(iso);
}

export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: TZ });
}

/**
 * A Lagos wall-clock time on today/tomorrow → ISO instant.
 * Lagos is UTC+1 all year (no DST).
 */
export function lagosToIso(dayOffset: 0 | 1, hhmm: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const base = new Date(`${today}T${hhmm}:00+01:00`);
  return new Date(base.getTime() + dayOffset * 864e5).toISOString();
}

export function initials(name: string | null | undefined): string {
  return (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export const TYPE_LABEL = { buy: "Buy", pick_up: "Pick up", drop_off: "Drop off" } as const;

export const JOB_STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  purchased: "Bought",
  in_transit: "On the way",
  completed: "Delivered",
  disputed: "Issue reported",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const LEDGER_REASON: Record<string, string> = {
  topup: "Wallet top-up",
  request_hold: "Held for request",
  request_cancelled: "Request cancelled · refund",
  request_expired: "Request expired · refund",
  request_rejected: "Request not allowed · refund",
  purchase_advance: "Purchase advance",
  advance_reversed: "Advance returned",
  advance_returned: "Advance returned",
  unused_budget: "Unused budget",
  substitute_topup: "Price change approved",
  delivery_fee: "Delivery fee earned",
  escrow_remainder: "Held money returned",
  job_cancelled: "Job cancelled · refund",
  tip: "Tip",
  dispute_refund: "Issue resolved · refund",
  dispute_release: "Issue resolved · payment",
  dispute_clawback: "Issue resolved · adjustment",
  payout: "Withdrawal to bank",
  payout_reversed: "Withdrawal returned",
};
