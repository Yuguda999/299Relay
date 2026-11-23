"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Button, Card, Empty, ErrorNote, Input, Loading, Pill, TypeBadge } from "@/components/ui";
import { usePlaceName, useLoad, useSignedUrl } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { ago, dayTime, naira } from "@/lib/format";
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
      {q.loading ? <Loading /> : q.data?.length ? q.data.map((r) => <Item key={r.id} r={r} onDone={() => void q.reload()} />)
        : <Empty title="Nothing flagged" />}
    </>
  );
}

function Item({ r, onDone }: { r: Row; onDone: () => void }) {
  const place = usePlaceName();
  const photo = useSignedUrl("request-photos", r.photo_path);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    const { error } = await supabase().rpc("admin_review_request", { p_request: r.id, p_approve: approve, p_note: note || undefined });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    onDone();
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={r.type} urgent={r.urgent} />
        {(r.flagged_keywords ?? []).map((k) => <Pill key={k} tone="danger">{k}</Pill>)}
        <span className="ml-auto text-[13px] text-muted">{ago(r.created_at)}</span>
      </div>
      <p className="text-[16px] font-semibold whitespace-pre-line">{r.items_text}</p>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Request photo" className="h-48 w-fit rounded-xl" />
      )}
      <p className="text-[13.5px] text-muted">
        By <Link href={`/users/${r.requester?.id}`} className="font-semibold text-navy">{r.requester?.full_name}</Link>
        {r.requester?.strikes ? ` (${r.requester.strikes} strike${r.requester.strikes > 1 ? "s" : ""})` : ""} · {place(r.from_place_id)} → {place(r.handoff_place_id)} · before {dayTime(r.deadline)} · {naira(r.item_budget + r.fee)} held
      </p>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Note to the student" placeholder="Note to the student (shown if rejected)" value={note} onChange={(e) => setNote(e.target.value)} className="min-w-64 flex-1" />
        <Button size="md" variant="danger" loading={busy} onClick={() => decide(false)}>Reject and refund</Button>
        <Button size="md" loading={busy} onClick={() => decide(true)}>Allow</Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
    </Card>
  );
}
