"use client";

import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { EmptyState, Loading, SearchInput } from "@/components/ui";
import { useLoad } from "@/lib/admin";
import { dayTime } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

export default function Audit() {
  const [search, setSearch] = useState("");
  const q = useLoad(async () => {
    const { data } = await supabase().from("admin_audit").select("*, admin:profiles(full_name)").order("id", { ascending: false }).limit(200);
    return data ?? [];
  }, []);
  const s = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((a) => !s || [a.action, a.admin?.full_name, a.target, JSON.stringify(a.detail ?? "")].some((x) => x?.toLowerCase().includes(s)));

  return (
    <>
      <PageTitle title="Audit log" sub="Every admin action, newest first." right={<SearchInput value={search} onChange={setSearch} placeholder="Search actions" shortcut className="w-72" />} />
      {q.loading ? <Loading /> : rows.length ? (
        <Table head={["When", "Admin", "Action", "Target", "Detail"]} minWidth={820}>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="font-mono text-[12px] whitespace-nowrap text-ink-2 tabular">{dayTime(a.created_at)}</td>
              <td>{a.admin?.full_name}</td>
              <td className="font-semibold">{a.action.replaceAll("_", " ")}</td>
              <td className="font-mono text-[11.5px] text-ink-2">{a.target.slice(0, 8)}</td>
              <td className="max-w-96 truncate font-mono text-[11.5px] text-ink-2">{a.detail ? JSON.stringify(a.detail) : ""}</td>
            </tr>
          ))}
        </Table>
      ) : <EmptyState title={s ? "No matching actions" : "No admin actions yet"} />}
    </>
  );
}
