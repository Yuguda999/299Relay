"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Alert, Avatar, Button, ButtonLink, Card, Footer, Header, LinkRow, Loading, Page, Row, SectionLabel, StatusChip, Tile, useNotify } from "@/components/ui";
import { displayName, fetchPublicProfiles, ratingLine, useLoad, useRealtime } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { dayTime, JOB_STATUS_LABEL, naira, time, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, places } = useSession();
  const { confirm, toast } = useNotify();
  const placeName = (pid: string | null) => places.find((p) => p.id === pid)?.name ?? "";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useLoad(async () => {
    const db = supabase();
    const { data: trip } = await db.from("trips").select("*").eq("id", id).single();
    if (!trip) return null;
    const [{ data: jobs }, { data: incoming }, people] = await Promise.all([
      db.from("jobs").select("*, request:requests(*)").eq("trip_id", id).neq("status", "cancelled"),
      db.from("requests").select("*").eq("target_trip_id", id).eq("status", "posted"),
      fetchPublicProfiles([trip.traveler_id]),
    ]);
    return { trip, jobs: jobs ?? [], incoming: incoming ?? [], traveler: people.get(trip.traveler_id) };
  }, [id]);
  useRealtime(`trip:${id}`, [{ table: "trips", filter: `id=eq.${id}` }, { table: "jobs" }, { table: "requests" }], () => void q.reload());

  if (q.loading) return <><Header title="Trip" /><Page><Loading /></Page></>;
  if (!q.data) return <><Header title="Trip" /><Page><Alert tone="warn">Trip not found.</Alert></Page></>;
  const { trip, jobs, incoming, traveler } = q.data;
  const mine = trip.traveler_id === profile?.id;
  const open = trip.status === "live" || trip.status === "full";

  async function cancelTrip() {
    const ok = await confirm({ title: "Cancel this trip?", body: "Jobs you haven't started go back to the open feed.", confirmLabel: "Cancel trip", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase().rpc("cancel_trip", { p_trip: id });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast({ title: "Trip cancelled" });
    void q.reload();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={mine ? "Your trip" : "Trip"} subtitle={`${placeName(trip.from_place_id)} → ${placeName(trip.to_place_id)}`}
        right={<StatusChip tone={trip.status === "live" ? "live" : trip.status === "full" ? "warn" : "muted"}>{trip.status}</StatusChip>} />
      <Page>
        {!open && <Alert tone="info">This trip is {trip.status === "done" ? "finished" : "cancelled"}.</Alert>}
        <Card i={0} className="flex flex-col gap-3">
          {!mine && (
            <div className="flex items-center gap-3">
              <Avatar name={displayName(traveler)} />
              <div className="flex flex-col"><span className="text-[14.5px] font-semibold">{displayName(traveler)}</span><span className="text-[12.5px] text-ink-2">{ratingLine(traveler)}</span></div>
            </div>
          )}
          <p className="font-display text-[19px] leading-snug font-semibold tracking-[-0.01em] text-balance">
            {placeName(trip.from_place_id)} <span className="text-ink-3">→</span> {placeName(trip.to_place_id)}
          </p>
          <Tile className="flex flex-col gap-2">
            <Row label="Leaves" value={dayTime(trip.leaves_at)} />
            <Row label="Back by" value={time(trip.back_by)} />
            <Row label="Slots used" value={`${trip.slots_taken} of ${trip.capacity}`} />
            <Row label="Takes" value={trip.job_types.map((t) => TYPE_LABEL[t]).join(", ")} />
          </Tile>
          {trip.note && <p className="text-[13.5px] text-ink-2">{trip.note}</p>}
        </Card>

        {mine && incoming.length > 0 && <SectionLabel>Requests sent to you</SectionLabel>}
        {mine && incoming.map((r, i) => (
          <LinkRow key={r.id} href={`/requests/${r.id}`} i={i + 1} active>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-[14.5px] font-semibold">{r.items_text}</span><span className="font-semibold tabular">{naira(r.fee)}</span></div>
              <span className="text-[12.5px] text-ink-2">{TYPE_LABEL[r.type]} · to {placeName(r.handoff_place_id)} · by <span className="tabular">{dayTime(r.deadline)}</span></span>
            </div>
          </LinkRow>
        ))}

        {mine && jobs.length > 0 && <SectionLabel>Jobs you&apos;re carrying</SectionLabel>}
        {mine && jobs.map((j, i) => (
          <LinkRow key={j.id} href={`/jobs/${j.id}`} i={i + 1}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[14.5px] font-semibold">{j.request?.items_text}</span>
              <StatusChip tone={j.status === "completed" ? "ok" : "live"}>{JOB_STATUS_LABEL[j.status]}</StatusChip>
            </div>
          </LinkRow>
        ))}
        {mine && open && !jobs.length && !incoming.length && (
          <p className="px-1 text-[13.5px] text-ink-2">Matching requests will alert you. You can also pick from <Link href="/" className="font-semibold text-signal-ink">open requests</Link>.</p>
        )}
        <Alert tone="critical">{error}</Alert>
      </Page>
      {open && (
        <Footer>
          {mine ? <Button variant="destructive" loading={busy} onClick={cancelTrip}>Cancel trip</Button>
            : trip.status === "live" ? <ButtonLink href={`/trips/${id}/request`}>Send a request</ButtonLink>
            : <Alert tone="info">This trip is full.</Alert>}
        </Footer>
      )}
    </div>
  );
}
