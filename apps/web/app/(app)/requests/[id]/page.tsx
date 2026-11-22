"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StoredImage } from "@/components/app-bits";
import { Avatar, Button, Card, ConfirmButton, ErrorNote, Footer, Header, Loading, Notice, Page, Pill, Row, Select, TypeBadge } from "@/components/ui";
import { displayName, fetchPublicProfiles, useLoad, useRealtime } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { dayTime, naira, time } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

/** 15% commission rounded down to whole naira (mirrors private.commission). */
const earn = (fee: number) => fee - Math.floor((fee * 0.15) / 100) * 100;

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, places, refresh } = useSession();
  const placeName = (pid: string | null) => places.find((p) => p.id === pid)?.name ?? "";
  const [tripId, setTripId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useLoad(async () => {
    const db = supabase();
    const { data: req } = await db.from("requests").select("*").eq("id", id).maybeSingle();
    if (!req) return null;
    const [{ data: job }, { data: myTrips }, people] = await Promise.all([
      db.from("jobs").select("id").eq("request_id", id).neq("status", "cancelled").maybeSingle(),
      db.from("trips").select("*").eq("traveler_id", profile?.id ?? "").eq("status", "live").order("leaves_at"),
      fetchPublicProfiles([req.requester_id]),
    ]);
    return { req, job, myTrips: myTrips ?? [], requester: people.get(req.requester_id) };
  }, [id, profile?.id]);
  useRealtime(`req:${id}`, [{ table: "requests", filter: `id=eq.${id}` }, { table: "jobs", filter: `request_id=eq.${id}` }], () => void q.reload());

  const mine = q.data?.req.requester_id === profile?.id;
  const jobId = q.data?.job?.id;

  useEffect(() => {
    if (jobId) router.replace(`/jobs/${jobId}`);
  }, [jobId, router]);

  if (q.loading || jobId) return <Loading />;
  if (!q.data) {
    return (
      <>
        <Header title="Request" />
        <Page><Notice tone="amber">This request is no longer available. Someone may have taken it.</Notice></Page>
      </>
    );
  }
  const { req, requester, myTrips } = q.data;
  const usableTrips = myTrips.filter((t) => t.slots_taken < t.capacity && t.job_types.includes(req.type) && new Date(t.leaves_at) < new Date(req.deadline));
  const isOpen = req.status === "posted" || req.status === "review";

  async function accept() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase().rpc("accept_job", { p_request: id, p_trip: tripId || undefined });
    if (error) {
      setBusy(false);
      setError(errorMessage(error));
      void q.reload();
      return;
    }
    void refresh();
    router.replace(`/jobs/${data.id}`);
  }

  async function cancel() {
    setBusy(true);
    const { error } = await supabase().rpc("cancel_request", { p_request: id });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    void refresh();
    void q.reload();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={mine ? "Your request" : "Request details"} subtitle={`${req.type === "buy" ? "Buy" : req.type === "pick_up" ? "Pick up" : "Drop off"} · to ${placeName(req.handoff_place_id)}`} />
      <Page>
        {req.status === "review" && <Notice tone="amber">Being checked by an admin because it mentions something that may not be allowed. Your money is held meanwhile.</Notice>}
        {req.status === "expired" && <Notice tone="amber">No one picked this up in time. Your money is back in your wallet.</Notice>}
        {req.status === "cancelled" && <Notice>Cancelled. Your money is back in your wallet.</Notice>}

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <TypeBadge type={req.type} urgent={req.urgent} />
            {mine ? <Pill tone={isOpen ? "amber" : "muted"}>{isOpen ? "Waiting for a traveler" : req.status}</Pill> : <span className="text-[15px] font-bold">You earn {naira(earn(req.fee))}</span>}
          </div>
          <p className="text-[16px] leading-snug font-semibold whitespace-pre-line">{req.items_text}</p>
          {req.photo_path && <StoredImage bucket="request-photos" path={req.photo_path} alt="Request photo" className="h-48 w-full rounded-xl" />}
          <div className="flex flex-col gap-1.5">
            <Row label={req.type === "drop_off" ? "Pick up from" : req.type === "buy" ? "Buy at" : "Pick up at"} value={placeName(req.from_place_id)} />
            <Row label="Hand off at" value={placeName(req.handoff_place_id)} />
            <Row label="Before" value={dayTime(req.deadline)} />
            {req.type === "buy" && <Row label="Item budget" value={naira(req.item_budget)} />}
            <Row label="Delivery fee" value={naira(req.fee)} />
          </div>
        </Card>

        {!mine && (
          <>
            <Card className="flex items-center gap-2.5">
              <Avatar name={displayName(requester)} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">{displayName(requester)} {requester?.verified && <span className="text-[12px] text-navy">· Verified</span>}</span>
                <span className="text-[12.5px] text-muted">{requester?.rating_count ? `${Number(requester.rating_avg).toFixed(1)} rating` : "New requester"}{requester?.hostel ? ` · ${requester.hostel}` : ""}</span>
              </div>
            </Card>
            {req.type === "buy" && (
              <Notice>You get a {naira(req.item_budget)} purchase advance in your wallet when you accept, so you never use your own cash. Keep the receipt.</Notice>
            )}
            {usableTrips.length > 0 && !req.target_trip_id && (
              <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                Carry it on one of your trips <span className="font-normal text-muted">(optional)</span>
                <Select value={tripId} onChange={(e) => setTripId(e.target.value)}>
                  <option value="">No, just this job</option>
                  {usableTrips.map((t) => <option key={t.id} value={t.id}>{placeName(t.from_place_id)} → {placeName(t.to_place_id)} · {time(t.leaves_at)}</option>)}
                </Select>
              </label>
            )}
          </>
        )}
        {mine && isOpen && <p className="text-[13px] text-muted">Travelers heading that way have been notified. You&apos;ll get a push when someone accepts.</p>}
        <ErrorNote>{error}</ErrorNote>
      </Page>

      {isOpen && (
        <Footer>
          {mine ? (
            <ConfirmButton variant="outline" loading={busy} onConfirm={cancel}>Cancel request · full refund</ConfirmButton>
          ) : profile?.status !== "verified" ? (
            <Notice tone="amber">Carrying jobs unlocks once your student ID is approved.</Notice>
          ) : (
            <Button loading={busy} onClick={accept}>Accept job</Button>
          )}
        </Footer>
      )}
    </div>
  );
}
