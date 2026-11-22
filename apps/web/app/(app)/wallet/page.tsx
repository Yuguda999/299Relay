"use client";

import { BottomNav } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { ButtonLink, Card, Empty, Header, Loading, Page, cx } from "@/components/ui";
import { useLoad } from "@/lib/data";
import { ago, LEDGER_REASON, naira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Wallet() {
  const { wallet, profile } = useSession();
  const activity = useLoad(async () => {
    // RLS limits entries to the caller's own available-balance account.
    const { data } = await supabase().from("ledger_entries").select("id, direction, amount, reason, created_at").order("id", { ascending: false }).limit(50);
    return data ?? [];
  }, [wallet?.available, wallet?.held]);

  return (
    <>
      <Header title="Wallet" back={false} />
      <Page>
        <section className="flex flex-col gap-4 rounded-[18px] bg-navy p-5 text-white">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-mist">Available</span>
            <span className="font-display text-[34px] font-bold">{naira(wallet?.available)}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#DCE3F0]">
            <Icon name="lock" size={16} />Held for your requests: <strong className="text-white">{naira(wallet?.held)}</strong>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <ButtonLink href="/wallet/topup">Top up</ButtonLink>
            <ButtonLink href="/wallet/withdraw" variant="outline" className={cx(profile?.status !== "verified" && "pointer-events-none opacity-50")}>Withdraw</ButtonLink>
          </div>
        </section>

        <h2 className="pt-2 text-[15px] font-bold">Activity</h2>
        {activity.loading ? <Loading /> : activity.data?.length ? (
          <Card className="flex flex-col divide-y divide-line p-0">
            {activity.data.map((e) => {
              const plus = e.direction === "credit";
              return (
                <div key={e.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-medium">{LEDGER_REASON[e.reason] ?? e.reason}</span>
                    <span className="text-[12px] text-muted">{ago(e.created_at)}</span>
                  </div>
                  <span className={cx("text-[14.5px] font-semibold", plus ? "text-success" : "text-ink")}>{plus ? "+" : "−"}{naira(e.amount)}</span>
                </div>
              );
            })}
          </Card>
        ) : <Empty title="No activity yet" body="Top up once (for example ₦5,000) and spend in small amounts." />}
      </Page>
      <BottomNav />
    </>
  );
}
