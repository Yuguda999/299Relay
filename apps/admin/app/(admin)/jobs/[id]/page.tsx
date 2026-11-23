"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Button, Card, Chip, ErrorNote, Field, Input, Loading, Notice, Pill, Row, Textarea, TypeBadge, cx } from "@/components/ui";
import { usePlaceName, useLoad, useSignedUrl } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { dayTime, JOB_STATUS_LABEL, LEDGER_REASON, naira, time, toKobo } from "@/lib/format";
import { supabase, type Tables } from "@/lib/supabase/client";

type Person = Pick<Tables<"profiles">, "id" | "full_name" | "email" | "strikes" | "rating_avg" | "jobs_carried" | "status">;

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const place = usePlaceName();

  const q = useLoad(async () => {
    const db = supabase();
    const { data: job } = await db.from("jobs")
      .select("*, request:requests(*), requester:profiles!jobs_requester_id_fkey(id, full_name, email, strikes, rating_avg, jobs_carried, status), traveler:profiles!jobs_traveler_id_fkey(id, full_name, email, strikes, rating_avg, jobs_carried, status)")
      .eq("id", id).single();
    if (!job) return null;
    const [events, messages, disputes, escrow, ledger] = await Promise.all([
      db.from("job_events").select("*").eq("job_id", id).order("id"),
      db.from("messages").select("*").eq("job_id", id).order("created_at"),
      db.from("disputes").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      db.from("ledger_accounts").select("balance").eq("kind", "job_escrow").eq("request_id", job.request_id).maybeSingle(),
      db.from("ledger_entries").select("id, direction, amount, reason, created_at, account:ledger_accounts(kind, profile_id)").eq("request_id", job.request_id).order("id"),
    ]);
    return {
      job, req: job.request!, requester: job.requester as Person, traveler: job.traveler as Person,
      events: events.data ?? [], messages: messages.data ?? [], disputes: disputes.data ?? [],
      escrow: escrow.data?.balance ?? 0, ledger: ledger.data ?? [],
    };
  }, [id]);

  if (q.loading) return <Loading />;
  if (!q.data) return <Notice tone="amber">Job not found.</Notice>;
  const { job, req, requester, traveler, events, messages, disputes, escrow, ledger } = q.data;
  const open = disputes.find((d) => d.status === "open");
  const name = (pid: string | null) => (pid === requester.id ? requester.full_name : pid === traveler.id ? traveler.full_name : "System");

  return (
    <>
      <PageTitle title={req.items_text.split(/[,\n]/)[0]!} sub={`Job ${job.id.slice(0, 8)} · created ${dayTime(job.created_at)}`}
        right={<Pill tone={job.status === "completed" ? "success" : job.status === "disputed" ? "danger" : "soft"}>{JOB_STATUS_LABEL[job.status]}</Pill>} />

      {open && <Resolve dispute={open} job={job} req={req} escrow={escrow} requester={requester} traveler={traveler} onDone={() => void q.reload()} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2.5 p-5">
          <div className="flex items-center gap-2"><TypeBadge type={req.type} urgent={req.urgent} /><span className="ml-auto text-[13px] text-muted">deadline {dayTime(req.deadline)}</span></div>
          <p className="font-semibold whitespace-pre-line">{req.items_text}</p>
          <Row label="Route" value={`${place(req.from_place_id)} → ${place(req.handoff_place_id)}`} />
          {req.type === "buy" && <Row label="Item budget / advance" value={`${naira(req.item_budget)} / ${naira(job.advance_amount)}`} />}
          {job.receipt_amount != null && <Row label="Receipt" value={naira(job.receipt_amount)} />}
          <Row label="Fee" value={naira(req.fee)} />
          <Row label="Still in escrow" value={naira(escrow)} strong />
          <Row label="Wrong code attempts" value={String(job.code_attempts)} />
          <div className="flex flex-wrap gap-3 pt-1">
            {req.photo_path && <Photo bucket="request-photos" path={req.photo_path} label="Request photo" />}
            {job.receipt_path && <Photo bucket="receipts" path={job.receipt_path} label="Receipt" />}
          </div>
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          {[["Requester", requester], ["Traveler", traveler]].map(([label, p]) => {
            const person = p as Person;
            return (
              <div key={label as string} className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[12px] font-semibold text-muted uppercase">{label as string}</span>
                  <Link href={`/users/${person.id}`} className="font-semibold text-navy">{person.full_name}</Link>
                  <span className="text-[12.5px] text-muted">{person.email}</span>
                </div>
                <div className="flex gap-1.5">{person.strikes > 0 && <Pill tone="danger">{person.strikes} strike{person.strikes > 1 ? "s" : ""}</Pill>}{person.status !== "verified" && <Pill tone="amber">{person.status}</Pill>}</div>
              </div>
            );
          })}
          <h3 className="pt-2 text-[13px] font-bold">Timeline</h3>
          <ol className="flex flex-col gap-1.5 text-[13px]">
            <li><span className="text-muted">{dayTime(req.created_at)}</span> · posted</li>
            {events.map((e) => (
              <li key={e.id}><span className="text-muted">{dayTime(e.created_at)}</span> · {e.from_status ? `${e.from_status} → ` : ""}{e.to_status}{e.note ? ` (${e.note})` : ""} · {name(e.actor_id)}</li>
            ))}
          </ol>
        </Card>
      </div>

      {disputes.map((d) => (
        <Card key={d.id} className="flex flex-col gap-2 p-5">
          <div className="flex items-center gap-2">
            <span className="font-bold">Report: {d.reason}</span>
            <Pill tone={d.status === "open" ? "amber" : "success"}>{d.status}{d.resolution ? ` · ${d.resolution}` : ""}</Pill>
            <span className="ml-auto text-[12.5px] text-muted">by {name(d.reporter_id)} · {dayTime(d.created_at)}</span>
          </div>
          {d.details && <p className="text-[14px] whitespace-pre-line">{d.details}</p>}
          <div className="flex flex-wrap gap-3">{d.photo_paths.map((p) => <Photo key={p} bucket="job-photos" path={p} label="Evidence" />)}</div>
          {d.status === "resolved" && <p className="text-[13px] text-muted">To requester {naira(d.to_requester)} · to traveler {naira(d.to_traveler)}{d.admin_note ? ` · “${d.admin_note}”` : ""}</p>}
        </Card>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex max-h-[520px] flex-col gap-2 overflow-y-auto p-5">
          <h3 className="text-[13px] font-bold">Chat</h3>
          {messages.length ? messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-0.5 text-[13.5px]">
              <span className="text-[11.5px] text-muted">{name(m.sender_id)} · {time(m.created_at)}</span>
              {m.kind === "photo" ? <Photo bucket="job-photos" path={m.photo_path} label="Chat photo" />
                : m.kind === "substitute" ? <span className="font-semibold">Price change → {naira(m.substitute_amount)} ({m.decision}): {m.body}</span>
                : <span className={cx(m.kind === "system" && "text-muted italic")}>{m.body}</span>}
            </div>
          )) : <span className="text-[13px] text-muted">No messages.</span>}
        </Card>
        <Card className="flex flex-col gap-1.5 p-5">
          <h3 className="text-[13px] font-bold">Money movements</h3>
          {ledger.filter((e) => e.direction === "credit").map((e) => (
            <div key={e.id} className="flex justify-between gap-2 text-[13px]">
              <span>{LEDGER_REASON[e.reason] ?? e.reason} <span className="text-muted">→ {e.account?.kind === "user_available" ? name(e.account.profile_id) : e.account?.kind?.replace("_", " ")}</span></span>
              <span className="font-semibold">{naira(e.amount)}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

function Photo({ bucket, path, label }: { bucket: string; path: string | null; label: string }) {
  const url = useSignedUrl(bucket, path);
  if (!url) return <div className="size-28 rounded-lg bg-tab" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="size-28 rounded-lg object-cover" /></a>;
}

function Resolve({ dispute, job, req, escrow, requester, traveler, onDone }: {
  dispute: Tables<"disputes">; job: Tables<"jobs">; req: Tables<"requests">; escrow: number; requester: Person; traveler: Person; onDone: () => void;
}) {
  const [resolution, setResolution] = useState<"refund" | "release" | "split">("refund");
  const [toRequester, setToRequester] = useState("");
  const [clawback, setClawback] = useState("");
  const [strike, setStrike] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const splitKobo = resolution === "split" ? (toKobo(toRequester) ?? 0) : resolution === "refund" ? escrow : 0;
  const clawKobo = toKobo(clawback) ?? 0;
  const toTraveler = escrow - splitKobo;

  async function submit() {
    if (!note.trim()) return setError("Write a short note. Both students see it.");
    setError(null);
    setBusy(true);
    const { error } = await supabase().rpc("resolve_dispute", {
      p_dispute: dispute.id, p_resolution: resolution,
      p_to_requester: resolution === "split" ? splitKobo : undefined,
      p_clawback: clawKobo, p_strike: strike || undefined, p_note: note,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    onDone();
  }

  return (
    <Card className="flex flex-col gap-4 border-orange p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[17px] font-bold">Resolve dispute</h2>
        <span className="text-[13px] text-muted">{naira(escrow)} in escrow{job.advance_amount > 0 ? ` · traveler already received a ${naira(job.advance_amount)} advance` : ""}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip on={resolution === "refund"} onClick={() => setResolution("refund")}>Refund requester</Chip>
        <Chip on={resolution === "release"} onClick={() => setResolution("release")}>Release to traveler</Chip>
        <Chip on={resolution === "split"} onClick={() => setResolution("split")}>Split</Chip>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {resolution === "split" && (
          <Field label="Escrow to requester (₦)" htmlFor="split" hint={`The rest (${naira(Math.max(0, toTraveler))}) goes to the traveler, minus commission.`}>
            <Input id="split" inputMode="decimal" value={toRequester} onChange={(e) => setToRequester(e.target.value)} />
          </Field>
        )}
        <Field label="Claw back from traveler's wallet (₦)" htmlFor="claw" hint="E.g. an advance spent on the wrong item. Goes to the requester.">
          <Input id="claw" inputMode="decimal" value={clawback} onChange={(e) => setClawback(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Strike" htmlFor="strike" hint="3 upheld strikes suspend the account.">
          <select id="strike" value={strike} onChange={(e) => setStrike(e.target.value)} className="min-h-12 rounded-xl border border-field bg-white px-3">
            <option value="">No strike</option>
            <option value={requester.id}>Requester · {requester.full_name} ({requester.strikes})</option>
            <option value={traveler.id}>Traveler · {traveler.full_name} ({traveler.strikes})</option>
          </select>
        </Field>
      </div>
      <Field label="Note to both students" htmlFor="note">
        <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Notice>
        Requester gets {naira(splitKobo + clawKobo)} · traveler gets {naira(Math.max(0, toTraveler) - (toTraveler > 0 ? Math.min(Math.floor((req.fee * 0.15) / 100) * 100, toTraveler) : 0) - clawKobo)} net
      </Notice>
      <ErrorNote>{error}</ErrorNote>
      <Button loading={busy} onClick={submit} className="self-start">Resolve</Button>
    </Card>
  );
}
