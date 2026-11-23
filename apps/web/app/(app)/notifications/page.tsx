"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Dot, EmptyState, Header, Page, RowSkeletons, cn } from "@/components/ui";
import { useLoad, useRealtime } from "@/lib/data";
import { ago } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Notifications() {
  const { refresh } = useSession();
  const q = useLoad(async () => (await supabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(60)).data ?? [], []);
  useRealtime("inbox", [{ table: "notifications" }], () => void q.reload());

  // Opening the inbox marks everything read; the list still shows which were new.
  useEffect(() => {
    void supabase().rpc("mark_notifications_read", {}).then(() => refresh());
  }, [refresh]);

  return (
    <>
      <Header title="Notifications" />
      <Page>
        {q.loading ? <RowSkeletons count={5} /> : q.data?.length ? (
          <ul className="flex flex-col gap-1.5">
            {q.data.map((n, i) => {
              const unread = !n.read_at;
              const body = (
                <div className={cn("flex gap-3 rounded-[20px] p-3.5 transition-colors", unread ? "bg-signal-soft ring-1 ring-signal/25" : "bg-card dark:ring-1 dark:ring-glass-border")}>
                  <span className="mt-1.5 flex w-2 shrink-0 justify-center">{unread && <Dot />}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={cn("text-[14px]", unread ? "font-semibold" : "font-medium text-foreground/80")}>{n.title}</span>
                      <time className="shrink-0 font-mono text-[11px] text-ink-2 tabular">{ago(n.created_at)}</time>
                    </div>
                    {n.body && <span className="text-[13px] leading-snug text-ink-2">{n.body}</span>}
                  </div>
                </div>
              );
              return (
                <li key={n.id} className="entrance" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                  {n.link && !n.link.startsWith("/admin")
                    ? <Link href={n.link} className="block rounded-[20px] no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link>
                    : body}
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="You're all caught up" body="Job updates, matches on your route and wallet events show up here." />}
      </Page>
    </>
  );
}
