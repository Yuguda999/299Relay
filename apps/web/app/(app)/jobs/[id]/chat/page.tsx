"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StoredImage } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { Button, ErrorNote, Header, Input, Loading, cx } from "@/components/ui";
import { displayName, fetchPublicProfiles, uploadPhoto, useLoad, useRealtime } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { naira, time, toKobo } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase, type Tables } from "@/lib/supabase/client";

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useSession();
  const [text, setText] = useState("");
  const [sub, setSub] = useState<{ open: boolean; amount: string; note: string }>({ open: false, amount: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const q = useLoad(async () => {
    const db = supabase();
    const [{ data: job }, { data: messages }] = await Promise.all([
      db.from("jobs").select("*").eq("id", id).single(),
      db.from("messages").select("*").eq("job_id", id).order("created_at"),
    ]);
    const people = job ? await fetchPublicProfiles([job.requester_id, job.traveler_id]) : new Map();
    return { job, messages: messages ?? [], people };
  }, [id]);
  useRealtime(`chat:${id}`, [{ table: "messages", filter: `job_id=eq.${id}` }, { table: "jobs", filter: `id=eq.${id}` }], () => void q.reload());

  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [q.data?.messages.length]);

  if (q.loading) return <Loading />;
  const job = q.data?.job;
  if (!job) return <Header title="Chat" />;
  const isRequester = job.requester_id === profile?.id;
  const other = q.data!.people.get(isRequester ? job.traveler_id : job.requester_id);
  const canSubstitute = !isRequester && job.status === "accepted" && job.advance_amount > 0;

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const { error } = await supabase().from("messages").insert({ job_id: id, sender_id: profile!.id, kind: "text", body: text.trim() });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setText("");
    void q.reload();
  }

  async function sendPhoto(file: File) {
    setBusy(true);
    try {
      const path = await uploadPhoto("job-photos", file, id);
      const { error } = await supabase().from("messages").insert({ job_id: id, sender_id: profile!.id, kind: "photo", photo_path: path });
      if (error) throw error;
      void q.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function proposeSub() {
    const amount = toKobo(sub.amount);
    if (!amount) return setError("Enter the new total for the items.");
    setBusy(true);
    const { error } = await supabase().rpc("propose_substitute", { p_job: id, p_body: sub.note || "Price changed", p_new_amount: amount });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setSub({ open: false, amount: "", note: "" });
    void q.reload();
  }

  async function respond(m: Tables<"messages">, approve: boolean) {
    setBusy(true);
    const { error } = await supabase().rpc("respond_substitute", { p_message: m.id, p_approve: approve });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    void q.reload();
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header title={displayName(other)} subtitle="Job chat · phone numbers stay private" back={`/jobs/${id}`} />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {q.data!.messages.map((m) => {
          if (m.kind === "system") {
            return <p key={m.id} className="self-center rounded-full bg-tab px-3 py-1 text-center text-[12.5px] text-muted">{m.body}</p>;
          }
          const mine = m.sender_id === profile?.id;
          if (m.kind === "substitute") {
            return (
              <div key={m.id} className={cx("flex max-w-[85%] flex-col gap-2 rounded-2xl border border-line bg-white p-3.5", mine ? "self-end" : "self-start")}>
                <span className="text-[12px] font-bold tracking-wide text-amber">PRICE CHANGE</span>
                <span className="text-[14.5px]">{m.body}</span>
                <span className="text-[15px] font-bold">New total for items: {naira(m.substitute_amount)}</span>
                {m.decision === "pending" && isRequester ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="md" variant="outline" disabled={busy} onClick={() => respond(m, false)}>Decline</Button>
                    <Button size="md" disabled={busy} onClick={() => respond(m, true)}>Approve</Button>
                  </div>
                ) : (
                  <span className={cx("text-[13px] font-semibold", m.decision === "approved" ? "text-success" : m.decision === "declined" ? "text-danger" : "text-muted")}>
                    {m.decision === "pending" ? "Waiting for approval" : m.decision === "approved" ? "Approved" : "Declined"}
                  </span>
                )}
              </div>
            );
          }
          return (
            <div key={m.id} className={cx("flex max-w-[80%] flex-col gap-1", mine ? "self-end items-end" : "self-start items-start")}>
              {m.kind === "photo"
                ? <StoredImage bucket="job-photos" path={m.photo_path} alt="Photo in chat" className="h-48 w-48 rounded-2xl" />
                : <span className={cx("rounded-2xl px-3.5 py-2.5 text-[14.5px] leading-snug whitespace-pre-line", mine ? "bg-navy text-white" : "border border-line bg-white")}>{m.body}</span>}
              <span className="px-1 text-[11px] text-muted">{time(m.created_at)}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <ErrorNote>{error}</ErrorNote>
      {sub.open && (
        <div className="flex flex-col gap-2 border-t border-line bg-white px-4 pt-3">
          <span className="text-[13.5px] font-semibold">Propose a new price or substitute</span>
          <Input placeholder="What changed? e.g. Peak is out, Three Crowns instead" value={sub.note} onChange={(e) => setSub((s) => ({ ...s, note: e.target.value }))} />
          <div className="flex gap-2">
            <Input inputMode="decimal" placeholder="New total ₦" value={sub.amount} onChange={(e) => setSub((s) => ({ ...s, amount: e.target.value }))} />
            <Button size="md" disabled={busy} onClick={proposeSub}>Send</Button>
          </div>
        </div>
      )}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-line bg-white px-3 pt-2.5 pb-[max(14px,env(safe-area-inset-bottom))]">
        <button type="button" aria-label="Send a photo" onClick={() => fileRef.current?.click()} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-navy">
          <Icon name="camera" />
        </button>
        {canSubstitute && (
          <button type="button" aria-label="Propose a price change" onClick={() => setSub((s) => ({ ...s, open: !s.open }))} className="flex h-11 shrink-0 items-center rounded-xl bg-amber-soft px-2.5 text-[13px] font-bold text-amber">₦±</button>
        )}
        <Input aria-label="Message" placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white disabled:opacity-40">
          <Icon name="send" size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendPhoto(f); e.target.value = ""; }} />
      </form>
    </div>
  );
}
