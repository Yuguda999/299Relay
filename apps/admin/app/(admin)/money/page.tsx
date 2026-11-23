"use client";

import Link from "next/link";
import { PageTitle, Table } from "@/components/shell";
import { Card, Loading, Notice, Pill, Row } from "@/components/ui";
import { useLoad } from "@/lib/admin";
import { dayTime, naira } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";

type Health = {
  problems: { problem: string; account_id: string | null; expected: number; actual: number }[];
  accounts: Record<string, number>;
  wallets_available: number;
  wallets_held: number;
  stuck_payouts: number;
  checked_at: string;
};

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
  const clearing = -(h.accounts.gateway_clearing ?? 0);

  return (
    <>
      <PageTitle title="Money" sub={`Ledger checked ${dayTime(h.checked_at)}`} />
      {h.problems.length ? (
        <Notice tone="amber">Ledger check found {h.problems.length} problem(s): {h.problems.map((p) => p.problem).join(", ")}. Stop payouts and investigate before money moves further.</Notice>
      ) : <Notice tone="success">Ledger balanced: every account cache matches its entries and the ledger sums to zero.</Notice>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-2 p-5">
          <h3 className="text-[13px] font-bold">What students hold</h3>
          <Row label="Wallets, available" value={naira(h.wallets_available)} />
          <Row label="Wallets, held in escrow" value={naira(h.wallets_held)} />
          <Row label="Payouts in transit" value={naira(h.accounts.payouts_in_transit)} />
        </Card>
        <Card className="flex flex-col gap-2 p-5">
          <h3 className="text-[13px] font-bold">Platform</h3>
          <Row label="Commission earned" value={naira(h.accounts.platform_revenue)} strong />
          <Row label="Net received through Paystack" value={naira(clearing)} />
          <p className="text-[12px] text-muted">Compare with the Paystack balance daily. Net received should equal wallets + escrow + in transit + commission.</p>
        </Card>
      </div>

      <h2 className="text-[16px] font-bold">Payouts {h.stuck_payouts > 0 && <Pill tone="danger">{h.stuck_payouts} stuck over 1h</Pill>}</h2>
      <Table head={["When", "Student", "Bank", "Amount", "Status", "Reference"]}>
        {payouts.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-2.5">{dayTime(p.created_at)}</td>
            <td className="px-4 py-2.5"><Link href={`/users/${p.profile?.id}`} className="text-navy">{p.profile?.full_name}</Link></td>
            <td className="px-4 py-2.5">{p.bank?.bank_name} ····{p.bank?.account_last4}</td>
            <td className="px-4 py-2.5 font-semibold">{naira(p.amount)}</td>
            <td className="px-4 py-2.5"><Pill tone={p.status === "success" ? "success" : p.status === "pending" ? "amber" : "danger"}>{p.status}</Pill>{p.failure_reason ? <span className="ml-1 text-[12px] text-muted">{p.failure_reason}</span> : null}</td>
            <td className="px-4 py-2.5 font-mono text-[12px]">{p.paystack_reference}</td>
          </tr>
        ))}
      </Table>

      <h2 className="text-[16px] font-bold">Top-ups</h2>
      <Table head={["When", "Student", "Method", "Amount", "Status", "Reference"]}>
        {payments.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-2.5">{dayTime(p.created_at)}</td>
            <td className="px-4 py-2.5"><Link href={`/users/${p.profile?.id}`} className="text-navy">{p.profile?.full_name}</Link></td>
            <td className="px-4 py-2.5">{p.method}</td>
            <td className="px-4 py-2.5 font-semibold">{naira(p.amount)}</td>
            <td className="px-4 py-2.5"><Pill tone={p.status === "success" ? "success" : p.status === "pending" ? "amber" : "danger"}>{p.status}</Pill></td>
            <td className="px-4 py-2.5 font-mono text-[12px]">{p.paystack_reference}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
