"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerifiedOnly } from "@/components/gate";
import { placeOptions } from "@/components/request-form";
import { Alert, Button, ChoiceChips, Field, Footer, Header, Page, Select, Textarea, TimeSelect } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { lagosToIso, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase, type Enums } from "@/lib/supabase/client";

const ALL: Enums<"request_type">[] = ["buy", "print", "pick_up", "drop_off"];

export default function PostTrip() {
  const router = useRouter();
  const { places } = useSession();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [day, setDay] = useState<"0" | "1">("0");
  const [leaves, setLeaves] = useState("16:00");
  const [back, setBack] = useState("17:30");
  const [capacity, setCapacity] = useState(2);
  const [types, setTypes] = useState<Enums<"request_type">[]>(ALL);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const opts = placeOptions(places);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!from || !to) return setError("Pick where you're leaving from and going to.");
    if (from === to) return setError("Pick two different places.");
    if (back <= leaves) return setError("Back-by time must be after you leave.");
    if (!types.length) return setError("Pick at least one kind of job.");
    setBusy(true);
    const d = Number(day) as 0 | 1;
    const { data, error } = await supabase().rpc("create_trip", {
      p_from_place: from, p_to_place: to, p_leaves_at: lagosToIso(d, leaves), p_back_by: lagosToIso(d, back),
      p_capacity: capacity, p_job_types: types, p_note: note || undefined,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    router.replace(`/trips/${data.id}`);
  }

  return (
    <VerifiedOnly title="Post a trip">
      <form onSubmit={submit} className="flex min-h-dvh flex-col" noValidate>
        <Header title="Post a trip" />
        <Page className="gap-4">
          <Field label="Leaving from" labelId="from-l">
            <Select aria-labelledby="from-l" value={from} onChange={setFrom} options={opts} placeholder="Choose a place" searchPlaceholder="Search places" />
          </Field>
          <Field label="Going to" labelId="to-l">
            <Select aria-labelledby="to-l" value={to} onChange={setTo} options={opts.map((o) => ({ ...o, disabled: o.value === from }))} placeholder="Choose a place" searchPlaceholder="Search places" />
          </Field>
          <Field label="Day" labelId="day-l">
            <ChoiceChips aria-label="Day" value={day} onChange={setDay} columns={2} options={[{ value: "0", label: "Today" }, { value: "1", label: "Tomorrow" }]} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Leaving at" labelId="lv-l"><TimeSelect aria-labelledby="lv-l" value={leaves} onChange={setLeaves} min="06:00" max="20:30" /></Field>
            <Field label="Back by" labelId="bk-l"><TimeSelect aria-labelledby="bk-l" value={back} onChange={setBack} min="06:30" max="21:00" /></Field>
          </div>
          <Field label="Jobs you can carry" labelId="cap-l">
            <ChoiceChips aria-label="Capacity" value={capacity} onChange={setCapacity} columns={3} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
          </Field>
          <Field label="Jobs you'll take" labelId="types-l">
            <ChoiceChips aria-label="Job types" value={types} onChange={(t) => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
              options={ALL.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
          </Field>
          <Field label="Note" optional htmlFor="note">
            <Textarea id="note" rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Going by keke, small items only" />
          </Field>
          <Alert tone="critical">{error}</Alert>
        </Page>
        <Footer>
          <Button type="submit" loading={busy}>Post trip</Button>
          <span className="text-center text-[12px] text-ink-2">Students heading your way can send you requests. You choose which to accept.</span>
        </Footer>
      </form>
    </VerifiedOnly>
  );
}
