"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ErrorNote, Field, Footer, Header, Input, Page } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

export default function ConfirmEmail() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(60);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from sessionStorage
    setEmail(sessionStorage.getItem("signup_email") ?? "");
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({ email, token: code, type: "signup" });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    sessionStorage.removeItem("signup_email");
    router.replace("/verify");
  }

  async function resend() {
    setError(null);
    const { error } = await supabase().auth.resend({ type: "signup", email });
    if (error) return setError(errorMessage(error));
    setInfo("New code sent.");
    setWait(60);
  }

  return (
    <form onSubmit={verify} className="flex min-h-dvh flex-col">
      <Header title="Confirm your email" subtitle="Step 1 of 3 · confirm" back="/signup" />
      <Page>
        <p className="text-[14.5px] leading-relaxed text-muted">
          We sent a 6-digit code to <strong className="text-ink">{email || "your email"}</strong>. It expires in 10 minutes.
        </p>
        {!email && (
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        )}
        <Field label="Code" htmlFor="code">
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center font-display text-[28px] font-bold tracking-[10px]" required />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        {info && <p className="text-[13.5px] text-success">{info}</p>}
        <button type="button" disabled={wait > 0 || !email} onClick={resend} className="self-start text-[14px] font-semibold text-navy disabled:text-muted">
          {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
        </button>
      </Page>
      <Footer>
        <Button type="submit" loading={busy} disabled={code.length !== 6}>Confirm</Button>
      </Footer>
    </form>
  );
}
