"use client";

import { useState } from "react";
import { VerifiedOnly } from "@/components/gate";
import { Icon } from "@/components/icons";
import { Alert, Button, Card, Dialog, Field, Footer, Header, Input, Loading, MoneyInput, Page, Row, Select, useNotify } from "@/components/ui";
import { callFunction, useLoad } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { naira, toKobo } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Withdraw() {
  const { wallet, profile, refresh } = useSession();
  const { confirm, toast } = useNotify();
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [bank, setBank] = useState({ code: "", number: "" });
  const [bankError, setBankError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const acct = useLoad(async () => {
    const { data } = await supabase().from("bank_accounts").select("*").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  }, []);
  const needsBank = !acct.loading && !acct.data;
  const banks = useLoad(async () => (adding || needsBank ? (await callFunction<{ banks: { name: string; code: string }[] }>("bank-account", undefined, "GET")).banks : []), [adding, needsBank]);

  async function saveBank() {
    setBankError(null);
    if (!bank.code) return setBankError("Choose your bank.");
    if (bank.number.length !== 10) return setBankError("Enter your 10-digit account number.");
    setBusy(true);
    try {
      await callFunction("bank-account", { account_number: bank.number, bank_code: bank.code });
      setAdding(false);
      toast({ title: "Bank account saved" });
      void acct.reload();
    } catch (e) {
      setBankError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setError(null);
    const kobo = toKobo(amount);
    if (!kobo) return setError("Enter an amount.");
    const ok = await confirm({ title: `Withdraw ${naira(kobo)}?`, body: `To ${acct.data!.bank_name} ····${acct.data!.account_last4} (${acct.data!.resolved_name}).`, confirmLabel: "Withdraw" });
    if (!ok) return;
    setBusy(true);
    try {
      await callFunction("withdraw", { amount: kobo / 100 });
      toast({ title: "Withdrawal sent", body: `${naira(kobo)} is on its way to your bank.` });
      setAmount("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  const bankForm = (
    <div className="flex flex-col gap-4">
      <Field label="Bank" labelId="bank-l">
        <Select aria-labelledby="bank-l" value={bank.code} onChange={(v) => setBank((b) => ({ ...b, code: v }))} searchable
          placeholder={banks.loading ? "Loading banks…" : "Choose your bank"} searchPlaceholder="Search banks"
          options={(banks.data ?? []).map((b) => ({ value: b.code, label: b.name }))} disabled={banks.loading} />
      </Field>
      <Field label="Account number" htmlFor="num" hint={`The account name must match your verified name (${profile?.full_name}).`}>
        <Input id="num" inputMode="numeric" maxLength={10} className="tabular" value={bank.number} onChange={(e) => setBank((b) => ({ ...b, number: e.target.value.replace(/\D/g, "") }))} />
      </Field>
      {Boolean(banks.error) && <Alert tone="critical">{errorMessage(banks.error)}</Alert>}
      <Alert tone="critical">{bankError}</Alert>
    </div>
  );

  return (
    <VerifiedOnly title="Withdraw to bank">
      <div className="flex min-h-dvh flex-col">
        <Header title="Withdraw to bank" back="/wallet" />
        <Page className="gap-4">
          <Card className="flex items-center justify-between">
            <span className="readout">Available</span>
            <span className="font-display text-kpi-sm font-semibold tabular">{naira(wallet?.available)}</span>
          </Card>
          {acct.loading ? <Loading /> : needsBank ? (
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-[17px] font-semibold">Add your bank account</h2>
              {bankForm}
              <Button variant="inverse" size="pill" loading={busy} onClick={saveBank}>Verify and save</Button>
            </Card>
          ) : (
            <>
              <Card className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-card-nested ring-1 ring-border dark:ring-glass-border"><Icon name="bank" className="size-[18px]" /></span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14.5px] font-semibold">{acct.data!.bank_name} <span className="font-mono tabular">····{acct.data!.account_last4}</span></span>
                  <span className="truncate text-[12.5px] text-ink-2">{acct.data!.resolved_name}</span>
                </div>
                <Button size="sm" variant="surface" onClick={() => setAdding(true)}>Change</Button>
              </Card>
              <Field label="Amount" htmlFor="amt" hint="Minimum ₦1,000.">
                <MoneyInput id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1,000" />
              </Field>
              {toKobo(amount) && <Row label="You'll receive" value={naira(toKobo(amount))} strong />}
            </>
          )}
          <Alert tone="critical">{error}</Alert>
        </Page>
        {!needsBank && !acct.loading && <Footer><Button loading={busy} onClick={withdraw}>Withdraw</Button></Footer>}
        <Dialog open={adding} onClose={() => setAdding(false)} title="Change bank account" size="md"
          footer={<><Button variant="surface" size="pill" onClick={() => setAdding(false)}>Cancel</Button><Button size="pill" loading={busy} onClick={saveBank}>Verify and save</Button></>}>
          {bankForm}
        </Dialog>
      </div>
    </VerifiedOnly>
  );
}
