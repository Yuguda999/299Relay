"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Avatar, ChoiceChips, EmptyState, Loading, SearchInput, StatusChip } from "@/components/ui";
import { useLoad } from "@/lib/admin";
import { ago } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

type Status = "all" | "pending" | "verified" | "suspended";

export default function Users() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const q = useLoad(async () => {
    let query = supabase().from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (status !== "all") query = query.eq("status", status);
    const s = search.trim().replace(/[%,()]/g, "");
    if (s) query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`);
    return (await query).data ?? [];
  }, [search, status]);

  return (
    <>
      <PageTitle title="Students" />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ChoiceChips aria-label="Status" value={status} onChange={setStatus}
          options={(["all", "pending", "verified", "suspended"] as const).map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email" shortcut className="md:w-80" />
      </div>
      {q.loading ? <Loading /> : q.data?.length ? (
        <Table head={["Student", "Hostel", "Status", "Rating", "Delivered / requested", "Strikes", "Joined"]} minWidth={860}>
          {q.data.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/users/${p.id}`} className="flex items-center gap-3 no-underline">
                  <Avatar name={p.full_name} size={34} />
                  <span className="flex flex-col">
                    <span className="font-semibold text-foreground">{p.full_name}{p.role === "admin" && <span className="ml-1.5 font-mono text-[10px] text-signal-ink">ADMIN</span>}</span>
                    <span className="text-[12px] text-ink-2">{p.email}</span>
                  </span>
                </Link>
              </td>
              <td className="text-ink-2">{p.hostel ?? "—"}</td>
              <td><StatusChip tone={p.status === "verified" ? "ok" : p.status === "suspended" ? "critical" : "warn"}>{p.status}</StatusChip></td>
              <td className="tabular">{p.rating_count ? `${Number(p.rating_avg).toFixed(1)} (${p.rating_count})` : "—"}</td>
              <td className="tabular">{p.jobs_carried} / {p.jobs_requested}</td>
              <td className="tabular">{p.strikes || "—"}</td>
              <td className="font-mono text-[12px] text-ink-2">{ago(p.created_at)}</td>
            </tr>
          ))}
        </Table>
      ) : <EmptyState title="No students match" />}
    </>
  );
}
