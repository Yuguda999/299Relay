"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Alert, Button, Card, ChoiceChips, Field, Loading, MoneyInput, Row, Select, StatusChip, Textarea, Tile, cn, useNotify, type ChipTone } from "@/components/ui";
import { usePlaceName, useLoad, useSignedUrl } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { dayTime, JOB_STATUS_LABEL, LEDGER_REASON, naira, time, toKobo, TYPE_LABEL } from "@/lib/format";
import { supabase, type Tables } from "@/lib/supabase/client";

type Person = Pick<Tables<"profiles">, "id" | "full_name" | "email" | "strikes" | "rating_avg" | "jobs_carried" | "status">;
const TONE: Record<string, ChipTone> = { completed: "ok", disputed: "critical", accepted: "live", purchased: "live", in_transit: "live" };

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const place = usePlaceName();

  const q = useLoad(async () => {
    const db = supabase();
    const { data: job } = await db.from("jobs")
      .select("*, request:requests(*), requester:profiles!jobs_requester_id_fkey(id, full_name, email, strikes, rating_avg, jobs_carried, status), traveler:profiles!jobs_traveler_id_fkey(id, full_name, email, strikes, rating_avg, jobs_carried, status)")
      .eq("id", id).single();
    if (!job) return null;
    const [events, messages, disputes, escrow, ledger, files] = await Promise.all([
      db.from("job_events").select("*").eq("job_id", id).order("id"),
      db.from("messages").select("*").eq("job_id", id).order("created_at"),
      db.from("disputes").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      db.from("ledger_accounts").select("balance").eq("kind", "job_escrow").eq("request_id", job.request_id).maybeSingle(),
      db.from("ledger_entries").select("id, direction, amount, reason, created_at, account:ledger_accounts(kind, profile_id)").eq("request_id", job.request_id).order("id"),
      db.from("request_files").select("*").eq("request_id", job.request_id).order("created_at"),
    ]);
    return {
      job, req: job.request!, requester: job.requester as Person, traveler: job.traveler as Person,
      events: events.data ?? [], messages: messages.data ?? [], disputes: disputes.data ?? [],
      escrow: escrow.data?.balance ?? 0, ledger: ledger.data ?? [], files: files.data ?? [],
    };
  }, [id]);

  if (q.loading) return <Loading />;
  if (!q.data) return <Alert tone="warn">Job not found.</Alert>;
  const { job, req, requester, traveler, events, messages, disputes, escrow, ledger, files } = q.data;
  const open = disputes.find((d) => d.status === "open");
  const name = (pid: string | null) => (pid === requester.id ? requester.full_name : pid === traveler.id ? traveler.full_name : "System");

  return (
    <>
      <PageTitle title={req.items_text.split(/[,\n]/)[0]!} sub={`Job ${job.id.slice(0, 8)} · ${TYPE_LABEL[req.type]} · created ${dayTime(job.created_at)}`}
        right={<StatusChip tone={TONE[job.status] ?? "muted"}>{JOB_STATUS_LABEL[job.status]}</StatusChip>} />

      {open && <Resolve dispute={open} job={job} req={req} escrow={escrow} requester={requester} traveler={traveler} onDone={() => void q.reload()} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card i={0} className="flex flex-col gap-3 p-5">
          <h2 className="readout">Request</h2>
          <p className="font-semibold whitespace-pre-line">{req.items_text}</p>
          <Tile className="flex flex-col gap-2">
            <Row label="Route" value={`${place(req.from_place_id)} → ${place(req.handoff_place_id)}`} />
            <Row label="Deadline" value={dayTime(req.deadline)} />
            {req.type === "buy" && <Row label="Budget / advance" value={`${naira(req.item_budget)} / ${naira(job.advance_amount)}`} />}
            {job.receipt_amount != null && <Row label="Receipt" value={naira(job.receipt_amount)} />}
            <Row label="Fee" value={naira(req.fee)} />
            <Row label="Wrong code attempts" value={String(job.code_attempts)} />
            <Row label="Still in escrow" value={naira(escrow)} strong />
          </Tile>
          {files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="readout">Documents{req.print_options ? ` · ${JSON.stringify(req.print_options).replace(/[{}"]/g, "").replaceAll(",", " · ")}` : ""}</span>
              {files.map((f) => <DocLink key={f.id} path={f.path} name={f.name} pages={f.pages} />)}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {req.photo_path && <Photo bucket="request-photos" path={req.photo_path} label="Request photo" />}
            {job.receipt_path && <Photo bucket="receipts" path={job.receipt_path} label="Receipt" />}
          </div>
        </Card>
        <Card i={1} className="flex flex-col gap-4 p-5">
          {([["Requester", requester], ["Traveler", traveler]] as const).map(([label, p]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="readout">{label}</span>
                <Link href={`/users/${p.id}`} className="font-semibold text-foreground underline-offset-2 hover:underline">{p.full_name}</Link>
                <span className="text-[12.5px] text-ink-2">{p.email}</span>
              </div>
              <div className="flex gap-1.5">
                {p.strikes > 0 && <StatusChip tone="critical">{p.strikes} strike{p.strikes > 1 ? "s" : ""}</StatusChip>}
                {p.status !== "verified" && <StatusChip tone="warn">{p.status}</StatusChip>}
              </div>
            </div>
          ))}
          <h3 className="readout pt-1">Timeline</h3>
          <ol className="flex flex-col gap-2 text-[13px]">
            <li className="flex gap-3"><span className="w-28 shrink-0 font-mono text-[11.5px] text-ink-2 tabular">{dayTime(req.created_at)}</span>Posted</li>
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-28 shrink-0 font-mono text-[11.5px] text-ink-2 tabular">{dayTime(e.created_at)}</span>
                <span>{e.from_status ? `${e.from_status} → ` : ""}{e.to_status}{e.note ? ` · ${e.note}` : ""} <span className="text-ink-2">· {name(e.actor_id)}</span></span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {disputes.map((d, i) => (
        <Card key={d.id} i={i + 2} className="flex flex-col gap-2 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Report: {d.reason}</span>
            <StatusChip tone={d.status === "open" ? "warn" : "ok"}>{d.status}{d.resolution ? ` · ${d.resolution}` : ""}</StatusChip>
            <span className="ml-auto font-mono text-[11.5px] text-ink-2">by {name(d.reporter_id)} · {dayTime(d.created_at)}</span>
          </div>
          {d.details && <p className="text-[14px] whitespace-pre-line">{d.details}</p>}
          <div className="flex flex-wrap gap-3">{d.photo_paths.map((p) => <Photo key={p} bucket="job-photos" path={p} label="Evidence" />)}</div>
          {d.status === "resolved" && <p className="text-[13px] text-ink-2">To requester <span className="tabular">{naira(d.to_requester)}</span> · to traveler <span className="tabular">{naira(d.to_traveler)}</span>{d.admin_note ? ` · “${d.admin_note}”` : ""}</p>}
        </Card>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex max-h-[520px] flex-col gap-3 overflow-y-auto p-5">
          <h3 className="readout">Chat</h3>
          {messages.length ? messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-0.5 text-[13.5px]">
              <span className="font-mono text-[11px] text-ink-2">{name(m.sender_id)} · <span className="tabular">{time(m.created_at)}</span></span>
              {m.kind === "photo" ? <Photo bucket="job-photos" path={m.photo_path} label="Chat photo" />
                : m.kind === "substitute" ? <span className="font-semibold">Price change → {naira(m.substitute_amount)} ({m.decision}): {m.body}</span>
                : <span className={cn(m.kind === "system" && "text-ink-2 italic")}>{m.body}</span>}
            </div>
          )) : <span className="text-[13px] text-ink-2">No messages.</span>}
        </Card>
        <Card className="flex flex-col gap-2 p-5">
          <h3 className="readout">Money movements</h3>
          {ledger.filter((e) => e.direction === "credit").map((e) => (
            <div key={e.id} className="flex justify-between gap-2 text-[13px]">
              <span>{LEDGER_REASON[e.reason] ?? e.reason} <span className="text-ink-2">→ {e.account?.kind === "user_available" ? name(e.account.profile_id) : e.account?.kind?.replaceAll("_", " ")}</span></span>
              <span className="font-semibold tabular">{naira(e.amount)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function DocLink({ path, name, pages }: { path: string; name: string; pages: number | null }) {
  const url = useSignedUrl("documents", path);
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!url}
      className="flex items-center justify-between gap-2 rounded-[14px] bg-card-nested px-3 py-2 text-[13px] no-underline hover:underline">
      <span className="truncate font-medium text-foreground">{name}</span>
      <span className="shrink-0 font-mono text-[11px] text-ink-2">{pages ? `${pages} pages` : ""}{url === null ? " · missing" : ""}</span>
    </a>
  );
}

function Photo({ bucket, path, label }: { bucket: string; path: string | null; label: string }) {
  const url = useSignedUrl(bucket, path);
  if (url === null) return <div className="grid size-28 place-items-center rounded-[14px] bg-card-nested text-center text-[11px] text-ink-2">Not available</div>;
  if (!url) return <div className="skeleton size-28 rounded-[14px]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={url} target="_blank" rel="noreferrer" className="rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring"><img src={url} alt={label} className="size-28 rounded-[14px] object-cover" /></a>;
}

function Resolve({ dispute, job, req, escrow, requester, traveler, onDone }: {
  dispute: Tables<"disputes">; job: Tables<"jobs">; req: Tables<"requests">; escrow: number; requester: Person; traveler: Person; onDone: () => void;
}) {
  const { confirm, toast } = useNotify();
  const [resolution, setResolution] = useState<"refund" | "release" | "split">("refund");
  const [toRequester, setToRequester] = useState("");
  const [clawback, setClawback] = useState("");
  const [strike, setStrike] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const splitKobo = resolution === "split" ? (toKobo(toRequester) ?? 0) : resolution === "refund" ? escrow : 0;
  const clawKobo = toKobo(clawback) ?? 0;
  const toTraveler = Math.max(0, escrow - splitKobo);
  const commission = toTraveler > 0 ? Math.min(Math.floor((req.fee * 0.15) / 100) * 100, toTraveler) : 0;
  const travelerNet = toTraveler - commission - clawKobo;

  async function submit() {
    if (!note.trim()) return setError("Write a short note. Both students see it.");
    if (resolution === "split" && splitKobo > escrow) return setError(`Split can't exceed ${naira(escrow)}.`);
    setError(null);
    const ok = await confirm({ title: `Resolve: ${resolution}?`, body: `Requester gets ${naira(splitKobo + clawKobo)}, traveler nets ${naira(travelerNet)}. This moves money and can't be undone here.`, confirmLabel: "Resolve" });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase().rpc("resolve_dispute", {
      p_dispute: dispute.id, p_resolution: resolution, p_to_requester: resolution === "split" ? splitKobo : undefined,
      p_clawback: clawKobo, p_strike: strike || undefined, p_note: note,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast({ title: "Dispute resolved", body: "Both students have been told." });
    onDone();
  }

  return (
    <Card className="flex flex-col gap-4 p-5 ring-1 ring-signal/40">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Resolve dispute</h2>
        <span className="text-[13px] text-ink-2"><span className="tabular">{naira(escrow)}</span> in escrow{job.advance_amount > 0 ? <> · traveler already received a <span className="tabular">{naira(job.advance_amount)}</span> advance</> : ""}</span>
      </div>
      <ChoiceChips aria-label="Resolution" value={resolution} onChange={setResolution}
        options={[{ value: "refund", label: "Refund requester" }, { value: "release", label: "Release to traveler" }, { value: "split", label: "Split" }]} />
      <div className="grid gap-4 md:grid-cols-3">
        {resolution === "split" && (
          <Field label="Escrow to requester" htmlFor="split" hint={<>The rest goes to the traveler, minus commission.</>}>
            <MoneyInput id="split" value={toRequester} onChange={(e) => setToRequester(e.target.value)} />
          </Field>
        )}
        <Field label="Take back from traveler" htmlFor="claw" hint="E.g. an advance spent on the wrong item. Goes to the requester.">
          <MoneyInput id="claw" value={clawback} onChange={(e) => setClawback(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Strike" labelId="strike-l" hint="3 upheld strikes suspend the account.">
          <Select aria-labelledby="strike-l" value={strike} onChange={setStrike} placeholder="No strike"
            options={[{ value: "", label: "No strike" },
              { value: requester.id, label: `Requester · ${requester.full_name}`, hint: `${requester.strikes} so far` },
              { value: traveler.id, label: `Traveler · ${traveler.full_name}`, hint: `${traveler.strikes} so far` }]} />
        </Field>
      </div>
      <Field label="Note to both students" htmlFor="note">
        <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Tile className="flex flex-col gap-1.5">
        <Row label="Requester receives" value={naira(splitKobo + clawKobo)} />
        <Row label="Traveler nets" value={naira(travelerNet)} />
        <Row label="Platform commission" value={naira(commission)} />
      </Tile>
      <Alert tone="critical">{error}</Alert>
      <Button size="pill" loading={busy} onClick={submit} className="self-end">Resolve</Button>
    </Card>
  );
}
