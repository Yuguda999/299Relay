"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Chip, Empty, Input, Loading, Pill } from "@/components/ui";
import { useLoad } from "@/lib/admin";
import { ago } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

export default function Users() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "verified" | "suspended">("all");
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
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Search by name or email" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {(["all", "pending", "verified", "suspended"] as const).map((s) => <Chip key={s} on={status === s} onClick={() => setStatus(s)}>{s[0]!.toUpperCase() + s.slice(1)}</Chip>)}
      </div>
      {q.loading ? <Loading /> : q.data?.length ? (
        <Table head={["Name", "Email", "Hostel", "Status", "Rating", "Delivered / requested", "Strikes", "Joined"]}>
          {q.data.map((p) => (
            <tr key={p.id} className="hover:bg-bg">
              <td className="px-4 py-3"><Link href={`/users/${p.id}`} className="font-semibold text-navy">{p.full_name}</Link>{p.role === "admin" && <span className="ml-1.5 text-[11px] font-bold text-orange">ADMIN</span>}</td>
              <td className="px-4 py-3">{p.email}</td>
              <td className="px-4 py-3">{p.hostel ?? "—"}</td>
              <td className="px-4 py-3"><Pill tone={p.status === "verified" ? "success" : p.status === "suspended" ? "danger" : "amber"}>{p.status}</Pill></td>
              <td className="px-4 py-3">{p.rating_count ? `${Number(p.rating_avg).toFixed(1)} (${p.rating_count})` : "—"}</td>
              <td className="px-4 py-3">{p.jobs_carried} / {p.jobs_requested}</td>
              <td className="px-4 py-3">{p.strikes || "—"}</td>
              <td className="px-4 py-3">{ago(p.created_at)}</td>
            </tr>
          ))}
        </Table>
      ) : <Empty title="No students match" />}
    </>
  );
}
