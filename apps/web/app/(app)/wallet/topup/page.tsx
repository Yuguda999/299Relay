"use client";

import { useState } from "react";
import { VerifiedOnly } from "@/components/gate";
import { Icon } from "@/components/icons";
import { Alert, Button, Card, ChoiceChips, Field, Footer, Header, MoneyInput, Page, PillTabs, useNotify } from "@/components/ui";
import { callFunction } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { toKobo } from "@/lib/format";

type Method = "transfer" | "card";
type Account = { account_number: string; account_name: string; bank_name: string };
const QUICK = ["1000", "2000", "5000", "10000"];

export default function TopUp() {
  const { toast } = useNotify();
  const [method, setMethod] = useState<Method>("card");
  const [amount, setAmount] = useState("5000");
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function getAccount() {
    setError(null);
    setBusy(true);
    try {
      setAccount((await callFunction<{ account: Account }>("topup-init", { method: "transfer" })).account);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    setError(null);
    if (!toKobo(amount)) return setError("Enter an amount.");
    setBusy(true);
    try {
      const r = await callFunction<{ authorization_url: string }>("topup-init", { method: "card", amount: Number(amount.replace(/,/g, "")) });
      window.location.href = r.authorization_url;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <VerifiedOnly title="Top up wallet">
      <div className="flex min-h-dvh flex-col">
        <Header title="Top up wallet" back="/wallet" />
        <Page className="gap-4">
          <PillTabs<Method> aria-label="Method" value={method} onChange={setMethod} options={[{ value: "card", label: "Card or USSD" }, { value: "transfer", label: "Bank transfer" }]} />
          {method === "transfer" ? (
            account ? (
              <Card className="flex flex-col gap-3 animate-rise-in">
                <span className="readout">Your top-up account</span>
                <div className="flex items-center justify-between gap-3 rounded-[18px] bg-card-nested p-4 dark:ring-1 dark:ring-glass-border">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[26px] font-medium tracking-wider tabular">{account.account_number}</span>
                    <span className="text-[13px] text-ink-2">{account.bank_name} · {account.account_name}</span>
                  </div>
                  <Button size="circle-sm" variant="surface" aria-label="Copy account number"
                    onClick={() => { void navigator.clipboard.writeText(account.account_number); toast({ title: "Account number copied" }); }}>
                    <Icon name="copy" />
                  </Button>
                </div>
                <p className="text-[13px] text-ink-2">Transfer any amount from your bank app. It lands in your wallet within minutes.</p>
              </Card>
            ) : <Alert tone="signal" title="Your own account number">Any transfer to it tops up your wallet, with no card fees on small amounts.</Alert>
          ) : (
            <>
              <Field label="Amount" htmlFor="amt" hint="Between ₦100 and ₦100,000. Paystack fees may apply.">
                <MoneyInput id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <ChoiceChips aria-label="Quick amounts" value={amount} onChange={setAmount} columns={4}
                options={QUICK.map((q) => ({ value: q, label: `₦${Number(q).toLocaleString()}` }))} />
            </>
          )}
          <Alert tone="critical">{error}</Alert>
        </Page>
        {!(method === "transfer" && account) && (
          <Footer>
            {method === "transfer" ? <Button loading={busy} onClick={getAccount}>Show my account number</Button>
              : <Button loading={busy} onClick={checkout}>Continue to Paystack</Button>}
            <span className="text-center text-[12px] text-ink-2">Your wallet is credited only after Paystack confirms the payment.</span>
          </Footer>
        )}
      </div>
    </VerifiedOnly>
  );
}
