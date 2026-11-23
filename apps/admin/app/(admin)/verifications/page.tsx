"use client";

import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Alert, Button, Card, ChoiceChips, EmptyState, Field, Input, Loading, StatusChip, useNotify } from "@/components/ui";
import { useLoad, useSignedUrl } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { ago } from "@/lib/format";
import { supabase, type Tables } from "@/lib/supabase/client";

type Row = Tables<"verifications"> & { profile: Pick<Tables<"profiles">, "full_name" | "email" | "created_at"> | null };
const REASONS = ["Photo unreadable", "Selfie doesn't match ID", "Name doesn't match account", "Matric number doesn't match ID", "Not a student ID"];

export default function Verifications() {
  const q = useLoad(async () => {
    const { data } = await supabase().from("verifications")
      .select("*, profile:profiles!verifications_profile_id_fkey(full_name, email, created_at)")
      .eq("status", "submitted").order("created_at");
    return (data ?? []) as Row[];
  }, []);

  return (
    <>
      <PageTitle title="ID checks" sub="Compare the selfie, the ID card and the matric number. Oldest first." />
      {q.loading ? <Loading /> : q.data?.length ? q.data.map((v, i) => <Check key={v.id} v={v} i={i} onDone={() => void q.reload()} />)
        : <EmptyState title="Queue is empty" body="New ID submissions show up here." />}
    </>
  );
}

function Check({ v, i, onDone }: { v: Row; i: number; onDone: () => void }) {
  const { toast } = useNotify();
  const selfie = useSignedUrl("id-documents", v.selfie_path);
  const idPhoto = useSignedUrl("id-documents", v.id_photo_path);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function decide(approve: boolean) {
    if (!approve && !reason.trim()) return setError("Give a reason so the student can fix it.");
    setError(null);
    setBusy(approve ? "approve" : "reject");
    const { error } = await supabase().rpc("review_verification", { p_verification: v.id, p_approve: approve, p_reason: approve ? undefined : reason });
    setBusy(null);
    if (error) return setError(errorMessage(error));
    toast({ title: approve ? `${v.profile?.full_name} verified` : "ID rejected", body: approve ? "They can now post and carry." : "The student has been told why." });
    onDone();
  }

  return (
    <Card i={i} className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-display text-[18px] font-semibold tracking-[-0.01em]">{v.profile?.full_name}</span>
          <span className="text-[13px] text-ink-2">{v.profile?.email} · submitted {ago(v.created_at)}</span>
        </div>
        <div className="flex gap-2"><StatusChip tone="live" dot={false}>Matric {v.matric_number}</StatusChip>{v.hostel && <StatusChip dot={false}>{v.hostel}</StatusChip>}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[{ url: selfie, label: "Selfie" }, { url: idPhoto, label: "Student ID" }].map((p) => (
          <figure key={p.label} className="flex flex-col gap-1.5">
            {p.url
              // eslint-disable-next-line @next/next/no-img-element
              ? <a href={p.url} target="_blank" rel="noreferrer" className="rounded-[18px] outline-none focus-visible:ring-2 focus-visible:ring-ring"><img src={p.url} alt={p.label} className="h-72 w-full rounded-[18px] bg-card-nested object-contain" /></a>
              : p.url === null
                ? <div className="grid h-72 place-items-center rounded-[18px] bg-card-nested text-[13px] text-ink-2 dark:ring-1 dark:ring-glass-border">Photo not available</div>
                : <div className="skeleton h-72 rounded-[18px]" />}
            <figcaption className="readout">{p.label} · opens full size</figcaption>
          </figure>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-[18px] bg-card-nested p-4 dark:ring-1 dark:ring-glass-border">
        <Field label="Reason, if rejecting" htmlFor={`r-${v.id}`}>
          <Input id={`r-${v.id}`} placeholder="Shown to the student" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ChoiceChips aria-label="Common reasons" value={reason} onChange={setReason} options={REASONS.map((r) => ({ value: r, label: r }))} />
        <Alert tone="critical">{error}</Alert>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="pill" variant="destructive" loading={busy === "reject"} onClick={() => decide(false)}>Reject</Button>
          <Button size="pill" loading={busy === "approve"} onClick={() => decide(true)}>Approve</Button>
        </div>
      </div>
    </Card>
  );
}
