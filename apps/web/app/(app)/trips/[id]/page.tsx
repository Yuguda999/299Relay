"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Avatar, ButtonLink, Card, ConfirmButton, ErrorNote, Footer, Header, Loading, Notice, Page, Pill, Row, TypeBadge } from "@/components/ui";
import { displayName, fetchPublicProfiles, ratingLine, useLoad, useRealtime } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { dayTime, JOB_STATUS_LABEL, naira, time, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, places } = useSession();
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

  if (q.loading) return <Loading />;
  if (!q.data) return (<><Header title="Trip" /><Page><Notice tone="amber">Trip not found.</Notice></Page></>);
  const { trip, jobs, incoming, traveler } = q.data;
  const mine = trip.traveler_id === profile?.id;
  const open = trip.status === "live" || trip.status === "full";

  async function cancelTrip() {
    setBusy(true);
    const { error } = await supabase().rpc("cancel_trip", { p_trip: id });
    setBusy(false);
    if (error) setError(errorMessage(error));
    void q.reload();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={mine ? "Your trip" : "Trip"} subtitle={`${placeName(trip.from_place_id)} → ${placeName(trip.to_place_id)}`} />
      <Page>
        {!open && <Notice>This trip is {trip.status === "done" ? "finished" : "cancelled"}.</Notice>}
        <Card className="flex flex-col gap-2.5">
          {!mine && (
            <div className="flex items-center gap-2.5">
              <Avatar name={displayName(traveler)} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">{displayName(traveler)}</span>
                <span className="text-[12.5px] text-muted">{ratingLine(traveler)}</span>
              </div>
            </div>
          )}
          <span className="text-[16px] font-semibold">{placeName(trip.from_place_id)} → {placeName(trip.to_place_id)}</span>
          <Row label="Leaves" value={dayTime(trip.leaves_at)} />
          <Row label="Back by" value={time(trip.back_by)} />
          <Row label="Slots" value={`${trip.slots_taken} of ${trip.capacity} used`} />
          <Row label="Takes" value={trip.job_types.map((t) => TYPE_LABEL[t]).join(", ")} />
          {trip.note && <p className="text-[13.5px] text-muted">{trip.note}</p>}
        </Card>

        {mine && incoming.length > 0 && (
          <>
            <h2 className="pt-2 text-[15px] font-bold">Requests sent to you</h2>
            {incoming.map((r) => (
              <Link key={r.id} href={`/requests/${r.id}`} className="no-underline">
                <Card className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between"><TypeBadge type={r.type} urgent={r.urgent} /><span className="text-[14px] font-bold text-ink">{naira(r.fee)} fee</span></div>
                  <span className="line-clamp-1 text-[14.5px] font-semibold text-ink">{r.items_text}</span>
                  <span className="text-[12.5px] text-muted">To {placeName(r.handoff_place_id)} · before {dayTime(r.deadline)}</span>
                </Card>
              </Link>
            ))}
          </>
        )}

        {mine && jobs.length > 0 && (
          <>
            <h2 className="pt-2 text-[15px] font-bold">Jobs you&apos;re carrying</h2>
            {jobs.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="no-underline">
                <Card className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-[14.5px] font-semibold text-ink">{j.request?.items_text}</span>
                  <Pill tone={j.status === "completed" ? "success" : "soft"}>{JOB_STATUS_LABEL[j.status]}</Pill>
                </Card>
              </Link>
            ))}
          </>
        )}
        {mine && open && !jobs.length && !incoming.length && (
          <p className="text-[13.5px] text-muted">Matching requests notify you. You can also pick from <Link href="/" className="font-semibold text-navy">open requests</Link>.</p>
        )}
        <ErrorNote>{error}</ErrorNote>
      </Page>
      {open && (
        <Footer>
          {mine
            ? <ConfirmButton variant="outline" loading={busy} onConfirm={cancelTrip} confirmLabel="Tap again to cancel trip">Cancel trip</ConfirmButton>
            : trip.status === "live" ? <ButtonLink href={`/trips/${id}/request`}>Send a request</ButtonLink> : <Notice>This trip is full.</Notice>}
        </Footer>
      )}
    </div>
  );
}
