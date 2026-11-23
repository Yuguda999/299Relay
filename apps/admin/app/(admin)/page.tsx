"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Card, Loading, Notice, Segmented, cx } from "@/components/ui";
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

  if (q.loading || !q.data) return <Loading />;
  const { m, h } = q.data;

  const queues = [
    { href: "/verifications", label: "ID checks waiting", n: m.pending_verifications },
    { href: "/disputes", label: "Open disputes", n: m.open_disputes },
    { href: "/review", label: "Flagged requests", n: m.requests_in_review },
    { href: "/jobs?filter=overdue", label: "Jobs 2h+ overdue", n: m.overdue_jobs },
  ];

  return (
    <>
      <PageTitle title="Overview" sub="ABU Zaria pilot" right={
        <div className="w-56"><Segmented value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} /></div>
      } />
      {(h.problems.length > 0 || h.stuck_payouts > 0) && (
        <Notice tone="amber" action={<Link href="/money" className="font-semibold text-navy">Open money</Link>}>
          {h.problems.length > 0 && `Ledger check found ${h.problems.length} problem(s). `}
          {h.stuck_payouts > 0 && `${h.stuck_payouts} payout(s) pending for over an hour.`}
        </Notice>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {queues.map((x) => (
          <Link key={x.href} href={x.href} className="no-underline">
            <Card className={cx("flex flex-col gap-1", x.n ? "border-orange" : "")}>
              <span className="text-[13px] text-muted">{x.label}</span>
              <span className={cx("font-display text-[30px] font-bold", x.n ? "text-ink" : "text-muted")}>{x.n ?? 0}</span>
            </Card>
          </Link>
        ))}
      </section>

      <h2 className="text-[16px] font-bold">Pilot metrics · last {days} days</h2>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Match rate (accepted ≤ 30 min)" value={pct(m.match_rate)} target={`≥ ${pct(TARGETS.match_rate)}`} ok={ok(m.match_rate, TARGETS.match_rate, "min")} />
        <Metric label="Completion rate" value={pct(m.completion_rate)} target={`≥ ${pct(TARGETS.completion_rate)}`} ok={ok(m.completion_rate, TARGETS.completion_rate, "min")} />
        <Metric label="Dispute rate" value={pct(m.dispute_rate)} target={`≤ ${pct(TARGETS.dispute_rate)}`} ok={ok(m.dispute_rate, TARGETS.dispute_rate, "max")} />
        <Metric label="Repeat requesters (30 days)" value={pct(m.repeat_requester_rate)} target={`≥ ${pct(TARGETS.repeat_requester_rate)}`} ok={ok(m.repeat_requester_rate, TARGETS.repeat_requester_rate, "min")} />
        <Metric label="Verified students" value={String(m.verified_users ?? 0)} target="1,000 by week 8" />
        <Metric label="Active travelers (7 days)" value={String(m.active_travelers ?? 0)} target="100" />
        <Metric label="Completed jobs" value={String(m.completed_jobs ?? 0)} target="500 a week by week 8" />
        <Metric label="Delivery fees on completed jobs" value={naira(m.gmv_fees)} target={`Revenue to date ${naira(m.platform_revenue_total)}`} />
      </section>
      <p className="text-[12.5px] text-muted">Requests posted: {m.requests_posted ?? 0} · jobs accepted: {m.jobs_accepted ?? 0}. Targets are first estimates from the PRD.</p>
    </>
  );
}

function ok(v: number | null | undefined, t: number, dir: "min" | "max") {
  if (v == null) return undefined;
  return dir === "min" ? v >= t : v <= t;
}

function Metric({ label, value, target, ok }: { label: string; value: string; target: string; ok?: boolean }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={cx("font-display text-[26px] font-bold", ok === false && "text-danger", ok === true && "text-success")}>{value}</span>
      <span className="text-[12px] text-muted">Target {target}</span>
    </Card>
  );
}
