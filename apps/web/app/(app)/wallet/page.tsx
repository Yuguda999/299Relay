"use client";

import { useEffect } from "react";
import { BottomNav } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { ButtonLink, EmptyState, Header, Page, RowSkeletons, SectionLabel, cn, useNotify } from "@/components/ui";
import { callFunction, useLoad } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { ago, LEDGER_REASON, naira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Wallet() {
  const { wallet, profile, refresh } = useSession();
  const { toast } = useNotify();

  // Back from Paystack checkout (?topup=<reference>): confirm the payment with Paystack.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("topup");
    if (!ref) return;
    window.history.replaceState(null, "", "/wallet");
    void callFunction<{ status: string; amount?: number }>("topup-verify", { reference: ref })
      .then((r) => {
        if (r.status === "success") {
          toast({ title: "Wallet topped up", body: r.amount ? `${naira(r.amount)} added.` : undefined });
          void refresh();
        } else if (r.status === "failed") {
          toast({ title: "Payment failed", body: "Nothing was charged to your wallet.", tone: "critical" });
        } else if (r.status === "abandoned") {
          toast({ title: "Payment not completed", body: "Nothing was charged to your wallet.", tone: "critical" });
        } else {
          toast({ title: "Payment processing", body: "We'll add it as soon as Paystack confirms.", tone: "info" });
        }
      })
      .catch((e) => toast({ title: "Couldn't confirm payment", body: errorMessage(e), tone: "critical" }));
  }, [toast, refresh]);
  const activity = useLoad(async () => {
    // RLS limits entries to the caller's own available-balance account.
    const { data } = await supabase().from("ledger_entries").select("id, direction, amount, reason, created_at").order("id", { ascending: false }).limit(50);
    return data ?? [];
  }, [wallet?.available, wallet?.held]);

  return (
    <>
      <Header title="Wallet" back={false} />
      <Page>
        <section className="entrance hero flex flex-col gap-5 rounded-card p-5">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase opacity-70">Available</span>
            <span className="font-display text-kpi font-semibold tabular">{naira(wallet?.available)}</span>
            <span className="flex items-center gap-1.5 text-[13px] opacity-80">
              <Icon name="lock" className="size-3.5" />Held for your requests <span className="font-semibold tabular">{naira(wallet?.held)}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <ButtonLink href="/wallet/topup" size="pill"><Icon name="plus" className="size-4" />Top up</ButtonLink>
            <ButtonLink href="/wallet/withdraw" size="pill" variant="onHero" disabled={profile?.status !== "verified"}>
              <Icon name="bank" className="size-4" />Withdraw
            </ButtonLink>
          </div>
        </section>

        <SectionLabel>Activity</SectionLabel>
        {activity.loading ? <RowSkeletons count={4} /> : activity.data?.length ? (
          <ul className="bento flex flex-col p-1.5">
            {activity.data.map((e, i) => {
              const plus = e.direction === "credit";
              return (
                <li key={e.id} className="entrance flex items-center gap-3 rounded-[18px] px-3 py-3" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", plus ? "bg-ok/12 text-ok" : "bg-foreground/[0.06] text-ink-2")}>
                    <Icon name={plus ? "plus" : "minus"} className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14px] font-medium">{LEDGER_REASON[e.reason] ?? e.reason}</span>
                    <span className="font-mono text-[11px] text-ink-2">{ago(e.created_at)}</span>
                  </div>
                  <span className={cn("text-[14.5px] font-semibold tabular", plus && "text-ok")}>{plus ? "+" : "−"}{naira(e.amount)}</span>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="No activity yet" body="Top up once, for example ₦5,000, and spend in small amounts." />}
      </Page>
      <BottomNav />
    </>
  );
}
