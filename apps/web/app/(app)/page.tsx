"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNav, Logo } from "@/components/app-bits";
import { VerifyBanner } from "@/components/gate";
import { Icon } from "@/components/icons";
import { Avatar, ButtonLink, EmptyState, PillTabs, RowSkeletons, StatusChip, cn } from "@/components/ui";
import { displayName, fetchPublicProfiles, ratingLine, useLoad, useRealtime } from "@/lib/data";
import { dayTime, naira, time, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

type Tab = "trips" | "requests";

export default function Home() {
  const { wallet, unread, profile, placeName } = useSession();
  const [tab, setTab] = useState<Tab>("trips");

  const feed = useLoad(async () => {
    const db = supabase();
    const now = new Date().toISOString();
    const [trips, requests] = await Promise.all([
      db.from("trips").select("*").eq("status", "live").gt("back_by", now).order("leaves_at").limit(30),
      db.from("requests").select("*").eq("status", "posted").gt("deadline", now).order("deadline").limit(30),
    ]);
    const people = await fetchPublicProfiles((trips.data ?? []).map((t) => t.traveler_id));
    return { trips: trips.data ?? [], requests: requests.data ?? [], people };
  }, []);
  useRealtime("feed", [{ table: "trips" }, { table: "requests" }], () => void feed.reload());
  const me = profile?.id;

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-4 pt-[max(14px,env(safe-area-inset-top))] pb-1">
        <div className="flex flex-col gap-1">
          <Logo />
          <span className="readout pl-0.5">ABU Zaria · Samaru</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            className="relative grid size-11 place-items-center rounded-full bg-sheet text-foreground ring-1 ring-border outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-95 dark:bg-card dark:ring-glass-border">
            <Icon name="bell" className="size-[18px]" />
            {unread > 0 && (
              <span className="tabular absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-band">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <Link href="/wallet"
            className="flex h-11 items-center gap-2 rounded-pill bg-sheet pr-4 pl-3 text-[14px] font-semibold text-foreground ring-1 ring-border no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card dark:ring-glass-border">
            <Icon name="wallet" className="size-4 text-ink-2" /><span className="tabular">{naira(wallet?.available)}</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pt-4">
        <h1 className="font-display text-[26px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance">Who&apos;s heading where today?</h1>
        <VerifyBanner />
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/requests/new"
            className="lift hero group relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-card p-4 no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-band">
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><Icon name="bag" className="size-[18px]" /></span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">I need something</span>
              <span className="text-[12.5px] opacity-75">Buy, pick up or drop off</span>
            </span>
          </Link>
          <Link href="/trips/new"
            className="lift bento flex min-h-[116px] flex-col justify-between p-4 text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-10 place-items-center rounded-full bg-card-nested ring-1 ring-border dark:ring-glass-border"><Icon name="walk" className="size-[18px]" /></span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">I&apos;m going somewhere</span>
              <span className="text-[12.5px] text-ink-2">Earn on your trip</span>
            </span>
          </Link>
        </div>

        <div className="pt-2">
          <PillTabs<Tab> aria-label="Feed" value={tab} onChange={setTab}
            options={[
              { value: "trips", label: "Trips going out", count: feed.data?.trips.length },
              { value: "requests", label: "Open requests", count: feed.data?.requests.length },
            ]} />
        </div>

        <div role="tabpanel" className="flex flex-col gap-2">
          {feed.loading ? <RowSkeletons count={3} /> : tab === "trips" ? (
            feed.data?.trips.length ? feed.data.trips.map((t, i) => {
              const p = feed.data!.people.get(t.traveler_id);
              const free = t.capacity - t.slots_taken;
              const mine = t.traveler_id === me;
              return (
                <article key={t.id} className="bento entrance flex flex-col gap-3 p-4" style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex items-center gap-3">
                    <Avatar name={displayName(p)} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5 text-[14.5px] font-semibold">
                        {mine ? "Your trip" : displayName(p)}
                        {p?.verified && <Icon name="shield" className="size-3.5 text-ink-2" aria-label="Verified" />}
                      </span>
                      <span className="text-[12.5px] text-ink-2">{ratingLine(p)}</span>
                    </div>
                    <StatusChip tone={free ? "live" : "muted"}>{free} {free === 1 ? "slot" : "slots"}</StatusChip>
                  </div>
                  <p className="text-[16px] leading-snug font-semibold tracking-[-0.01em] text-balance">
                    {placeName(t.from_place_id)} <span className="text-ink-3">→</span> {placeName(t.to_place_id)}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] tracking-wide text-ink-2 uppercase">
                      Leaves <span className="tabular text-foreground">{dayTime(t.leaves_at)}</span> · back <span className="tabular">{time(t.back_by)}</span>
                    </span>
                    <ButtonLink href={mine ? `/trips/${t.id}` : `/trips/${t.id}/request`} variant={mine ? "surface" : "inverse"} size="sm">
                      {mine ? "View" : "Send request"}
                    </ButtonLink>
                  </div>
                </article>
              );
            }) : <EmptyState title="No trips going out yet" body="Heading somewhere? Post your trip and earn on the way."
              action={<ButtonLink href="/trips/new" size="pill">Post a trip</ButtonLink>} />
          ) : (
            feed.data?.requests.length ? feed.data.requests.map((r, i) => {
              const mine = r.requester_id === me;
              return (
                <article key={r.id} className={cn("bento entrance relative flex flex-col gap-2.5 p-4", mine && "ring-1 ring-signal/30")} style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex items-center justify-between gap-2">
                    <StatusChip tone={r.urgent ? "warn" : "idle"} dot={Boolean(r.urgent)}>{r.urgent ? "Urgent · " : ""}{TYPE_LABEL[r.type]}</StatusChip>
                    <span className="font-display text-[17px] font-semibold tabular">{naira(r.fee)}</span>
                  </div>
                  <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{r.items_text}</span>
                  <span className="text-[12.5px] leading-snug text-ink-2">
                    {r.type === "buy" || r.type === "print" ? <>Budget <span className="tabular">{naira(r.item_budget)}</span></> : <>From {placeName(r.from_place_id)}</>}
                    {" · "}to {placeName(r.handoff_place_id)} · by <span className="tabular">{dayTime(r.deadline)}</span>
                  </span>
                  <Link href={`/requests/${r.id}`} aria-label={mine ? "Open your request" : "View job"}
                    className="absolute inset-0 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <span className="flex items-center gap-1 self-start text-[13px] font-semibold text-signal-ink">
                    {mine ? "Your request" : "View job"}<Icon name="chevron" className="size-3.5" />
                  </span>
                </article>
              );
            }) : <EmptyState title="No open requests" body="When someone needs something, it shows up here." />
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
