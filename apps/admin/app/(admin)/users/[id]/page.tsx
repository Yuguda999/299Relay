"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Alert, Avatar, Button, Card, Field, Input, Loading, Row, StatusChip, cn, useNotify } from "@/components/ui";
import { useAdmin, useLoad } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { ago, dayTime, JOB_STATUS_LABEL, LEDGER_REASON, naira } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAdmin();
  const { confirm, toast } = useNotify();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useLoad(async () => {
    const db = supabase();
    const { data: profile } = await db.from("profiles").select("*").eq("id", id).single();
    if (!profile) return null;
    const [wallet, account, verifs, jobs, banks, payouts] = await Promise.all([
      db.from("wallets").select("*").eq("profile_id", id).single(),
      db.from("ledger_accounts").select("id").eq("kind", "user_available").eq("profile_id", id).single(),
      db.from("verifications").select("*").eq("profile_id", id).order("created_at", { ascending: false }),
      db.from("jobs").select("*, request:requests(items_text, fee)").or(`requester_id.eq.${id},traveler_id.eq.${id}`).order("created_at", { ascending: false }).limit(30),
      db.from("bank_accounts").select("*").eq("profile_id", id).eq("active", true),
      db.from("payouts").select("*").eq("profile_id", id).order("created_at", { ascending: false }).limit(10),
    ]);
    const ledger = account.data ? (await db.from("ledger_entries").select("*").eq("account_id", account.data.id).order("id", { ascending: false }).limit(40)).data ?? [] : [];
    return { profile, wallet: wallet.data, verifs: verifs.data ?? [], jobs: jobs.data ?? [], banks: banks.data ?? [], payouts: payouts.data ?? [], ledger };
  }, [id]);

  if (q.loading) return <Loading />;
  if (!q.data) return <Alert tone="warn">Student not found.</Alert>;
  const { profile: p, wallet, verifs, jobs, banks, payouts, ledger } = q.data;
  const suspended = p.status === "suspended";

  async function setStatus(status: "suspended" | "verified" | "pending") {
    if (!note.trim()) return setError("Write a reason for the audit log.");
    const ok = await confirm({ title: suspended ? `Reinstate ${p.full_name}?` : `Suspend ${p.full_name}?`, body: suspended ? undefined : "They can't post, carry or withdraw until reinstated.", confirmLabel: suspended ? "Reinstate" : "Suspend", tone: suspended ? "default" : "danger" });
    if (!ok) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase().rpc("admin_set_profile_status", { p_profile: id, p_status: status, p_note: note });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast({ title: suspended ? "Reinstated" : "Suspended" });
    setNote("");
    void q.reload();
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={p.full_name} size={56} />
        <div className="min-w-0 flex-1"><PageTitle title={p.full_name} sub={`${p.email} · joined ${ago(p.created_at)}`} /></div>
        <StatusChip tone={p.status === "verified" ? "ok" : suspended ? "critical" : "warn"}>{p.status}</StatusChip>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card i={0} className="flex flex-col gap-2 p-5">
          <h3 className="readout mb-1">Profile</h3>
          <Row label="Hostel" value={p.hostel ?? "—"} />
          <Row label="Rating" value={p.rating_count ? `${Number(p.rating_avg).toFixed(2)} from ${p.rating_count}` : "—"} />
          <Row label="Delivered / requested" value={`${p.jobs_carried} / ${p.jobs_requested}`} />
          <Row label="Strikes" value={String(p.strikes)} />
          <Row label="Women-only matching" value={p.women_only ? "On" : "Off"} />
          {verifs[0] && <Row label="Matric" value={`${verifs[0].matric_number} (${verifs[0].status})`} />}
        </Card>
        <Card i={1} className="flex flex-col gap-2 p-5">
          <h3 className="readout mb-1">Wallet</h3>
          <Row label="Available" value={naira(wallet?.available)} strong />
          <Row label="Held" value={naira(wallet?.held)} />
          {banks.map((b) => <Row key={b.id} label="Payout account" value={`${b.bank_name} ····${b.account_last4}`} />)}
          {payouts.filter((x) => x.status !== "success").map((x) => <Row key={x.id} label={`Payout ${x.status}`} value={naira(x.amount)} />)}
        </Card>
        <Card i={2} className="flex flex-col gap-3 p-5">
          <h3 className="readout">Account action</h3>
          {p.id === me.id ? <p className="text-[13px] text-ink-2">This is you.</p> : (
            <>
              <Field label="Reason" htmlFor="reason" hint="Kept in the audit log."><Input id="reason" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
              {suspended
                ? <Button size="pill" loading={busy} onClick={() => setStatus(verifs.some((v) => v.status === "approved") ? "verified" : "pending")}>Reinstate</Button>
                : <Button size="pill" variant="destructive" loading={busy} onClick={() => setStatus("suspended")}>Suspend</Button>}
              <Alert tone="critical">{error}</Alert>
            </>
          )}
        </Card>
      </div>

      <h2 className="readout pt-2">Jobs</h2>
      <Table head={["Job", "Role", "Status", "Fee", "When"]}>
        {jobs.map((j) => (
          <tr key={j.id}>
            <td className="max-w-80"><Link href={`/jobs/${j.id}`} className="line-clamp-1 font-semibold text-foreground underline-offset-2 hover:underline">{j.request?.items_text}</Link></td>
            <td className="text-ink-2">{j.traveler_id === id ? "Traveler" : "Requester"}</td>
            <td><StatusChip tone={j.status === "completed" ? "ok" : j.status === "disputed" ? "critical" : "live"}>{JOB_STATUS_LABEL[j.status]}</StatusChip></td>
            <td className="tabular">{naira(j.request?.fee)}</td>
            <td className="font-mono text-[12px] text-ink-2 tabular">{dayTime(j.created_at)}</td>
          </tr>
        ))}
      </Table>

      <h2 className="readout pt-2">Wallet history</h2>
      <Table head={["When", "What", "Amount"]} minWidth={480}>
        {ledger.map((e) => (
          <tr key={e.id}>
            <td className="font-mono text-[12px] text-ink-2 tabular">{dayTime(e.created_at)}</td>
            <td>{LEDGER_REASON[e.reason] ?? e.reason}</td>
            <td className={cn("font-semibold tabular", e.direction === "credit" && "text-ok")}>{e.direction === "credit" ? "+" : "−"}{naira(e.amount)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
