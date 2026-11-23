"use client";

import { useState } from "react";
import { PageTitle } from "@/components/shell";
import { Button, Card, Empty, ErrorNote, Input, Loading, Pill } from "@/components/ui";
import { useLoad, useSignedUrl } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { ago } from "@/lib/format";
import { supabase, type Tables } from "@/lib/supabase/client";

type Row = Tables<"verifications"> & { profile: Pick<Tables<"profiles">, "full_name" | "email" | "created_at"> | null };

export default function Verifications() {
  const q = useLoad(async () => {
    const { data } = await supabase()
      .from("verifications")
      .select("*, profile:profiles!verifications_profile_id_fkey(full_name, email, created_at)")
      .eq("status", "submitted")
      .order("created_at");
    return (data ?? []) as Row[];
  }, []);

  return (
    <>
      <PageTitle title="ID checks" sub="Compare the selfie, the ID card and the matric number. Oldest first." />
      {q.loading ? <Loading /> : q.data?.length ? (
        q.data.map((v) => <Check key={v.id} v={v} onDone={() => void q.reload()} />)
      ) : <Empty title="Queue is empty" body="New ID submissions show up here." />}
    </>
  );
}

const REASONS = ["Photo unreadable", "Selfie doesn't match ID", "Name doesn't match account", "Matric number doesn't match ID", "Not a student ID"];

function Check({ v, onDone }: { v: Row; onDone: () => void }) {
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
    onDone();
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[17px] font-bold">{v.profile?.full_name}</span>
          <span className="text-[13px] text-muted">{v.profile?.email} · submitted {ago(v.created_at)}</span>
        </div>
        <div className="flex gap-2"><Pill>Matric {v.matric_number}</Pill>{v.hostel && <Pill tone="muted">{v.hostel}</Pill>}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[{ url: selfie, label: "Selfie" }, { url: idPhoto, label: "Student ID" }].map((p) => (
          <figure key={p.label} className="flex flex-col gap-1.5">
            {p.url
              // eslint-disable-next-line @next/next/no-img-element
              ? <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.label} className="h-72 w-full rounded-xl bg-tab object-contain" /></a>
              : <div className="h-72 rounded-xl bg-tab" />}
            <figcaption className="text-[12.5px] text-muted">{p.label} (opens full size)</figcaption>
          </figure>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-field bg-white px-3 py-1.5 text-[12.5px]">{r}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Reason for rejecting" placeholder="Reason (needed to reject)" value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-64 flex-1" />
          <Button size="md" variant="danger" loading={busy === "reject"} onClick={() => decide(false)}>Reject</Button>
          <Button size="md" loading={busy === "approve"} onClick={() => decide(true)}>Approve</Button>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  );
}
