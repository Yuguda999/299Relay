"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerifiedOnly } from "@/components/gate";
import { Button, Chip, ErrorNote, Field, Footer, Header, Input, Page, Select, Textarea } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { lagosToIso, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase, type Enums } from "@/lib/supabase/client";

const ALL: Enums<"request_type">[] = ["buy", "pick_up", "drop_off"];

export default function PostTrip() {
  const router = useRouter();
  const { places } = useSession();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [day, setDay] = useState<0 | 1>(0);
  const [leaves, setLeaves] = useState("16:00");
  const [back, setBack] = useState("17:30");
  const [capacity, setCapacity] = useState(2);
  const [types, setTypes] = useState<Enums<"request_type">[]>(ALL);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!from || !to || from === to) return setError("Pick two different places.");
    if (!types.length) return setError("Pick at least one kind of job.");
    setBusy(true);
    const { data, error } = await supabase().rpc("create_trip", {
      p_from_place: from, p_to_place: to,
      p_leaves_at: lagosToIso(day, leaves), p_back_by: lagosToIso(day, back),
      p_capacity: capacity, p_job_types: types, p_note: note || undefined,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    router.replace(`/trips/${data.id}`);
  }

  return (
    <VerifiedOnly title="Post a trip">
      <form onSubmit={submit} className="flex min-h-dvh flex-col">
        <Header title="Post a trip" />
        <Page className="gap-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="From" htmlFor="from">
              <Select id="from" value={from} onChange={(e) => setFrom(e.target.value)} required>
                <option value="">Choose</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Going to" htmlFor="to">
              <Select id="to" value={to} onChange={(e) => setTo(e.target.value)} required>
                <option value="">Choose</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex gap-2">
            <Chip on={day === 0} onClick={() => setDay(0)}>Today</Chip>
            <Chip on={day === 1} onClick={() => setDay(1)}>Tomorrow</Chip>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Leaving at" htmlFor="leaves"><Input id="leaves" type="time" value={leaves} onChange={(e) => setLeaves(e.target.value)} required /></Field>
            <Field label="Back by" htmlFor="back"><Input id="back" type="time" value={back} onChange={(e) => setBack(e.target.value)} required /></Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13.5px] font-semibold">How many jobs can you carry?</legend>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => <Chip key={n} on={capacity === n} onClick={() => setCapacity(n)} className="rounded-xl">{n}</Chip>)}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13.5px] font-semibold">Jobs you&apos;ll take</legend>
            <div className="flex flex-wrap gap-2">
              {ALL.map((t) => (
                <Chip key={t} on={types.includes(t)} onClick={() => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{TYPE_LABEL[t]}</Chip>
              ))}
            </div>
          </fieldset>
          <Field label={<>Note <span className="font-normal text-muted">(optional)</span></>} htmlFor="note">
            <Textarea id="note" rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Going by keke, can carry small items only" />
          </Field>
          <ErrorNote>{error}</ErrorNote>
        </Page>
        <Footer>
          <Button type="submit" loading={busy}>Post trip</Button>
          <span className="text-center text-[12px] text-muted">Students heading your way can send you requests. You pick which to accept.</span>
        </Footer>
      </form>
    </VerifiedOnly>
  );
}
