"use client";

import { PageTitle, Table } from "@/components/shell";
import { Empty, Loading } from "@/components/ui";
import { useLoad } from "@/lib/admin";
import { dayTime } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

export default function Audit() {
  const q = useLoad(async () => {
    const { data } = await supabase().from("admin_audit").select("*, admin:profiles(full_name)").order("id", { ascending: false }).limit(200);
    return data ?? [];
  }, []);

  return (
    <>
      <PageTitle title="Audit log" sub="Every admin action, newest first." />
      {q.loading ? <Loading /> : q.data?.length ? (
        <Table head={["When", "Admin", "Action", "Target", "Detail"]}>
          {q.data.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-2.5 whitespace-nowrap">{dayTime(a.created_at)}</td>
              <td className="px-4 py-2.5">{a.admin?.full_name}</td>
              <td className="px-4 py-2.5 font-semibold">{a.action.replaceAll("_", " ")}</td>
              <td className="px-4 py-2.5 font-mono text-[12px]">{a.target.slice(0, 8)}</td>
              <td className="max-w-96 truncate px-4 py-2.5 font-mono text-[12px] text-muted">{a.detail ? JSON.stringify(a.detail) : ""}</td>
            </tr>
          ))}
        </Table>
      ) : <Empty title="No admin actions yet" />}
    </>
  );
}
