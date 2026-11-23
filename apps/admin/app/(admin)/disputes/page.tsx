"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Empty, Loading, Pill, Segmented } from "@/components/ui";
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
      .eq("status", tab).order("created_at", { ascending: tab === "resolved" ? false : true }).limit(100);
    return { rows: data ?? [], now: Date.now() };
  }, [tab]);

  return (
    <>
      <PageTitle title="Disputes" sub="Aim to resolve within 24 hours. Escrow stays frozen until you decide." right={
        <div className="w-60"><Segmented value={tab} onChange={setTab} options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }]} /></div>
      } />
      {q.loading ? <Loading /> : q.data?.rows.length ? (
        <Table head={["Opened", "Reason", "Job", "Value", tab === "open" ? "Waiting" : "Outcome"]}>
          {q.data.rows.map((d) => {
            const r = d.job?.request;
            const hours = (q.data!.now - new Date(d.created_at).getTime()) / 36e5;
            return (
              <tr key={d.id} className="hover:bg-bg">
                <td className="px-4 py-3">{ago(d.created_at)}</td>
                <td className="px-4 py-3"><Pill tone={d.reason === "safety" ? "danger" : "amber"}>{REASON[d.reason] ?? d.reason}</Pill></td>
                <td className="max-w-80 px-4 py-3"><Link href={`/jobs/${d.job_id}`} className="line-clamp-1 font-semibold text-navy">{r?.items_text}</Link></td>
                <td className="px-4 py-3">{r ? naira(r.fee + r.item_budget) : ""}</td>
                <td className="px-4 py-3">
                  {tab === "open"
                    ? <Pill tone={hours > 24 ? "danger" : "muted"}>{Math.floor(hours)}h</Pill>
                    : <Pill tone="success">{d.resolution}</Pill>}
                </td>
              </tr>
            );
          })}
        </Table>
      ) : <Empty title={tab === "open" ? "No open disputes" : "No resolved disputes yet"} />}
    </>
  );
}
