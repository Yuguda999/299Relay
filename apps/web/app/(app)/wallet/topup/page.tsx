"use client";

import { useState } from "react";
import { VerifiedOnly } from "@/components/gate";
import { Icon } from "@/components/icons";
import { Button, Card, Chip, ErrorNote, Field, Footer, Header, Input, Notice, Page, Segmented } from "@/components/ui";
import { callFunction } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { toKobo } from "@/lib/format";

type Method = "transfer" | "card";
type Account = { account_number: string; account_name: string; bank_name: string };
const QUICK = [1000, 2000, 5000, 10000];

export default function TopUp() {
  const [method, setMethod] = useState<Method>("transfer");
  const [amount, setAmount] = useState("5000");
  const [account, setAccount] = useState<Account | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function getAccount() {
    setError(null);
    setBusy(true);
    try {
      const r = await callFunction<{ account: Account }>("topup-init", { method: "transfer" });
      setAccount(r.account);
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
          <Segmented<Method> value={method} onChange={setMethod} options={[{ value: "transfer", label: "Bank transfer" }, { value: "card", label: "Card or USSD" }]} />
          {method === "transfer" ? (
            account ? (
              <Card className="flex flex-col gap-3">
                <span className="text-[13.5px] text-muted">Transfer any amount to your personal account. It lands in your wallet in a few minutes.</span>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-soft px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-display text-[26px] font-bold tracking-wider text-navy">{account.account_number}</span>
                    <span className="text-[13px] text-muted">{account.bank_name} · {account.account_name}</span>
                  </div>
                  <Button size="md" variant="outline" aria-label="Copy account number"
                    onClick={() => { void navigator.clipboard.writeText(account.account_number); setCopied(true); }}>
                    <Icon name="copy" size={18} />{copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </Card>
            ) : (
              <Notice>Get your own bank account number. Any transfer to it tops up your wallet, with no card fees on small amounts.</Notice>
            )
          ) : (
            <>
              <Field label="Amount (₦)" htmlFor="amt" hint="Between ₦100 and ₦100,000. Paystack fees may apply.">
                <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => <Chip key={q} on={amount === String(q)} onClick={() => setAmount(String(q))}>₦{q.toLocaleString()}</Chip>)}
              </div>
            </>
          )}
          <ErrorNote>{error}</ErrorNote>
        </Page>
        {!(method === "transfer" && account) && (
          <Footer>
            {method === "transfer"
              ? <Button loading={busy} onClick={getAccount}>Show my account number</Button>
              : <Button loading={busy} onClick={checkout}>Continue to Paystack</Button>}
            <span className="text-center text-[12px] text-muted">Your wallet is credited only after Paystack confirms the payment.</span>
          </Footer>
        )}
      </div>
    </VerifiedOnly>
  );
}
