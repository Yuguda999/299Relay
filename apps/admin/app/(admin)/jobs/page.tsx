"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { ChoiceChips, EmptyState, Loading, SearchInput, StatusChip, type ChipTone } from "@/components/ui";
import { usePlaceName, useLoad } from "@/lib/admin";
import { dayTime, JOB_STATUS_LABEL, naira, TYPE_LABEL } from "@/lib/format";
import { supabase, type Enums } from "@/lib/supabase/client";

const FILTERS = [
  { value: "active", label: "Active" }, { value: "overdue", label: "Overdue" }, { value: "disputed", label: "Disputed" },
  { value: "completed", label: "Completed" }, { value: "all", label: "All" },
];
const ACTIVE: Enums<"job_status">[] = ["accepted", "purchased", "in_transit"];
const TONE: Record<string, ChipTone> = { completed: "ok", disputed: "critical", accepted: "live", purchased: "live", in_transit: "live" };

export default function JobsPage() {
  return <Suspense fallback={<Loading />}><Jobs /></Suspense>;
}

function Jobs() {
  const params = useSearchParams();
  const [filter, setFilter] = useState(params.get("filter") ?? "active");
  const [search, setSearch] = useState("");
  const place = usePlaceName();

  const q = useLoad(async () => {
    let query = supabase().from("jobs")
      .select("*, request:requests(*), requester:profiles!jobs_requester_id_fkey(full_name), traveler:profiles!jobs_traveler_id_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(200);
    if (filter === "active" || filter === "overdue") query = query.in("status", ACTIVE);
    if (filter === "disputed") query = query.eq("status", "disputed");
    if (filter === "completed") query = query.eq("status", "completed");
    const { data } = await query;
    const now = Date.now();
    let rows = data ?? [];
    if (filter === "overdue") rows = rows.filter((j) => new Date(j.request!.deadline).getTime() < now - 2 * 36e5);
    return { rows, now };
  }, [filter]);

  const s = search.trim().toLowerCase();
  const rows = (q.data?.rows ?? []).filter((j) => !s || [j.request?.items_text, j.requester?.full_name, j.traveler?.full_name].some((x) => x?.toLowerCase().includes(s)));

  return (
    <>
      <PageTitle title="Jobs" sub="Newest first, up to 200." />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ChoiceChips aria-label="Filter" value={filter} onChange={setFilter} options={FILTERS} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search items or names" shortcut className="md:w-80" />
      </div>
      {q.loading || !q.data ? <Loading /> : rows.length ? (
        <Table head={["Job", "Type", "Route", "Deadline", "Requester → traveler", "Fee", "Status"]} minWidth={900}>
          {rows.map((j) => {
            const r = j.request!;
            const late = ACTIVE.includes(j.status) && new Date(r.deadline).getTime() < q.data!.now;
            return (
              <tr key={j.id}>
                <td className="max-w-64"><Link href={`/jobs/${j.id}`} className="line-clamp-1 font-semibold text-foreground underline-offset-2 hover:underline">{r.items_text}</Link></td>
                <td>{TYPE_LABEL[r.type]}</td>
                <td className="whitespace-nowrap text-ink-2">{place(r.from_place_id)} → {place(r.handoff_place_id)}</td>
                <td className={`whitespace-nowrap tabular ${late ? "font-semibold text-critical" : ""}`}>{dayTime(r.deadline)}</td>
                <td className="whitespace-nowrap">{j.requester?.full_name} → {j.traveler?.full_name}</td>
                <td className="tabular">{naira(r.fee)}</td>
                <td><StatusChip tone={TONE[j.status] ?? "muted"}>{JOB_STATUS_LABEL[j.status]}</StatusChip></td>
              </tr>
            );
          })}
        </Table>
      ) : <EmptyState title="No jobs match" />}
    </>
  );
}
