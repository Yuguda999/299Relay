"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StoredImage } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { Button, Dialog, Field, Header, Input, Loading, MoneyInput, StatusChip, cn, useNotify } from "@/components/ui";
import { displayName, fetchPublicProfiles, uploadPhoto, type PublicProfile } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { naira, time, toKobo } from "@/lib/format";
import { useSession } from "@/lib/session";
import { realtimeAuth, supabase, type Tables } from "@/lib/supabase/client";

type Message = Tables<"messages"> & { pending?: boolean; failed?: boolean };
type Conn = "connecting" | "live" | "offline";
const HEARTBEAT_MS = 20_000;

// Presence calls run strictly in order, even across a remount, so a stale
// "leaving" can never land after a fresh "here".
let presenceQueue: Promise<unknown> = Promise.resolve();
function presence(job: string, leaving = false) {
  presenceQueue = presenceQueue.then(() => supabase().rpc("chat_heartbeat", { p_job: job, p_leaving: leaving })).catch(() => {});
}

async function leaveOnUnload(job: string) {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  void fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/chat_heartbeat`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ p_job: job, p_leaving: true }),
  });
}

/** Merge by id, keep chronological order. A pending local copy is replaced by the stored row. */
function upsert(list: Message[], m: Message): Message[] {
  const i = list.findIndex((x) => x.id === m.id);
  const next = i >= 0 ? list.map((x, j) => (j === i ? { ...x, ...m, pending: false, failed: false } : x)) : [...list, m];
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useSession();
  const { toast } = useNotify();
  const [job, setJob] = useState<Tables<"jobs"> | null>(null);
  const [other, setOther] = useState<PublicProfile | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<Conn>("connecting");
  const [text, setText] = useState("");
  const [unseen, setUnseen] = useState(0);
  const [subOpen, setSubOpen] = useState(false);
  const [sub, setSub] = useState({ amount: "", note: "" });
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const atBottom = useRef(true);
  const me = profile?.id;

  // ── Initial load (also re-run after a reconnect to catch missed messages) ──
  const load = useCallback(async () => {
    const db = supabase();
    const [{ data: j }, { data: msgs }] = await Promise.all([
      db.from("jobs").select("*").eq("id", id).single(),
      db.from("messages").select("*").eq("job_id", id).order("created_at"),
    ]);
    setJob(j);
    setMessages((cur) => (msgs ?? []).reduce<Message[]>((acc, m) => upsert(acc, m), cur.filter((m) => m.pending || m.failed)));
    if (j && me) {
      const people = await fetchPublicProfiles([j.requester_id, j.traveler_id]);
      setOther(people.get(j.requester_id === me ? j.traveler_id : j.requester_id));
    }
    setLoading(false);
  }, [id, me]);

  // ── Live updates over the Realtime websocket ──
  useEffect(() => {
    if (!me) return;
    const db = supabase();
    let cancelled = false;
    const channel = db
      .channel(`chat:${id}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${id}` }, (p) => {
        const m = p.new as Message;
        setMessages((cur) => upsert(cur, m));
        if (m.sender_id !== me && !atBottom.current) setUnseen((n) => n + 1);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `job_id=eq.${id}` }, (p) => {
        setMessages((cur) => upsert(cur, p.new as Message));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` }, (p) => {
        setJob(p.new as Tables<"jobs">);
      });
    void realtimeAuth().then(() => !cancelled && channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConn("live");
          void load();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConn("offline");
        }
      }));
    return () => {
      cancelled = true;
      void db.removeChannel(channel);
    };
  }, [id, me, load]);

  // ── Presence heartbeat: tells the server we're reading, so it doesn't notify us ──
  useEffect(() => {
    if (!me) return;
    const beat = () => {
      if (document.visibilityState === "visible") presence(id);
    };
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    const onVis = () => (document.visibilityState === "visible" ? beat() : presence(id, true));
    // Closing the tab or a full reload: a keepalive request survives the unload.
    const onHide = () => void leaveOnUnload(id);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      presence(id, true);
    };
  }, [id, me]);

  // ── Scrolling: stick to the bottom unless the reader scrolled up ──
  const scrollToEnd = useCallback((smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useLayoutEffect(() => {
    if (atBottom.current) scrollToEnd();
  }, [messages.length, loading, scrollToEnd]);
  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnseen(0);
  }

  if (loading || !job) return <div className="flex h-dvh flex-col"><Header title="Chat" back={`/jobs/${id}`} /><Loading /></div>;
  const isRequester = job.requester_id === me;
  const canSubstitute = !isRequester && job.status === "accepted" && job.advance_amount > 0;
  const closed = ["cancelled", "refunded"].includes(job.status);
  const fail = (e: unknown) => toast({ title: "Not sent", body: errorMessage(e), tone: "critical" });

  async function sendText(body: string, retryId?: string) {
    const localId = retryId ?? crypto.randomUUID();
    const draft: Message = {
      id: localId, job_id: id, sender_id: me!, kind: "text", body, photo_path: null, substitute_amount: null,
      decision: null, created_at: new Date().toISOString(), pending: true,
    };
    atBottom.current = true;
    setUnseen(0);
    setMessages((cur) => upsert(cur.filter((m) => m.id !== localId), draft));
    // Client-chosen id: this insert and its realtime echo land on the same row.
    const { data, error } = await supabase().from("messages").insert({ id: localId, job_id: id, sender_id: me!, kind: "text", body }).select().single();
    if (error) {
      setMessages((cur) => cur.map((m) => (m.id === localId ? { ...m, pending: false, failed: true } : m)));
      return fail(error);
    }
    setMessages((cur) => upsert(cur, data));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    void sendText(body);
  }

  async function sendPhoto(file: File) {
    setBusy(true);
    try {
      const path = await uploadPhoto("job-photos", file, id);
      const { data, error } = await supabase().from("messages").insert({ job_id: id, sender_id: me!, kind: "photo", photo_path: path }).select().single();
      if (error) throw error;
      atBottom.current = true;
      setMessages((cur) => upsert(cur, data));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function proposeSub() {
    const amount = toKobo(sub.amount);
    if (!amount) return toast({ title: "Enter the new total", tone: "critical" });
    setBusy(true);
    const { error } = await supabase().rpc("propose_substitute", { p_job: id, p_body: sub.note || "Price changed", p_new_amount: amount });
    setBusy(false);
    if (error) return fail(error);
    setSubOpen(false);
    setSub({ amount: "", note: "" });
  }

  async function respond(m: Message, approve: boolean) {
    setBusy(true);
    const { error } = await supabase().rpc("respond_substitute", { p_message: m.id, p_approve: approve });
    setBusy(false);
    if (error) return toast({ title: "Couldn't update the price change", body: errorMessage(error), tone: "critical" });
    toast({ title: approve ? "New price approved" : "Price change declined" });
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header title={displayName(other)} subtitle="Job chat · numbers stay private" back={`/jobs/${id}`}
        right={<StatusChip tone={conn === "live" ? "ok" : conn === "offline" ? "critical" : "idle"}>{conn === "live" ? "Live" : conn === "offline" ? "Reconnecting" : "Connecting"}</StatusChip>} />

      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Messages"
          className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain px-4 pt-3 pb-4">
          {messages.length === 0 && (
            <p className="m-auto max-w-[260px] text-center text-[13px] text-ink-2">Say hi. Agree on details here; your phone number is never shared.</p>
          )}
          {messages.map((m) => {
            if (m.kind === "system") {
              return (
                <p key={m.id} className="my-1 self-center rounded-pill bg-foreground/[0.06] px-3 py-1 text-center font-mono text-[11px] tracking-wide text-ink-2">
                  {m.body}
                  {/(Receipt uploaded|No receipt)/.test(m.body ?? "") && <> <Link href={`/jobs/${id}#receipt`} className="font-sans font-semibold text-signal-ink underline-offset-2 hover:underline">Details</Link></>}
                </p>
              );
            }
            const mine = m.sender_id === me;
            if (m.kind === "substitute") {
              return (
                <div key={m.id} className={cn("bento flex max-w-[86%] flex-col gap-2.5 p-4", mine ? "self-end" : "self-start")}>
                  <StatusChip tone="warn">Price change</StatusChip>
                  <span className="text-[14.5px]">{m.body}</span>
                  <span className="flex items-baseline justify-between gap-3 text-[13px] text-ink-2">New total for items<span className="font-display text-[19px] font-semibold text-foreground tabular">{naira(m.substitute_amount)}</span></span>
                  {m.decision === "pending" && isRequester ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="surface" disabled={busy} onClick={() => respond(m, false)}>Decline</Button>
                      <Button size="sm" disabled={busy} onClick={() => respond(m, true)}>Approve</Button>
                    </div>
                  ) : (
                    <StatusChip tone={m.decision === "approved" ? "ok" : m.decision === "declined" ? "critical" : "idle"}>{m.decision === "pending" ? "Waiting for approval" : m.decision}</StatusChip>
                  )}
                </div>
              );
            }
            return (
              <div key={m.id} className={cn("flex max-w-[80%] flex-col gap-1", mine ? "items-end self-end" : "items-start self-start")}>
                {m.kind === "photo"
                  ? <StoredImage bucket="job-photos" path={m.photo_path} alt="Photo in chat" zoom className="h-48 w-48" />
                  : <span className={cn("rounded-[20px] px-4 py-2.5 text-[14.5px] leading-snug break-words whitespace-pre-line transition-opacity",
                      mine ? "rounded-br-md bg-inverse text-inverse-foreground" : "rounded-bl-md bg-sheet ring-1 ring-border dark:bg-card dark:ring-glass-border",
                      m.pending && "opacity-60")}>{m.body}</span>}
                <span className="flex items-center gap-1.5 px-1.5 font-mono text-[10.5px] text-ink-3 tabular">
                  {m.failed ? (
                    <button type="button" onClick={() => void sendText(m.body ?? "", m.id)} className="font-sans text-[12px] font-semibold text-critical underline-offset-2 hover:underline">
                      Not sent · tap to retry
                    </button>
                  ) : m.pending ? "Sending…" : time(m.created_at)}
                  {mine && !m.pending && !m.failed && <Icon name="check" className="size-3" />}
                </span>
              </div>
            );
          })}
        </div>
        {unseen > 0 && (
          <button type="button" onClick={() => { scrollToEnd(true); setUnseen(0); }}
            className="absolute bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-pill bg-inverse px-4 text-[13px] font-semibold text-inverse-foreground shadow-lift animate-rise-in">
            <Icon name="down" className="size-4" />{unseen} new {unseen === 1 ? "message" : "messages"}
          </button>
        )}
      </div>

      {closed ? (
        <p className="glass border-x-0 border-b-0 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] text-center text-[13px] text-ink-2">This chat is closed.</p>
      ) : (
        <form onSubmit={submit} noValidate className="glass flex items-center gap-1.5 border-x-0 border-b-0 px-3 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button variant="ghost" size="circle-sm" aria-label="Send a photo" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="camera" /></Button>
          {canSubstitute && <Button variant="soft" size="sm" onClick={() => setSubOpen(true)} aria-label="Propose a price change">₦ change</Button>}
          <Input aria-label="Message" placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} enterKeyHint="send" className="h-11 rounded-pill" />
          <Button type="submit" size="circle-sm" variant="inverse" aria-label="Send" disabled={!text.trim()}><Icon name="send" /></Button>
          <input ref={fileRef} type="file" accept="image/*" hidden tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendPhoto(f); e.target.value = ""; }} />
        </form>
      )}

      <Dialog open={subOpen} onClose={() => setSubOpen(false)} title="Price change or substitute" description="The requester approves before you buy. A higher price is topped up from their wallet."
        footer={<>
          <Button variant="surface" size="pill" onClick={() => setSubOpen(false)}>Cancel</Button>
          <Button size="pill" loading={busy} onClick={proposeSub}>Send for approval</Button>
        </>}>
        <div className="flex flex-col gap-4">
          <Field label="What changed?" htmlFor="sub-note">
            <Input id="sub-note" data-autofocus placeholder="Peak is out, Three Crowns instead" value={sub.note} onChange={(e) => setSub((s) => ({ ...s, note: e.target.value }))} />
          </Field>
          <Field label="New total for the items" htmlFor="sub-amt" hint={<>Current budget <span className="tabular">{naira(job.advance_amount)}</span></>}>
            <MoneyInput id="sub-amt" value={sub.amount} onChange={(e) => setSub((s) => ({ ...s, amount: e.target.value }))} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
