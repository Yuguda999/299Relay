"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Alert, Button, Card, EmptyState, Field, Input, Loading, StatusChip, useNotify } from "@/components/ui";
import { usePlaceName, useLoad, useSignedUrl } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { ago, dayTime, naira, TYPE_LABEL } from "@/lib/format";
import { supabase, type Tables } from "@/lib/supabase/client";

type Row = Tables<"requests"> & { requester: Pick<Tables<"profiles">, "id" | "full_name" | "strikes"> | null };

export default function FlaggedRequests() {
  const q = useLoad(async () => {
    const { data } = await supabase().from("requests")
      .select("*, requester:profiles!requests_requester_id_fkey(id, full_name, strikes)")
      .eq("status", "review").order("created_at");
    return (data ?? []) as Row[];
  }, []);

  return (
    <>
      <PageTitle title="Flagged requests" sub="Held because the text matched a prohibited keyword. Money stays in escrow until you decide." />
      {q.loading ? <Loading /> : q.data?.length ? q.data.map((r, i) => <Item key={r.id} r={r} i={i} onDone={() => void q.reload()} />)
        : <EmptyState title="Nothing flagged" body="Requests that mention prohibited items wait here." />}
    </>
  );
}

function Item({ r, i, onDone }: { r: Row; i: number; onDone: () => void }) {
  const place = usePlaceName();
  const { confirm, toast } = useNotify();
  const photo = useSignedUrl("request-photos", r.photo_path);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(approve: boolean) {
    if (!approve && !(await confirm({ title: "Reject and refund?", body: `${naira(r.item_budget + r.fee)} goes back to ${r.requester?.full_name}.`, confirmLabel: "Reject", tone: "danger" }))) return;
    setBusy(true);
    const { error } = await supabase().rpc("admin_review_request", { p_request: r.id, p_approve: approve, p_note: note || undefined });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast({ title: approve ? "Request allowed" : "Request rejected and refunded" });
    onDone();
  }

  return (
    <Card i={i} className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={r.urgent ? "warn" : "idle"}>{TYPE_LABEL[r.type]}</StatusChip>
        {(r.flagged_keywords ?? []).map((k) => <StatusChip key={k} tone="critical">{k}</StatusChip>)}
        <span className="ml-auto font-mono text-[11px] text-ink-2">{ago(r.created_at)}</span>
      </div>
      <p className="text-[16px] font-semibold whitespace-pre-line">{r.items_text}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={photo} alt="Request photo" className="h-48 w-fit rounded-[18px]" />}
      <p className="text-[13.5px] text-ink-2">
        By <Link href={`/users/${r.requester?.id}`} className="font-semibold text-signal-ink">{r.requester?.full_name}</Link>
        {r.requester?.strikes ? ` (${r.requester.strikes} strike${r.requester.strikes > 1 ? "s" : ""})` : ""} · {place(r.from_place_id)} → {place(r.handoff_place_id)} · before <span className="tabular">{dayTime(r.deadline)}</span> · <span className="tabular">{naira(r.item_budget + r.fee)}</span> held
      </p>
      <Field label="Note to the student" optional htmlFor={`n-${r.id}`}>
        <Input id={`n-${r.id}`} placeholder="Shown if rejected" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Alert tone="critical">{error}</Alert>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="pill" variant="destructive" loading={busy} onClick={() => decide(false)}>Reject and refund</Button>
        <Button size="pill" loading={busy} onClick={() => decide(true)}>Allow</Button>
      </div>
    </Card>
  );
}
