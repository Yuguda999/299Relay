"use client";

import { useState } from "react";
import { BottomNav } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { ButtonLink, EmptyState, Header, LinkRow, Page, PillTabs, RowSkeletons, SectionLabel, StatusChip, type ChipTone } from "@/components/ui";
import { useLoad, useRealtime } from "@/lib/data";
import { dayTime, JOB_STATUS_LABEL, naira, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

type Tab = "active" | "past";
const ACTIVE = ["accepted", "purchased", "in_transit", "disputed"];
const TONE: Record<string, ChipTone> = { completed: "ok", disputed: "critical", refunded: "muted", accepted: "live", purchased: "live", in_transit: "live" };

export default function MyJobs() {
  const { profile, placeName } = useSession();
  const [tab, setTab] = useState<Tab>("active");
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

  const all = q.data?.jobs ?? [];
  const jobs = all.filter((j) => (tab === "active" ? ACTIVE.includes(j.status) : !ACTIVE.includes(j.status)));
  const activeCount = all.filter((j) => ACTIVE.includes(j.status)).length + (q.data?.waiting.length ?? 0) + (q.data?.trips.length ?? 0);
  let i = 0;

  return (
    <>
      <Header title="My jobs" back={false} />
      <Page>
        <PillTabs<Tab> aria-label="Jobs" value={tab} onChange={setTab} options={[{ value: "active", label: "Active", count: activeCount }, { value: "past", label: "Past" }]} />
        {q.loading || !q.data ? <RowSkeletons /> : (
          <>
            {tab === "active" && q.data!.trips.length > 0 && <SectionLabel>Your trips</SectionLabel>}
            {tab === "active" && q.data!.trips.map((t) => (
              <LinkRow key={t.id} href={`/trips/${t.id}`} i={i++}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card-nested ring-1 ring-border dark:ring-glass-border"><Icon name="walk" className="size-[18px]" /></span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14.5px] font-semibold">{placeName(t.from_place_id)} → {placeName(t.to_place_id)}</span>
                    <span className="font-mono text-[11px] tracking-wide text-ink-2 uppercase">Leaves <span className="tabular">{dayTime(t.leaves_at)}</span> · <span className="tabular">{t.slots_taken}/{t.capacity}</span> slots</span>
                  </div>
                  <Icon name="chevron" className="size-4 text-ink-3" />
                </div>
              </LinkRow>
            ))}
            {tab === "active" && q.data!.waiting.length > 0 && <SectionLabel>Waiting for a traveler</SectionLabel>}
            {tab === "active" && q.data!.waiting.map((r) => (
              <LinkRow key={r.id} href={`/requests/${r.id}`} i={i++}>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14.5px] font-semibold">{r.items_text}</span>
                    <StatusChip tone={r.status === "review" ? "warn" : "live"}>{r.status === "review" ? "In review" : TYPE_LABEL[r.type]}</StatusChip>
                  </div>
                  <span className="text-[12.5px] text-ink-2"><span className="tabular">{naira(r.fee + r.item_budget)}</span> held · by <span className="tabular">{dayTime(r.deadline)}</span></span>
                </div>
              </LinkRow>
            ))}
            {tab === "active" && jobs.length > 0 && <SectionLabel>Jobs</SectionLabel>}
            {jobs.map((j) => {
              const r = j.request!;
              const asTraveler = j.traveler_id === me;
              return (
                <LinkRow key={j.id} href={`/jobs/${j.id}`} i={i++}>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="readout">{asTraveler ? "You're carrying" : "Your request"}</span>
                      <StatusChip tone={TONE[j.status] ?? "muted"}>{JOB_STATUS_LABEL[j.status]}</StatusChip>
                    </div>
                    <span className="truncate text-[14.5px] font-semibold">{r.items_text}</span>
                    <span className="text-[12.5px] text-ink-2">To {placeName(r.handoff_place_id)} · <span className="tabular">{dayTime(r.deadline)}</span> · fee <span className="tabular">{naira(r.fee)}</span></span>
                  </div>
                </LinkRow>
              );
            })}
            {!jobs.length && (tab === "past" || (!q.data!.waiting.length && !q.data!.trips.length)) && (
              <EmptyState title={tab === "active" ? "Nothing on the go" : "No past jobs yet"} body="Post a request or carry one on your next trip."
                action={<ButtonLink href="/" size="pill" variant="surface">Go to home</ButtonLink>} />
            )}
          </>
        )}
      </Page>
      <BottomNav />
    </>
  );
}
