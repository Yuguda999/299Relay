"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CodeInput, PhotoPicker, StoredImage } from "@/components/app-bits";
import { DocumentsCard } from "@/components/print";
import { Icon } from "@/components/icons";
import { Alert, Avatar, Button, ButtonLink, Card, Field, Footer, Header, Loading, MoneyInput, Page, Row, StatusChip, Tile, cn, useNotify } from "@/components/ui";
import { displayName, fetchPublicProfiles, ratingLine, uploadPhoto, useLoad, useRealtime } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { dayTime, earn, isPurchase, JOB_STATUS_LABEL, naira, time, toKobo, TYPE_LABEL } from "@/lib/format";
import type { PrintOptions } from "@/lib/print";
import { useSession } from "@/lib/session";
import { supabase, type Tables } from "@/lib/supabase/client";

const LIVE = ["accepted", "purchased", "in_transit"];

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, placeName, refresh } = useSession();
  const { confirm, toast } = useNotify();

  const q = useLoad(async () => {
    const db = supabase();
    const { data: job } = await db.from("jobs").select("*").eq("id", id).single();
    if (!job) return null;
    const [{ data: req }, { data: events }, { data: code }, { data: ratings }, { data: disputes }, people, { data: files }] = await Promise.all([
      db.from("requests").select("*").eq("id", job.request_id).single(),
      db.from("job_events").select("*").eq("job_id", id).order("id"),
      db.from("job_handoff_codes").select("code").eq("job_id", id).maybeSingle(),
      db.from("ratings").select("rater_id").eq("job_id", id),
      db.from("disputes").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      fetchPublicProfiles([job.requester_id, job.traveler_id]),
      db.from("request_files").select("*").eq("request_id", job.request_id).order("created_at"),
    ]);
    return { job, req: req!, events: events ?? [], code: code?.code ?? null, ratings: ratings ?? [], disputes: disputes ?? [], people, files: files ?? [] };
  }, [id]);
  useRealtime(`job:${id}`, [{ table: "jobs", filter: `id=eq.${id}` }], () => { void q.reload(); void refresh(); });

  if (q.loading) return <><Header title="Job" back="/jobs" /><Page><Loading /></Page></>;
  if (!q.data) return <><Header title="Job" back="/jobs" /><Page><Alert tone="warn">Job not found.</Alert></Page></>;

  const { job, req, events, code, ratings, disputes, people, files } = q.data;
  const isRequester = job.requester_id === profile?.id;
  const other = people.get(isRequester ? job.traveler_id : job.requester_id);
  const rated = ratings.some((r) => r.rater_id === profile?.id);
  const live = LIVE.includes(job.status);
  const openDispute = disputes.find((d) => d.status === "open");
  const firstName = displayName(other).split(" ")[0];

  async function cancel() {
    const ok = await confirm({ title: "Cancel this job?", body: "The traveler hasn't bought anything yet. Everything held goes back to your wallet.", confirmLabel: "Cancel job", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase().rpc("cancel_request", { p_request: req.id });
    if (error) return toast({ title: "Couldn't cancel", body: errorMessage(error), tone: "critical" });
    toast({ title: "Job cancelled", body: "Your money is back in your wallet." });
    void q.reload();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={titleOf(req.items_text)} subtitle={`${TYPE_LABEL[req.type]} · to ${placeName(req.handoff_place_id)}`} back="/jobs"
        right={<StatusChip tone={job.status === "completed" ? "ok" : job.status === "disputed" ? "critical" : live ? "live" : "muted"}>{JOB_STATUS_LABEL[job.status]}</StatusChip>} />
      <Page>
        {job.status === "disputed" && <Alert tone="warn" title="Issue under review">Payment is paused while an admin reviews it, usually within 24 hours.</Alert>}
        {job.status === "refunded" && <Alert tone="info">This job was refunded after review.</Alert>}
        {job.status === "cancelled" && <Alert tone="info">This job was cancelled. Held money went back to the wallet it came from.</Alert>}
        {openDispute && job.status === "completed" && <Alert tone="warn">Your report is with an admin.</Alert>}

        {isRequester && live && code && (
          <section aria-label="Handoff code" className="entrance hero flex flex-col gap-3 rounded-card p-5">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase opacity-75">Your handoff code</span>
            <div className="grid grid-cols-4 gap-2">
              {code.split("").map((d, i) => (
                <span key={i} className="grid h-16 place-items-center rounded-2xl bg-sheet font-mono text-[34px] font-medium text-foreground tabular">{d}</span>
              ))}
            </div>
            <span className="text-[13px] leading-relaxed opacity-80">Show it to {firstName} only after you&apos;ve checked your items. Entering it releases their fee.</span>
          </section>
        )}

        <Card i={1} className="flex items-center gap-3 py-3">
          <Avatar name={displayName(other)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14.5px] font-semibold">{displayName(other)}</span>
            <span className="truncate text-[12.5px] text-ink-2">{isRequester ? ratingLine(other) : other?.hostel ? `Requester · ${other.hostel}` : "Requester"}</span>
          </div>
          <ButtonLink href={`/jobs/${id}/chat`} variant="surface" size="sm"><Icon name="chat" className="size-4" />Chat</ButtonLink>
        </Card>

        {!isRequester && req.type === "print" && <DocumentsCard i={1} files={files} options={req.print_options as PrintOptions | null} canOpen />}
        {!isRequester && <TravelerDetails job={job} req={req} placeName={placeName} />}
        {isRequester && req.type === "print" && <DocumentsCard i={2} files={files} options={req.print_options as PrintOptions | null} canOpen />}
        {job.receipt_amount != null && <ReceiptCard job={job} isRequester={isRequester} boughtAt={events.find((e) => e.to_status === "purchased")?.created_at} />}
        <Timeline job={job} req={req} events={events} placeName={placeName} isRequester={isRequester} />
        {!isRequester && live && <TravelerActions job={job} req={req} onDone={() => { void q.reload(); void refresh(); }} />}
      </Page>

      {(live || (job.status === "completed" && (!rated || !openDispute))) && (
        <Footer>
          {job.status === "completed" && !rated && <ButtonLink href={`/jobs/${id}/rate`}>{isRequester ? "Rate and tip" : "Rate the requester"}</ButtonLink>}
          <div className="flex gap-2.5">
            {(live || (job.status === "completed" && !openDispute)) && (
              <ButtonLink href={`/jobs/${id}/report`} variant="surface" size="pill" className="flex-1"><Icon name="flag" className="size-4" />Report issue</ButtonLink>
            )}
            {isRequester && job.status === "accepted" && <Button variant="destructive" size="pill" className="flex-1" onClick={cancel}>Cancel job</Button>}
          </div>
        </Footer>
      )}
    </div>
  );
}

function titleOf(items: string) {
  const first = items.split(/[,\n]/)[0]!.trim();
  return first.length > 30 ? first.slice(0, 28) + "…" : first;
}

function TravelerDetails({ job, req, placeName }: { job: Tables<"jobs">; req: Tables<"requests">; placeName: (id: string | null) => string }) {
  return (
    <Card i={2} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] leading-snug font-semibold whitespace-pre-line">{req.items_text}</p>
        <span className="flex shrink-0 flex-col items-end"><span className="readout">You earn</span><span className="font-display text-[20px] font-semibold tabular">{naira(earn(req.fee))}</span></span>
      </div>
      {req.photo_path && <StoredImage bucket="request-photos" path={req.photo_path} alt="Request photo" className="h-40 w-full" />}
      <Tile className="flex flex-col gap-2">
        <Row label={req.type === "buy" ? "Buy at" : req.type === "print" ? "Print at" : "Pick up at"} value={placeName(req.from_place_id)} />
        <Row label="Hand off at" value={placeName(req.handoff_place_id)} />
        <Row label="Before" value={dayTime(req.deadline)} />
        {job.advance_amount > 0 && <Row label="Advance in your wallet" value={naira(job.advance_amount)} />}
      </Tile>
    </Card>
  );
}

function ReceiptCard({ job, isRequester, boughtAt }: { job: Tables<"jobs">; isRequester: boolean; boughtAt?: string }) {
  const back = job.receipt_amount != null ? job.advance_amount - job.receipt_amount : 0;
  return (
    <Card id="receipt" i={2} className="flex scroll-mt-20 gap-4">
      {job.receipt_path
        ? <StoredImage bucket="receipts" path={job.receipt_path} alt="Receipt" zoom className="h-28 w-24 shrink-0" />
        : <div className="grid h-28 w-24 shrink-0 place-items-center rounded-2xl bg-card-nested px-2 text-center text-[11.5px] leading-tight text-ink-2 dark:ring-1 dark:ring-glass-border">No receipt photo</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 className="readout">Amount spent</h2>
        <span className="font-display text-kpi-sm font-semibold tabular">{naira(job.receipt_amount)}</span>
        {back > 0 && <span className="text-[13px] text-ink-2"><span className="tabular">{naira(back)}</span> unused budget {isRequester ? "returned to your wallet" : "returned to the requester"}</span>}
        {boughtAt && <span className="font-mono text-[11px] text-ink-2 tabular">Bought {time(boughtAt)}</span>}
        {job.receipt_path && <span className="text-[12px] text-ink-3">Tap the photo to view it full size.</span>}
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
  if (isPurchase(req.type)) {
    const back = job.receipt_amount != null ? job.advance_amount - job.receipt_amount : 0;
    steps.push({
      label: (req.type === "print" ? "Printed" : "Bought") + (job.receipt_amount != null ? ` · ${naira(job.receipt_amount)}` : ""),
      sub: at("purchased") ? `${time(at("purchased"))}${back > 0 && isRequester ? ` · ${naira(back)} back to your wallet` : ""}` : undefined,
      done: Boolean(at("purchased")),
    });
  }
  steps.push({ label: `On the way to ${placeName(req.handoff_place_id)}`, sub: at("in_transit") ? time(at("in_transit")) : undefined, done: Boolean(at("in_transit")) });
  steps.push({ label: "Handed off", sub: at("completed") ? time(at("completed")) : undefined, done: job.status === "completed" });
  const current = steps.findIndex((s) => !s.done);

  return (
    <Card i={3} aria-label="Progress" className="flex flex-col pb-2">
      <h2 className="readout mb-3">Progress</h2>
      <ol>
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("relative grid size-5 shrink-0 place-items-center rounded-full",
                s.done ? "bg-inverse text-inverse-foreground" : i === current ? "bg-signal-soft ring-2 ring-signal" : "ring-2 ring-border")}>
                {s.done && <Icon name="check" className="size-3" strokeWidth={3} />}
                {i === current && <span className="size-2 rounded-full bg-signal" />}
              </span>
              {i < steps.length - 1 && <span className={cn("my-1 min-h-5 w-0.5 flex-1 rounded-full", s.done ? "bg-inverse" : "bg-border")} />}
            </div>
            <div className="flex flex-col pb-4">
              <span className={cn("text-[14px] leading-5", s.done ? "font-medium" : i === current ? "font-semibold" : "text-ink-2")}>{s.label}</span>
              {s.sub && <span className="font-mono text-[11px] tracking-wide text-ink-2 tabular">{s.sub}</span>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function TravelerActions({ job, req, onDone }: { job: Tables<"jobs">; req: Tables<"requests">; onDone: () => void }) {
  const { confirm, toast } = useNotify();
  const [receipt, setReceipt] = useState<File[]>([]);
  const [amount, setAmount] = useState(String(job.advance_amount / 100));
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ error: unknown } | void>, success?: () => void) {
    setError(null);
    setBusy(key);
    try {
      const res = await fn();
      if (res && res.error) throw res.error;
      success?.();
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const needsPurchase = isPurchase(req.type) && job.status === "accepted";
  const canHandOff = job.status === "in_transit" || job.status === "purchased" || (job.status === "accepted" && !isPurchase(req.type));
  const canStart = (job.status === "accepted" && !isPurchase(req.type)) || job.status === "purchased";

  return (
    <div className="flex flex-col gap-3">
      {needsPurchase && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{req.type === "print" ? "Done printing?" : "Done buying?"}</h2>
            <p className="text-[13px] text-ink-2">Enter what you actually spent. Any unused budget goes straight back to the requester.</p>
          </div>
          <Field label="Amount spent" htmlFor="amt" hint={<>Up to <span className="tabular">{naira(job.advance_amount)}</span>. Costs more? Ask in chat first.</>}>
            <MoneyInput id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Receipt photo" optional hint="If the shop gave you one. It helps if there's ever a question.">
            <PhotoPicker files={receipt} onChange={setReceipt} max={1} capture="environment" label="Receipt" />
          </Field>
          <Button loading={busy === "buy"} disabled={!toKobo(amount)}
            onClick={() => run("buy", async () => {
              const path = receipt[0] ? await uploadPhoto("receipts", receipt[0], job.id) : null;
              return supabase().rpc("confirm_purchase", { p_job: job.id, p_receipt_path: path as string /* null = no receipt photo; the SQL accepts it */, p_receipt_amount: toKobo(amount)! });
            }, () => toast({ title: req.type === "print" ? "Printing confirmed" : "Purchase confirmed" }))}>
            Confirm {naira(toKobo(amount) ?? 0)} spent
          </Button>
          <Link href={`/jobs/${job.id}/chat`} className="text-center text-[13.5px] font-semibold text-signal-ink">
            {req.type === "print" ? "Costs more or a file won't open? Tell them in chat" : "Price changed or out of stock? Tell them in chat"}
          </Link>
        </Card>
      )}

      {canStart && (
        <Button variant="inverse" loading={busy === "go"}
          onClick={() => run("go", async () => supabase().rpc("start_delivery", { p_job: job.id }), () => toast({ title: "On your way", body: "The requester has been told." }))}>
          <Icon name="walk" className="size-[18px]" />I&apos;m on my way
        </Button>
      )}

      {canHandOff && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">Hand off</h2>
            <p className="text-[13px] text-ink-2">Ask for their 4-digit code after they&apos;ve checked the items. It pays you <span className="font-semibold text-foreground tabular">{naira(earn(req.fee))}</span>.</p>
          </div>
          <CodeInput value={code} onChange={(v) => { setCode(v); setCodeMsg(null); }} disabled={busy === "code"} invalid={Boolean(codeMsg)} />
          <Alert tone="warn">{codeMsg}</Alert>
          <Button loading={busy === "code"} disabled={code.length !== 4}
            onClick={() => run("code", async () => {
              const { data, error } = await supabase().rpc("submit_handoff_code", { p_job: job.id, p_code: code });
              if (error) return { error };
              const r = data as { ok: boolean; attempts_left: number; locked: boolean };
              if (r.ok) toast({ title: "Delivered", body: `${naira(earn(req.fee))} added to your wallet.` });
              else {
                setCode("");
                setCodeMsg(r.locked ? "Too many wrong codes. The job is locked and an admin will review it." : `Wrong code. ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left.`);
              }
            })}>
            Confirm handoff
          </Button>
        </Card>
      )}

      {job.status === "accepted" && (
        <Button variant="ghost" size="pill" loading={busy === "release"}
          onClick={async () => {
            const ok = await confirm({ title: "Give this job back?", body: "It goes back to the open feed. Any advance returns from your wallet.", confirmLabel: "Give it back", tone: "danger" });
            if (ok) await run("release", async () => supabase().rpc("release_job", { p_job: job.id }), () => toast({ title: "Job released" }));
          }}>
          Can&apos;t do it? Give the job back
        </Button>
      )}
      <Alert tone="critical">{error}</Alert>
    </div>
  );
}
