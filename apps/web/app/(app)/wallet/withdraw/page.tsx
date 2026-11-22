"use client";

import { useState } from "react";
import { VerifiedOnly } from "@/components/gate";
import { Button, Card, ErrorNote, Field, Footer, Header, Input, Loading, Notice, Page, Select } from "@/components/ui";
import { callFunction, useLoad } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { naira, toKobo } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Withdraw() {
  const { wallet, profile, refresh } = useSession();
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [bank, setBank] = useState({ code: "", number: "" });
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const acct = useLoad(async () => {
    const { data } = await supabase().from("bank_accounts").select("*").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  }, []);
  const banks = useLoad(async () => (adding ? (await callFunction<{ banks: { name: string; code: string }[] }>("bank-account", undefined, "GET")).banks : []), [adding]);

  async function saveBank() {
    setError(null);
    setBusy(true);
    try {
      await callFunction("bank-account", { account_number: bank.number, bank_code: bank.code });
      setAdding(false);
      void acct.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setError(null);
    const kobo = toKobo(amount);
    if (!kobo) return setError("Enter an amount.");
    setBusy(true);
    try {
      await callFunction("withdraw", { amount: kobo / 100 });
      setDone(`${naira(kobo)} is on its way to your bank.`);
      setAmount("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  const showForm = adding || (!acct.loading && !acct.data);

  return (
    <VerifiedOnly title="Withdraw to bank">
      <div className="flex min-h-dvh flex-col">
        <Header title="Withdraw to bank" back="/wallet" />
        <Page className="gap-4">
          <Card className="flex items-center justify-between">
            <span className="text-[13.5px] text-muted">Available</span>
            <span className="text-[18px] font-bold">{naira(wallet?.available)}</span>
          </Card>
          {acct.loading ? <Loading /> : showForm ? (
            <Card className="flex flex-col gap-3">
              <h2 className="text-[15px] font-bold">Add your bank account</h2>
              <p className="text-[13px] text-muted">The account name must match your verified name ({profile?.full_name}).</p>
              <Field label="Bank" htmlFor="bank">
                <Select id="bank" value={bank.code} onChange={(e) => setBank((b) => ({ ...b, code: e.target.value }))}>
                  <option value="">{banks.loading ? "Loading banks…" : "Choose your bank"}</option>
                  {(banks.data ?? []).map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Account number" htmlFor="num">
                <Input id="num" inputMode="numeric" maxLength={10} value={bank.number} onChange={(e) => setBank((b) => ({ ...b, number: e.target.value.replace(/\D/g, "") }))} />
              </Field>
              <Button size="md" variant="dark" loading={busy} disabled={!bank.code || bank.number.length !== 10} onClick={saveBank}>Verify and save</Button>
              {Boolean(banks.error) && <ErrorNote>{errorMessage(banks.error)}</ErrorNote>}
            </Card>
          ) : (
            <Card className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[14.5px] font-semibold">{acct.data!.bank_name} ····{acct.data!.account_last4}</span>
                <span className="text-[12.5px] text-muted">{acct.data!.resolved_name}</span>
              </div>
              <Button size="md" variant="soft" onClick={() => setAdding(true)}>Change</Button>
            </Card>
          )}
          {!showForm && (
            <Field label="Amount (₦)" htmlFor="amt" hint="Minimum ₦1,000.">
              <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1,000" />
            </Field>
          )}
          {done && <Notice tone="success">{done}</Notice>}
          <ErrorNote>{error}</ErrorNote>
        </Page>
        {!showForm && (
          <Footer>
            <Button loading={busy} onClick={withdraw}>Withdraw</Button>
          </Footer>
        )}
      </div>
    </VerifiedOnly>
  );
}
