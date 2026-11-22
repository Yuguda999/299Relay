"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNav } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { ButtonLink, Card, Empty, Header, Loading, Page, Pill, Segmented, TypeBadge } from "@/components/ui";
import { useLoad, useRealtime } from "@/lib/data";
import { dayTime, JOB_STATUS_LABEL, naira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

type Tab = "active" | "past";
const ACTIVE = ["accepted", "purchased", "in_transit", "disputed"];

export default function MyJobs() {
  const { profile, places } = useSession();
  const [tab, setTab] = useState<Tab>("active");
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name ?? "";
  const me = profile?.id ?? "";

  const q = useLoad(async () => {
    if (!me) return null;
    const db = supabase();
    const [{ data: jobs }, { data: waiting }, { data: trips }] = await Promise.all([
      db.from("jobs").select("*, request:requests(*)").neq("status", "cancelled").order("created_at", { ascending: false }).limit(60),
      db.from("requests").select("*").eq("requester_id", me).in("status", ["posted", "review"]).order("deadline"),
      db.from("trips").select("*").eq("traveler_id", me).in("status", ["live", "full"]).order("leaves_at"),
    ]);
    return { jobs: jobs ?? [], waiting: waiting ?? [], trips: trips ?? [] };
  }, [me]);
  useRealtime("myjobs", [{ table: "jobs" }, { table: "requests" }, { table: "trips" }], () => void q.reload());

  const jobs = (q.data?.jobs ?? []).filter((j) => (tab === "active" ? ACTIVE.includes(j.status) : !ACTIVE.includes(j.status)));

  return (
    <>
      <Header title="My jobs" back={false} />
      <Page>
        <Segmented<Tab> value={tab} onChange={setTab} options={[{ value: "active", label: "Active" }, { value: "past", label: "Past" }]} />
        {q.loading ? <Loading /> : (
          <>
            {tab === "active" && q.data!.trips.map((t) => (
              <Link key={t.id} href={`/trips/${t.id}`} className="no-underline">
                <Card className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-soft text-navy"><Icon name="walk" size={20} /></span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[14.5px] font-semibold text-ink">Your trip · {placeName(t.from_place_id)} → {placeName(t.to_place_id)}</span>
                    <span className="text-[12.5px] text-muted">Leaves {dayTime(t.leaves_at)} · {t.slots_taken}/{t.capacity} slots used</span>
                  </div>
                  <Icon name="chevron" size={18} className="text-muted" />
                </Card>
              </Link>
            ))}
            {tab === "active" && q.data!.waiting.map((r) => (
              <Link key={r.id} href={`/requests/${r.id}`} className="no-underline">
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between"><TypeBadge type={r.type} urgent={r.urgent} /><Pill tone="amber">{r.status === "review" ? "In review" : "Waiting for a traveler"}</Pill></div>
                  <span className="line-clamp-1 text-[15px] font-semibold text-ink">{r.items_text}</span>
                  <span className="text-[12.5px] text-muted">{naira(r.fee + r.item_budget)} held · before {dayTime(r.deadline)}</span>
                </Card>
              </Link>
            ))}
            {jobs.map((j) => {
              const r = j.request!;
              const asTraveler = j.traveler_id === me;
              return (
                <Link key={j.id} href={`/jobs/${j.id}`} className="no-underline">
                  <Card className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-muted">{asTraveler ? "YOU'RE CARRYING" : "YOUR REQUEST"}</span>
                      <Pill tone={j.status === "completed" ? "success" : j.status === "disputed" ? "danger" : ACTIVE.includes(j.status) ? "soft" : "muted"}>{JOB_STATUS_LABEL[j.status]}</Pill>
                    </div>
                    <span className="line-clamp-1 text-[15px] font-semibold text-ink">{r.items_text}</span>
                    <span className="text-[12.5px] text-muted">To {placeName(r.handoff_place_id)} · {dayTime(r.deadline)} · fee {naira(r.fee)}</span>
                  </Card>
                </Link>
              );
            })}
            {!jobs.length && (tab === "past" || (!q.data!.waiting.length && !q.data!.trips.length)) && (
              <Empty title={tab === "active" ? "Nothing on the go" : "No past jobs yet"} body="Post a request or carry one on your next trip."
                action={<ButtonLink href="/" size="md">Go to home</ButtonLink>} />
            )}
          </>
        )}
      </Page>
      <BottomNav />
    </>
  );
}
