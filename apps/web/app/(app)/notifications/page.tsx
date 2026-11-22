"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Empty, Header, Loading, Page, cx } from "@/components/ui";
import { useLoad, useRealtime } from "@/lib/data";
import { ago } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Notifications() {
  const { refresh } = useSession();
  const q = useLoad(async () => (await supabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(60)).data ?? [], []);
  useRealtime("inbox", [{ table: "notifications" }], () => void q.reload());

  // Opening the inbox marks everything read (the list keeps showing which were new).
  useEffect(() => {
    void supabase().rpc("mark_notifications_read", {}).then(() => refresh());
  }, [refresh]);

  return (
    <>
      <Header title="Notifications" />
      <Page>
        {q.loading ? <Loading /> : q.data?.length ? (
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {q.data.map((n) => {
              const body = (
                <div className={cx("flex gap-3 px-3.5 py-3", !n.read_at && "bg-soft/50")}>
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-orange")} />
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-ink">{n.title}</span>
                    {n.body && <span className="text-[13px] leading-snug text-muted">{n.body}</span>}
                    <span className="text-[11.5px] text-muted">{ago(n.created_at)}</span>
                  </div>
                </div>
              );
              return n.link && !n.link.startsWith("/admin")
                ? <Link key={n.id} href={n.link} className="no-underline">{body}</Link>
                : <div key={n.id}>{body}</div>;
            })}
          </div>
        ) : <Empty title="You're all caught up" body="Job updates, matches on your route and wallet events show up here." />}
      </Page>
    </>
  );
}
