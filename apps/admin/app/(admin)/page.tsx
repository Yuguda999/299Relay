"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Alert, Loading, PillTabs, cn } from "@/components/ui";
import { pct, useLoad } from "@/lib/admin";
import { naira } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

type M = Record<string, number | null>;
// PRD pilot targets (first 8 weeks).
const TARGETS = { match_rate: 0.7, completion_rate: 0.9, dispute_rate: 0.03, repeat_requester_rate: 0.4 };

export default function Overview() {
  const [days, setDays] = useState<"7" | "30">("7");
  const q = useLoad(async () => {
    const db = supabase();
    const [m, h] = await Promise.all([db.rpc("admin_metrics", { p_days: Number(days) }), db.rpc("admin_ledger_health")]);
    if (m.error) throw m.error;
    return { m: m.data as M, h: h.data as { problems: unknown[]; stuck_payouts: number } };
  }, [days]);

  const queues = q.data ? [
    { href: "/verifications", label: "ID checks waiting", n: q.data.m.pending_verifications },
    { href: "/disputes", label: "Open disputes", n: q.data.m.open_disputes },
    { href: "/review", label: "Flagged requests", n: q.data.m.requests_in_review },
    { href: "/jobs?filter=overdue", label: "Jobs 2h+ overdue", n: q.data.m.overdue_jobs },
  ] : [];

  return (
    <>
      <PageTitle title="Overview" sub="ABU Zaria pilot" right={
        <PillTabs aria-label="Period" fill={false} value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} />
      } />
      {q.loading || !q.data ? <Loading /> : (
        <>
          {(q.data.h.problems.length > 0 || q.data.h.stuck_payouts > 0) && (
            <Alert tone="critical" title="Money needs attention" action={<Link href="/money" className="text-[13px] font-semibold text-signal-ink">Open money</Link>}>
              {q.data.h.problems.length > 0 && `Ledger check found ${q.data.h.problems.length} problem(s). `}
              {q.data.h.stuck_payouts > 0 && `${q.data.h.stuck_payouts} payout(s) pending for over an hour.`}
            </Alert>
          )}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {queues.map((x, i) => (
              <Link key={x.href} href={x.href}
                className={cn("bento lift entrance flex flex-col gap-2 p-5 no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring", x.n ? "ring-1 ring-signal/40" : "")}
                style={{ "--i": i } as React.CSSProperties}>
                <span className="readout">{x.label}</span>
                <span className={cn("font-display text-kpi font-semibold tabular", x.n ? "text-foreground" : "text-ink-3")}>{x.n ?? 0}</span>
              </Link>
            ))}
          </section>

          <h2 className="readout pt-2">Pilot metrics · last {days} days</h2>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric i={0} label="Match rate (≤ 30 min)" value={pct(q.data.m.match_rate)} target={`≥ ${pct(TARGETS.match_rate)}`} ok={ok(q.data.m.match_rate, TARGETS.match_rate, "min")} />
            <Metric i={1} label="Completion rate" value={pct(q.data.m.completion_rate)} target={`≥ ${pct(TARGETS.completion_rate)}`} ok={ok(q.data.m.completion_rate, TARGETS.completion_rate, "min")} />
            <Metric i={2} label="Dispute rate" value={pct(q.data.m.dispute_rate)} target={`≤ ${pct(TARGETS.dispute_rate)}`} ok={ok(q.data.m.dispute_rate, TARGETS.dispute_rate, "max")} />
            <Metric i={3} label="Repeat requesters (30d)" value={pct(q.data.m.repeat_requester_rate)} target={`≥ ${pct(TARGETS.repeat_requester_rate)}`} ok={ok(q.data.m.repeat_requester_rate, TARGETS.repeat_requester_rate, "min")} />
            <Metric i={4} label="Verified students" value={String(q.data.m.verified_users ?? 0)} target="1,000 by week 8" />
            <Metric i={5} label="Active travelers (7d)" value={String(q.data.m.active_travelers ?? 0)} target="100" />
            <Metric i={6} label="Completed jobs" value={String(q.data.m.completed_jobs ?? 0)} target="500 a week by week 8" />
            <Metric i={7} label="Fees on completed jobs" value={naira(q.data.m.gmv_fees)} target={`Revenue to date ${naira(q.data.m.platform_revenue_total)}`} />
          </section>
          <p className="text-[12.5px] text-ink-2">Requests posted <span className="tabular">{q.data.m.requests_posted ?? 0}</span> · jobs accepted <span className="tabular">{q.data.m.jobs_accepted ?? 0}</span>. Targets are first estimates from the PRD.</p>
        </>
      )}
    </>
  );
}

function ok(v: number | null | undefined, t: number, dir: "min" | "max") {
  if (v == null) return undefined;
  return dir === "min" ? v >= t : v <= t;
}

function Metric({ label, value, target, ok, i }: { label: string; value: string; target: string; ok?: boolean; i: number }) {
  return (
    <div className="bento entrance flex flex-col gap-2 p-5" style={{ "--i": i + 4 } as React.CSSProperties}>
      <span className="readout">{label}</span>
      <span className="font-display text-kpi-sm font-semibold tabular">{value}</span>
      <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
        {ok !== undefined && <span aria-hidden className={cn("size-1.5 rounded-full", ok ? "bg-ok" : "bg-critical")} />}
        <span className="sr-only">{ok === undefined ? "" : ok ? "On target." : "Below target."}</span>
        Target {target}
      </span>
    </div>
  );
}
