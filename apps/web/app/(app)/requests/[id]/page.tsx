"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StoredImage } from "@/components/app-bits";
import { DocumentsCard } from "@/components/print";
import { Icon } from "@/components/icons";
import { Alert, Avatar, Button, Card, Field, Footer, Header, Loading, Page, Row, Select, StatusChip, Tile, useNotify } from "@/components/ui";
import { displayName, fetchPublicProfiles, useLoad, useRealtime } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { dayTime, earn, isPurchase, naira, time, TYPE_LABEL } from "@/lib/format";
import type { PrintOptions } from "@/lib/print";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, placeName, refresh } = useSession();
  const { confirm, toast } = useNotify();
  const [tripId, setTripId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useLoad(async () => {
    const db = supabase();
    const { data: req } = await db.from("requests").select("*").eq("id", id).maybeSingle();
    if (!req) return null;
    const [{ data: job }, { data: myTrips }, people, { data: files }] = await Promise.all([
      db.from("jobs").select("id").eq("request_id", id).neq("status", "cancelled").maybeSingle(),
      profile?.id ? db.from("trips").select("*").eq("traveler_id", profile.id).eq("status", "live").order("leaves_at") : Promise.resolve({ data: [] }),
      fetchPublicProfiles([req.requester_id]),
      db.from("request_files").select("*").eq("request_id", id).order("created_at"),
    ]);
    return { req, job, myTrips: myTrips ?? [], requester: people.get(req.requester_id), files: files ?? [] };
  }, [id, profile?.id]);
  useRealtime(`req:${id}`, [{ table: "requests", filter: `id=eq.${id}` }, { table: "jobs", filter: `request_id=eq.${id}` }], () => void q.reload());

  const mine = q.data?.req.requester_id === profile?.id;
  const jobId = q.data?.job?.id;
  useEffect(() => {
    if (jobId) router.replace(`/jobs/${jobId}`);
  }, [jobId, router]);

  if (q.loading || jobId) return <><Header title="Request" /><Page><Loading /></Page></>;
  if (!q.data) {
    return (<><Header title="Request" /><Page><Alert tone="warn" title="No longer available">Someone may have taken it, or it was cancelled.</Alert></Page></>);
  }
  const { req, requester, myTrips, files } = q.data;
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
    toast({ title: "Job accepted", body: isPurchase(req.type) ? `${naira(req.item_budget)} advance is in your wallet.` : "Head to the pickup when you're ready." });
    router.replace(`/jobs/${data.id}`);
  }

  async function cancel() {
    const ok = await confirm({ title: "Cancel this request?", body: `${naira(req.fee + req.item_budget)} goes back to your wallet.`, confirmLabel: "Cancel request", cancelLabel: "Keep it", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase().rpc("cancel_request", { p_request: id });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast({ title: "Request cancelled", body: "Your money is back in your wallet." });
    void refresh();
    void q.reload();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={mine ? "Your request" : "Request details"} subtitle={`${TYPE_LABEL[req.type]} · to ${placeName(req.handoff_place_id)}`} />
      <Page>
        {req.status === "review" && <Alert tone="warn" title="Being checked">It mentions something that may not be allowed. An admin will review it; your money is held meanwhile.</Alert>}
        {req.status === "expired" && <Alert tone="info">No one picked this up in time. Your money is back in your wallet.</Alert>}
        {req.status === "cancelled" && <Alert tone="info">Cancelled. Your money is back in your wallet.</Alert>}

        <Card i={0} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <StatusChip tone={req.urgent ? "warn" : "idle"} dot={Boolean(req.urgent)}>{req.urgent ? "Urgent · " : ""}{TYPE_LABEL[req.type]}</StatusChip>
            {mine
              ? <StatusChip tone={isOpen ? "live" : "muted"}>{req.status === "review" ? "In review" : isOpen ? "Waiting for a traveler" : req.status}</StatusChip>
              : <span className="flex flex-col items-end"><span className="readout">You earn</span><span className="font-display text-kpi-sm font-semibold tabular">{naira(earn(req.fee))}</span></span>}
          </div>
          <p className="text-[16px] leading-snug font-semibold whitespace-pre-line">{req.items_text}</p>
          {req.photo_path && <StoredImage bucket="request-photos" path={req.photo_path} alt="Request photo" className="h-48 w-full" />}
          <Tile className="flex flex-col gap-2">
            <Row label={req.type === "drop_off" ? "Pick up from" : req.type === "buy" ? "Buy at" : req.type === "print" ? "Print at" : "Pick up at"} value={placeName(req.from_place_id)} />
            <Row label="Hand off at" value={placeName(req.handoff_place_id)} />
            <Row label="Before" value={dayTime(req.deadline)} />
            {isPurchase(req.type) && <Row label={req.type === "print" ? "Print budget" : "Item budget"} value={naira(req.item_budget)} />}
            <Row label="Delivery fee" value={naira(req.fee)} />
          </Tile>
        </Card>

        {req.type === "print" && <DocumentsCard i={1} files={files} options={req.print_options as PrintOptions | null} canOpen={mine} />}

        {!mine && (
          <>
            <Card i={1} className="flex items-center gap-3">
              <Avatar name={displayName(requester)} />
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-[14.5px] font-semibold">{displayName(requester)}{requester?.verified && <Icon name="shield" className="size-3.5 text-ink-2" />}</span>
                <span className="text-[12.5px] text-ink-2">{requester?.rating_count ? `${Number(requester.rating_avg).toFixed(1)} rating` : "New requester"}{requester?.hostel ? ` · ${requester.hostel}` : ""}</span>
              </div>
            </Card>
            {isPurchase(req.type) && <Alert tone="signal">You get a {naira(req.item_budget)} advance in your wallet when you accept, so you never use your own cash. Keep the receipt.{req.type === "print" ? " The documents unlock once you accept." : ""}</Alert>}
            {usableTrips.length > 0 && !req.target_trip_id && (
              <Field label="Carry it on one of your trips" optional labelId="trip-l">
                <Select aria-labelledby="trip-l" value={tripId} onChange={setTripId} placeholder="No, just this job"
                  options={[{ value: "", label: "No, just this job" }, ...usableTrips.map((t) => ({ value: t.id, label: `${placeName(t.from_place_id)} → ${placeName(t.to_place_id)}`, hint: `Leaves ${time(t.leaves_at)}` }))]} />
              </Field>
            )}
          </>
        )}
        {mine && isOpen && <p className="px-1 text-[13px] text-ink-2">Travelers heading that way have been notified. You&apos;ll get an alert when someone accepts.</p>}
        <Alert tone="critical">{error}</Alert>
      </Page>

      {isOpen && (
        <Footer>
          {mine ? <Button variant="surface" loading={busy} onClick={cancel}>Cancel request</Button>
            : profile?.status !== "verified" ? <Alert tone="warn">Carrying jobs unlocks once your student ID is approved.</Alert>
            : <Button loading={busy} onClick={accept}>Accept job · earn {naira(earn(req.fee))}</Button>}
        </Footer>
      )}
    </div>
  );
}
