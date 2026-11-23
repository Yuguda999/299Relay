"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Chip, Empty, Loading, Pill } from "@/components/ui";
import { usePlaceName, useLoad } from "@/lib/admin";
import { dayTime, JOB_STATUS_LABEL, naira, TYPE_LABEL } from "@/lib/format";
import { supabase, type Enums } from "@/lib/supabase/client";

const FILTERS: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "disputed", label: "Disputed" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];
const ACTIVE: Enums<"job_status">[] = ["accepted", "purchased", "in_transit"];

export default function JobsPage() {
  return <Suspense fallback={<Loading />}><Jobs /></Suspense>;
}

function Jobs() {
  const params = useSearchParams();
  const [filter, setFilter] = useState(params.get("filter") ?? "active");
  const place = usePlaceName();

  const q = useLoad(async () => {
    let query = supabase().from("jobs")
      .select("*, request:requests(*), requester:profiles!jobs_requester_id_fkey(full_name), traveler:profiles!jobs_traveler_id_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(200);
    if (filter === "active" || filter === "overdue") query = query.in("status", ACTIVE);
    if (filter === "disputed") query = query.eq("status", "disputed");
    if (filter === "completed") query = query.eq("status", "completed");
    const { data } = await query;
    let rows = data ?? [];
    const now = Date.now();
    if (filter === "overdue") rows = rows.filter((j) => new Date(j.request!.deadline).getTime() < now - 2 * 36e5);
    return { rows, now };
  }, [filter]);

  return (
    <>
      <PageTitle title="Jobs" sub="Newest first, up to 200." />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => <Chip key={f.value} on={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>)}
      </div>
      {q.loading ? <Loading /> : q.data?.rows.length ? (
        <Table head={["Job", "Type", "Route", "Deadline", "Requester → traveler", "Fee", "Status"]}>
          {q.data.rows.map((j) => {
            const r = j.request!;
            const late = ACTIVE.includes(j.status) && new Date(r.deadline).getTime() < q.data!.now;
            return (
              <tr key={j.id} className="hover:bg-bg">
                <td className="max-w-64 px-4 py-3"><Link href={`/jobs/${j.id}`} className="line-clamp-1 font-semibold text-navy">{r.items_text}</Link></td>
                <td className="px-4 py-3">{TYPE_LABEL[r.type]}</td>
                <td className="px-4 py-3 whitespace-nowrap">{place(r.from_place_id)} → {place(r.handoff_place_id)}</td>
                <td className={`px-4 py-3 whitespace-nowrap ${late ? "font-semibold text-danger" : ""}`}>{dayTime(r.deadline)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{j.requester?.full_name} → {j.traveler?.full_name}</td>
                <td className="px-4 py-3">{naira(r.fee)}</td>
                <td className="px-4 py-3"><Pill tone={j.status === "completed" ? "success" : j.status === "disputed" ? "danger" : "soft"}>{JOB_STATUS_LABEL[j.status]}</Pill></td>
              </tr>
            );
          })}
        </Table>
      ) : <Empty title="No jobs match" />}
    </>
  );
}
