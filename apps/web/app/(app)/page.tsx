"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNav, Logo } from "@/components/app-bits";
import { VerifyBanner } from "@/components/gate";
import { Icon } from "@/components/icons";
import { Avatar, ButtonLink, Card, Empty, Loading, Pill, Segmented, TypeBadge } from "@/components/ui";
import { displayName, fetchPublicProfiles, ratingLine, useLoad, useRealtime } from "@/lib/data";
import { dayTime, naira, time } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

type Tab = "trips" | "requests";

export default function Home() {
  const { wallet, unread, profile, places } = useSession();
  const [tab, setTab] = useState<Tab>("trips");
  const placeName = (id: string | null) => places.find((p) => p.id === id)?.name ?? "";

  const feed = useLoad(async () => {
    const db = supabase();
    const now = new Date().toISOString();
    const [trips, requests] = await Promise.all([
      db.from("trips").select("*").eq("status", "live").gt("back_by", now).order("leaves_at").limit(30),
      db.from("requests").select("*").eq("status", "posted").gt("deadline", now).order("deadline").limit(30),
    ]);
    const people = await fetchPublicProfiles([...(trips.data ?? []).map((t) => t.traveler_id)]);
    return { trips: trips.data ?? [], requests: requests.data ?? [], people };
  }, []);
  useRealtime("feed", [{ table: "trips" }, { table: "requests" }], () => void feed.reload());

  const me = profile?.id;

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <div className="flex flex-col gap-0.5">
          <Logo />
          <span className="text-[13px] text-muted">ABU Zaria · Samaru campus</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            className="relative flex size-11 items-center justify-center rounded-full border border-line bg-white text-ink">
            <Icon name="bell" size={20} />
            {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-orange ring-2 ring-white" />}
          </Link>
          <Link href="/wallet" className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[14px] font-semibold text-ink no-underline">
            <Icon name="wallet" size={16} className="text-navy" />{naira(wallet?.available)}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-5 pt-3 pb-6">
        <h1 className="font-display text-[26px] leading-[1.15] font-semibold tracking-tight">Who&apos;s heading where today?</h1>
        <VerifyBanner />
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/requests/new" className="flex min-h-24 flex-col gap-1.5 rounded-2xl bg-navy p-4 text-white no-underline">
            <Icon name="bag" />
            <span className="text-[15px] font-semibold">I need something</span>
            <span className="text-[12.5px] text-mist">Buy, pick up or drop off</span>
          </Link>
          <Link href="/trips/new" className="flex min-h-24 flex-col gap-1.5 rounded-2xl border border-line bg-white p-4 text-ink no-underline">
            <Icon name="walk" className="text-navy" />
            <span className="text-[15px] font-semibold">I&apos;m going somewhere</span>
            <span className="text-[12.5px] text-muted">Earn on your trip</span>
          </Link>
        </div>

        <div className="pt-2">
          <Segmented<Tab> value={tab} onChange={setTab}
            options={[{ value: "trips", label: "Trips going out" }, { value: "requests", label: "Open requests" }]} />
        </div>

        {feed.loading ? <Loading /> : tab === "trips" ? (
          feed.data?.trips.length ? feed.data.trips.map((t) => {
            const p = feed.data!.people.get(t.traveler_id);
            const free = t.capacity - t.slots_taken;
            const mine = t.traveler_id === me;
            return (
              <Card key={t.id} as="article" className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={displayName(p)} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[14.5px] font-semibold">{mine ? "Your trip" : displayName(p)} {p?.verified && <span className="text-[12px] font-semibold text-navy">· Verified</span>}</span>
                    <span className="text-[12.5px] text-muted">{ratingLine(p)}</span>
                  </div>
                  <Pill>{free} {free === 1 ? "slot" : "slots"}</Pill>
                </div>
                <div className="text-[15.5px] font-semibold">{placeName(t.from_place_id)} → {placeName(t.to_place_id)}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted">Leaves {dayTime(t.leaves_at)} · back {time(t.back_by)}</span>
                  <ButtonLink href={mine ? `/trips/${t.id}` : `/trips/${t.id}/request`} variant="dark" size="md">
                    {mine ? "View" : "Send request"}
                  </ButtonLink>
                </div>
              </Card>
            );
          }) : <Empty title="No trips going out yet" body="Heading somewhere? Post your trip and earn on the way." action={<ButtonLink href="/trips/new" size="md">Post a trip</ButtonLink>} />
        ) : (
          feed.data?.requests.length ? feed.data.requests.map((r) => {
            const mine = r.requester_id === me;
            return (
              <Card key={r.id} as="article" className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <TypeBadge type={r.type} urgent={r.urgent} />
                  <span className="text-[15px] font-bold">{naira(r.fee)} fee</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="line-clamp-2 text-[15px] font-semibold">{r.items_text}</span>
                  <span className="text-[13px] text-muted">
                    {r.type === "buy" ? `Budget ${naira(r.item_budget)} · ` : `From ${placeName(r.from_place_id)} · `}
                    Deliver to {placeName(r.handoff_place_id)} · before {dayTime(r.deadline)}
                  </span>
                </div>
                <ButtonLink href={`/requests/${r.id}`} variant={mine ? "outline" : "primary"} size="md" className="self-start">
                  {mine ? "Your request" : "View job"}
                </ButtonLink>
              </Card>
            );
          }) : <Empty title="No open requests" body="When someone needs something, it shows up here." />
        )}
      </main>
      <BottomNav />
    </>
  );
}
