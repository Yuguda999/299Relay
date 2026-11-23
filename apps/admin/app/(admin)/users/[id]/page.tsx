"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Button, Card, ErrorNote, Input, Loading, Notice, Pill, Row } from "@/components/ui";
import { useAdmin, useLoad } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { ago, dayTime, JOB_STATUS_LABEL, LEDGER_REASON, naira } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAdmin();
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
    const ledger = account.data
      ? (await db.from("ledger_entries").select("*").eq("account_id", account.data.id).order("id", { ascending: false }).limit(40)).data ?? []
      : [];
    return { profile, wallet: wallet.data, verifs: verifs.data ?? [], jobs: jobs.data ?? [], banks: banks.data ?? [], payouts: payouts.data ?? [], ledger };
  }, [id]);

  if (q.loading) return <Loading />;
  if (!q.data) return <Notice tone="amber">Student not found.</Notice>;
  const { profile: p, wallet, verifs, jobs, banks, payouts, ledger } = q.data;
  const suspended = p.status === "suspended";

  async function setStatus(status: "suspended" | "verified" | "pending") {
    if (!note.trim()) return setError("Write a reason for the audit log.");
    setError(null);
    setBusy(true);
    const { error } = await supabase().rpc("admin_set_profile_status", { p_profile: id, p_status: status, p_note: note });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setNote("");
    void q.reload();
  }

  return (
    <>
      <PageTitle title={p.full_name} sub={`${p.email} · joined ${ago(p.created_at)}`} right={
        <Pill tone={p.status === "verified" ? "success" : suspended ? "danger" : "amber"}>{p.status}</Pill>
      } />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-2 p-5">
          <h3 className="text-[13px] font-bold">Profile</h3>
          <Row label="Hostel" value={p.hostel ?? "—"} />
          <Row label="Rating" value={p.rating_count ? `${Number(p.rating_avg).toFixed(2)} from ${p.rating_count}` : "—"} />
          <Row label="Delivered / requested" value={`${p.jobs_carried} / ${p.jobs_requested}`} />
          <Row label="Strikes" value={String(p.strikes)} />
          <Row label="Women-only matching" value={p.women_only ? "On" : "Off"} />
          {verifs[0] && <Row label="Matric" value={`${verifs[0].matric_number} (${verifs[0].status})`} />}
        </Card>
        <Card className="flex flex-col gap-2 p-5">
          <h3 className="text-[13px] font-bold">Wallet</h3>
          <Row label="Available" value={naira(wallet?.available)} strong />
          <Row label="Held" value={naira(wallet?.held)} />
          {banks.map((b) => <Row key={b.id} label="Payout account" value={`${b.bank_name} ····${b.account_last4}`} />)}
          {payouts.filter((x) => x.status !== "success").map((x) => <Row key={x.id} label={`Payout ${x.status}`} value={naira(x.amount)} />)}
        </Card>
        <Card className="flex flex-col gap-2.5 p-5">
          <h3 className="text-[13px] font-bold">Account action</h3>
          {p.id === me.id ? <p className="text-[13px] text-muted">This is you.</p> : (
            <>
              <Input aria-label="Reason" placeholder="Reason (kept in the audit log)" value={note} onChange={(e) => setNote(e.target.value)} />
              {suspended
                ? <Button size="md" loading={busy} onClick={() => setStatus(verifs.some((v) => v.status === "approved") ? "verified" : "pending")}>Reinstate</Button>
                : <Button size="md" variant="danger" loading={busy} onClick={() => setStatus("suspended")}>Suspend</Button>}
              <ErrorNote>{error}</ErrorNote>
            </>
          )}
        </Card>
      </div>

      <h2 className="text-[16px] font-bold">Jobs</h2>
      <Table head={["Job", "Role", "Status", "Fee", "When"]}>
        {jobs.map((j) => (
          <tr key={j.id} className="hover:bg-bg">
            <td className="max-w-80 px-4 py-3"><Link href={`/jobs/${j.id}`} className="line-clamp-1 font-semibold text-navy">{j.request?.items_text}</Link></td>
            <td className="px-4 py-3">{j.traveler_id === id ? "Traveler" : "Requester"}</td>
            <td className="px-4 py-3">{JOB_STATUS_LABEL[j.status]}</td>
            <td className="px-4 py-3">{naira(j.request?.fee)}</td>
            <td className="px-4 py-3">{dayTime(j.created_at)}</td>
          </tr>
        ))}
      </Table>

      <h2 className="text-[16px] font-bold">Wallet history</h2>
      <Table head={["When", "What", "Amount"]}>
        {ledger.map((e) => (
          <tr key={e.id}>
            <td className="px-4 py-2.5">{dayTime(e.created_at)}</td>
            <td className="px-4 py-2.5">{LEDGER_REASON[e.reason] ?? e.reason}</td>
            <td className={`px-4 py-2.5 font-semibold ${e.direction === "credit" ? "text-success" : ""}`}>{e.direction === "credit" ? "+" : "−"}{naira(e.amount)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
