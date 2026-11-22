"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CodeInput, PhotoPicker, StoredImage } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { Avatar, Button, ButtonLink, Card, ConfirmButton, ErrorNote, Field, Footer, Header, Input, Loading, Notice, Page, Row, TypeBadge, cx } from "@/components/ui";
import { displayName, fetchPublicProfiles, ratingLine, uploadPhoto, useLoad, useRealtime } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { dayTime, naira, time, toKobo, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase, type Tables } from "@/lib/supabase/client";

const earn = (fee: number) => fee - Math.floor((fee * 0.15) / 100) * 100;

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, places, refresh } = useSession();
  const placeName = (pid: string | null) => places.find((p) => p.id === pid)?.name ?? "";

  const q = useLoad(async () => {
    const db = supabase();
    const { data: job } = await db.from("jobs").select("*").eq("id", id).single();
    if (!job) return null;
    const [{ data: req }, { data: events }, { data: code }, { data: ratings }, { data: disputes }, people] = await Promise.all([
      db.from("requests").select("*").eq("id", job.request_id).single(),
      db.from("job_events").select("*").eq("job_id", id).order("id"),
      db.from("job_handoff_codes").select("code").eq("job_id", id).maybeSingle(),
      db.from("ratings").select("rater_id").eq("job_id", id),
      db.from("disputes").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      fetchPublicProfiles([job.requester_id, job.traveler_id]),
    ]);
    return { job, req: req!, events: events ?? [], code: code?.code ?? null, ratings: ratings ?? [], disputes: disputes ?? [], people };
  }, [id]);
  useRealtime(`job:${id}`, [{ table: "jobs", filter: `id=eq.${id}` }], () => {
    void q.reload();
    void refresh();
  });

  if (q.loading) return <Loading />;
  if (!q.data) return (<><Header title="Job" /><Page><Notice tone="amber">Job not found.</Notice></Page></>);

  const { job, req, events, code, ratings, disputes, people } = q.data;
  const isRequester = job.requester_id === profile?.id;
  const other = people.get(isRequester ? job.traveler_id : job.requester_id);
  const rated = ratings.some((r) => r.rater_id === profile?.id);
  const live = ["accepted", "purchased", "in_transit"].includes(job.status);
  const openDispute = disputes.find((d) => d.status === "open");

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={titleOf(req.items_text)} subtitle={`${TYPE_LABEL[req.type]} job · to ${placeName(req.handoff_place_id)}`} back="/jobs" />
      <Page>
        {job.status === "disputed" && <Notice tone="amber">An issue was reported. Payment is paused while an admin reviews it (usually within 24 hours).</Notice>}
        {job.status === "refunded" && <Notice>This job was refunded after review.</Notice>}
        {job.status === "cancelled" && <Notice>This job was cancelled. Any held money went back to the wallet it came from.</Notice>}
        {openDispute && job.status === "completed" && <Notice tone="amber">Your report is with an admin.</Notice>}

        {isRequester && live && code && (
          <section aria-label="Handoff code" className="flex flex-col gap-2.5 rounded-[18px] bg-navy p-[18px] text-white">
            <span className="text-[13px] font-semibold text-mist">Your handoff code</span>
            <div className="grid grid-cols-4 gap-2">
              {code.split("").map((d, i) => (
                <span key={i} className="rounded-xl bg-white py-2 text-center font-display text-[34px] font-bold text-ink">{d}</span>
              ))}
            </div>
            <span className="text-[13px] leading-[1.45] text-[#DCE3F0]">
              Show it to {displayName(other).split(" ")[0]} only once you have checked your items. Entering it releases their fee.
            </span>
          </section>
        )}

        <Card className="flex items-center gap-2.5 py-3">
          <Avatar name={displayName(other)} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14.5px] font-semibold">{displayName(other)}</span>
            <span className="text-[12.5px] text-muted">{isRequester ? ratingLine(other) : other?.hostel ? `Requester · ${other.hostel}` : "Requester"}</span>
          </div>
          <ButtonLink href={`/jobs/${id}/chat`} variant="soft" size="md"><Icon name="chat" size={18} />Chat</ButtonLink>
        </Card>

        {!isRequester && <TravelerDetails job={job} req={req} placeName={placeName} />}

        <Timeline job={job} req={req} events={events} placeName={placeName} isRequester={isRequester} />

        {!isRequester && live && <TravelerActions job={job} req={req} onDone={() => { void q.reload(); void refresh(); }} />}
      </Page>

      <Footer>
        {job.status === "completed" && !rated && (
          <ButtonLink href={`/jobs/${id}/rate`}>{isRequester ? "Rate and tip" : "Rate the requester"}</ButtonLink>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {(live || (job.status === "completed" && !openDispute)) && (
            <ButtonLink href={`/jobs/${id}/report`} variant="outline" className={cx(!(isRequester && job.status === "accepted") && "col-span-2")}>Report issue</ButtonLink>
          )}
          {isRequester && job.status === "accepted" && <CancelJob requestId={req.id} onDone={() => void q.reload()} />}
        </div>
      </Footer>
    </div>
  );
}

function titleOf(items: string) {
  const first = items.split(/[,\n]/)[0]!.trim();
  return first.length > 32 ? first.slice(0, 30) + "…" : first;
}

function TravelerDetails({ job, req, placeName }: { job: Tables<"jobs">; req: Tables<"requests">; placeName: (id: string | null) => string }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <TypeBadge type={req.type} urgent={req.urgent} />
        <span className="text-[15px] font-bold">You earn {naira(earn(req.fee))}</span>
      </div>
      <p className="text-[15px] leading-snug font-semibold whitespace-pre-line">{req.items_text}</p>
      {req.photo_path && <StoredImage bucket="request-photos" path={req.photo_path} alt="Request photo" className="h-40 w-full rounded-xl" />}
      <div className="flex flex-col gap-1.5">
        <Row label={req.type === "buy" ? "Buy at" : "Pick up at"} value={placeName(req.from_place_id)} />
        <Row label="Hand off at" value={placeName(req.handoff_place_id)} />
        <Row label="Before" value={dayTime(req.deadline)} />
        {job.advance_amount > 0 && <Row label="Purchase advance (in your wallet)" value={naira(job.advance_amount)} />}
      </div>
    </Card>
  );
}

function Timeline({ job, req, events, placeName, isRequester }: {
  job: Tables<"jobs">; req: Tables<"requests">; events: Tables<"job_events">[]; placeName: (id: string | null) => string; isRequester: boolean;
}) {
  const at = (s: string) => events.find((e) => e.to_status === s)?.created_at;
  const steps: { label: string; sub?: string; done: boolean }[] = [
    { label: isRequester ? `Posted · ${naira(req.fee + req.item_budget)} held` : "Posted", sub: time(req.created_at), done: true },
    { label: "Accepted", sub: time(job.created_at), done: true },
  ];
  if (req.type === "buy") {
    const back = job.receipt_amount != null ? job.advance_amount - job.receipt_amount : 0;
    steps.push({
      label: job.receipt_amount != null ? `Bought · receipt ${naira(job.receipt_amount)}` : "Bought",
      sub: at("purchased") ? `${time(at("purchased"))}${back > 0 && isRequester ? ` · ${naira(back)} back to your wallet` : ""}` : undefined,
      done: Boolean(at("purchased")),
    });
  }
  steps.push({ label: `On the way to ${placeName(req.handoff_place_id)}`, sub: at("in_transit") ? time(at("in_transit")) : undefined, done: Boolean(at("in_transit")) });
  steps.push({ label: "Handed off", sub: at("completed") ? time(at("completed")) : undefined, done: job.status === "completed" });
  const current = steps.findIndex((s) => !s.done);

  return (
    <Card aria-label="Progress" className="flex flex-col">
      {steps.map((s, i) => (
        <div key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={cx("size-[18px] shrink-0 rounded-full box-border",
              s.done ? "bg-navy" : i === current ? "border-4 border-navy bg-white" : "border-2 border-[#C3CAD6] bg-white")} />
            {i < steps.length - 1 && <span className={cx("min-h-[18px] w-0.5 flex-1", s.done ? "bg-navy" : "bg-[#D3D9E3]")} />}
          </div>
          <div className="flex flex-col gap-px pb-3">
            <span className={cx("text-[14px]", s.done ? "font-semibold" : i === current ? "font-bold text-navy" : "font-medium text-muted")}>{s.label}</span>
            {s.sub && <span className="text-[12.5px] text-muted">{s.sub}</span>}
          </div>
        </div>
      ))}
    </Card>
  );
}

function TravelerActions({ job, req, onDone }: { job: Tables<"jobs">; req: Tables<"requests">; onDone: () => void }) {
  const [receipt, setReceipt] = useState<File[]>([]);
  const [amount, setAmount] = useState(String(job.advance_amount / 100));
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ error: unknown } | void>) {
    setError(null);
    setMsg(null);
    setBusy(key);
    try {
      const res = await fn();
      if (res && res.error) throw res.error;
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const needsPurchase = req.type === "buy" && job.status === "accepted";

  return (
    <div className="flex flex-col gap-3">
      {needsPurchase && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Bought it?</h2>
          <Field label="Receipt photo">
            <PhotoPicker files={receipt} onChange={setReceipt} max={1} capture="environment" label="Add receipt photo" />
          </Field>
          <Field label="Amount on the receipt (₦)" htmlFor="amt" hint={`Up to ${naira(job.advance_amount)}. Anything unused goes back to the requester. Costs more? Ask in chat first.`}>
            <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Button loading={busy === "buy"} disabled={!receipt.length || !toKobo(amount)}
            onClick={() => run("buy", async () => {
              const path = await uploadPhoto("receipts", receipt[0]!, job.id);
              return supabase().rpc("confirm_purchase", { p_job: job.id, p_receipt_path: path, p_receipt_amount: toKobo(amount)! });
            })}>
            Confirm purchase
          </Button>
          <Link href={`/jobs/${job.id}/chat`} className="text-center text-[14px] font-semibold text-navy">Price changed or out of stock? Tell them in chat</Link>
        </Card>
      )}

      {(job.status === "accepted" && req.type !== "buy") || job.status === "purchased" ? (
        <Button variant="dark" loading={busy === "go"} onClick={() => run("go", async () => supabase().rpc("start_delivery", { p_job: job.id }))}>
          I&apos;m on my way
        </Button>
      ) : null}

      {(job.status === "in_transit" || job.status === "purchased" || (job.status === "accepted" && req.type !== "buy")) && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Hand off</h2>
          <p className="text-[13.5px] text-muted">Ask for their 4-digit code after they&apos;ve checked the items. Entering it pays you {naira(earn(req.fee))}.</p>
          <CodeInput value={code} onChange={setCode} disabled={busy === "code"} />
          {msg && <Notice tone="amber">{msg}</Notice>}
          <Button loading={busy === "code"} disabled={code.length !== 4}
            onClick={() => run("code", async () => {
              const { data, error } = await supabase().rpc("submit_handoff_code", { p_job: job.id, p_code: code });
              if (error) return { error };
              const r = data as { ok: boolean; attempts_left: number; locked: boolean };
              if (!r.ok) {
                setCode("");
                setMsg(r.locked ? "Too many wrong codes. The job is locked and an admin will review it." : `Wrong code. ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left.`);
              }
            })}>
            Confirm handoff
          </Button>
        </Card>
      )}

      {job.status === "accepted" && (
        <ConfirmButton variant="outline" loading={busy === "release"} confirmLabel="Tap again to give this job back"
          onConfirm={() => run("release", async () => supabase().rpc("release_job", { p_job: job.id }))}>
          Can&apos;t do it? Give the job back
        </ConfirmButton>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function CancelJob({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmButton variant="outline" loading={busy} confirmLabel="Tap to confirm"
        onConfirm={async () => {
          setBusy(true);
          const { error } = await supabase().rpc("cancel_request", { p_request: requestId });
          setBusy(false);
          if (error) setError(errorMessage(error));
          else onDone();
        }}>
        Cancel
      </ConfirmButton>
      {error && <div className="col-span-2"><ErrorNote>{error}</ErrorNote></div>}
    </>
  );
}
