"use client";

import Link from "next/link";
import { PageTitle, Table } from "@/components/shell";
import { Alert, Card, Loading, Row, StatusChip } from "@/components/ui";
import { useLoad } from "@/lib/admin";
import { dayTime, naira } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

type Health = {
  problems: { problem: string }[];
  accounts: Record<string, number>;
  wallets_available: number;
  wallets_held: number;
  stuck_payouts: number;
  checked_at: string;
};
const tone = (s: string) => (s === "success" ? "ok" : s === "pending" ? "warn" : "critical") as "ok" | "warn" | "critical";

export default function Money() {
  const q = useLoad(async () => {
    const db = supabase();
    const [h, payouts, payments] = await Promise.all([
      db.rpc("admin_ledger_health"),
      db.from("payouts").select("*, profile:profiles(id, full_name), bank:bank_accounts(bank_name, account_last4)").order("created_at", { ascending: false }).limit(50),
      db.from("payments").select("*, profile:profiles(id, full_name)").order("created_at", { ascending: false }).limit(50),
    ]);
    return { h: h.data as Health, payouts: payouts.data ?? [], payments: payments.data ?? [] };
  }, []);

  if (q.loading || !q.data) return <Loading />;
  const { h, payouts, payments } = q.data;

  return (
    <>
      <PageTitle title="Money" sub={`Ledger checked ${dayTime(h.checked_at)}`} />
      {h.problems.length
        ? <Alert tone="critical" title={`Ledger check found ${h.problems.length} problem(s)`}>{h.problems.map((p) => p.problem).join(", ")}. Pause payouts and investigate before money moves further.</Alert>
        : <Alert tone="ok" title="Ledger balanced">Every account cache matches its entries and the ledger sums to zero.</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card i={0} className="flex flex-col gap-2 p-5">
          <h3 className="readout mb-1">What students hold</h3>
          <Row label="Wallets, available" value={naira(h.wallets_available)} />
          <Row label="Held in escrow" value={naira(h.wallets_held)} />
          <Row label="Payouts in transit" value={naira(h.accounts.payouts_in_transit)} />
        </Card>
        <Card i={1} className="flex flex-col gap-2 p-5">
          <h3 className="readout mb-1">Platform</h3>
          <Row label="Commission earned" value={naira(h.accounts.platform_revenue)} strong />
          <Row label="Net received through Paystack" value={naira(-(h.accounts.gateway_clearing ?? 0))} />
          <p className="text-[12px] leading-relaxed text-ink-2">Compare with the Paystack balance daily. Net received should equal wallets + escrow + in transit + commission.</p>
        </Card>
      </div>

      <div className="flex items-center gap-2 pt-2"><h2 className="readout">Payouts</h2>{h.stuck_payouts > 0 && <StatusChip tone="critical">{h.stuck_payouts} stuck over 1h</StatusChip>}</div>
      <Table head={["When", "Student", "Bank", "Amount", "Status", "Reference"]} minWidth={820}>
        {payouts.map((p) => (
          <tr key={p.id} id={p.id}>
            <td className="font-mono text-[12px] text-ink-2 tabular">{dayTime(p.created_at)}</td>
            <td><Link href={`/users/${p.profile?.id}`} className="text-foreground underline-offset-2 hover:underline">{p.profile?.full_name}</Link></td>
            <td className="text-ink-2">{p.bank?.bank_name} <span className="font-mono">····{p.bank?.account_last4}</span></td>
            <td className="font-semibold tabular">{naira(p.amount)}</td>
            <td><StatusChip tone={tone(p.status)}>{p.status}</StatusChip>{p.failure_reason && <span className="ml-1.5 text-[12px] text-ink-2">{p.failure_reason}</span>}</td>
            <td className="font-mono text-[11.5px] text-ink-2">{p.paystack_reference}</td>
          </tr>
        ))}
      </Table>

      <h2 className="readout pt-2">Top-ups</h2>
      <Table head={["When", "Student", "Method", "Amount", "Status", "Reference"]} minWidth={820}>
        {payments.map((p) => (
          <tr key={p.id}>
            <td className="font-mono text-[12px] text-ink-2 tabular">{dayTime(p.created_at)}</td>
            <td><Link href={`/users/${p.profile?.id}`} className="text-foreground underline-offset-2 hover:underline">{p.profile?.full_name}</Link></td>
            <td className="text-ink-2">{p.method}</td>
            <td className="font-semibold tabular">{naira(p.amount)}</td>
            <td><StatusChip tone={tone(p.status)}>{p.status}</StatusChip></td>
            <td className="font-mono text-[11.5px] text-ink-2">{p.paystack_reference}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
