"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { EmptyState, Loading, PillTabs, StatusChip } from "@/components/ui";
import { useLoad } from "@/lib/admin";
import { ago, naira } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

const REASON: Record<string, string> = {
  no_show: "No-show", wrong_item: "Wrong item", damaged_item: "Damaged item", overcharged: "Overcharged",
  safety: "Safety", other: "Other", code_lockout: "Code lockout",
};

export default function Disputes() {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const q = useLoad(async () => {
    const { data } = await supabase().from("disputes")
      .select("*, job:jobs(id, status, request:requests(items_text, fee, item_budget, type))")
      .eq("status", tab).order("created_at", { ascending: tab === "open" }).limit(100);
    return { rows: data ?? [], now: Date.now() };
  }, [tab]);

  return (
    <>
      <PageTitle title="Disputes" sub="Aim to resolve within 24 hours. Escrow stays frozen until you decide."
        right={<PillTabs aria-label="Status" fill={false} value={tab} onChange={setTab} options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }]} />} />
      {q.loading || !q.data ? <Loading /> : q.data.rows.length ? (
        <Table head={["Opened", "Reason", "Job", "Value", tab === "open" ? "Waiting" : "Outcome"]}>
          {q.data.rows.map((d) => {
            const r = d.job?.request;
            const hours = Math.floor((q.data!.now - new Date(d.created_at).getTime()) / 36e5);
            return (
              <tr key={d.id}>
                <td className="font-mono text-[12px] text-ink-2">{ago(d.created_at)}</td>
                <td><StatusChip tone={d.reason === "safety" ? "critical" : "warn"}>{REASON[d.reason] ?? d.reason}</StatusChip></td>
                <td className="max-w-80"><Link href={`/jobs/${d.job_id}`} className="line-clamp-1 font-semibold text-foreground underline-offset-2 hover:underline">{r?.items_text}</Link></td>
                <td className="tabular">{r ? naira(r.fee + r.item_budget) : ""}</td>
                <td>{tab === "open"
                  ? <StatusChip tone={hours >= 24 ? "critical" : "idle"}>{hours}h</StatusChip>
                  : <StatusChip tone="ok">{d.resolution}</StatusChip>}</td>
              </tr>
            );
          })}
        </Table>
      ) : <EmptyState title={tab === "open" ? "No open disputes" : "No resolved disputes yet"} body={tab === "open" ? "Nothing is waiting on you." : undefined} />}
    </>
  );
}
