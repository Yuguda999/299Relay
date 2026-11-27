"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Field, Footer, Header, Input, Page, cn, useNotify } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

export default function ConfirmEmail() {
  const router = useRouter();
  const { toast } = useNotify();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(60);
  const input = useRef<HTMLInputElement>(null);

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
    toast({ title: "New code sent", body: `Check ${email}.` });
    setWait(60);
  }

  return (
    <form onSubmit={verify} className="flex min-h-dvh flex-col" noValidate>
      <Header title="Confirm your email" subtitle="Step 1 of 3 · confirm" back="/signup" />
      <Page className="gap-4">
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          We sent a 6-digit code to <strong className="font-semibold text-foreground">{email || "your email"}</strong>. It expires in 10 minutes.
        </p>
        {!email && (
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        )}
        <div className="relative" onClick={() => input.current?.focus()}>
          <input ref={input} id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-label="6-digit code" autoFocus
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="absolute inset-0 z-10 w-full opacity-0" />
          <div className="grid grid-cols-6 gap-2" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={cn("grid h-14 place-items-center rounded-2xl border-[1.5px] bg-sheet font-mono text-[24px] tabular dark:bg-card-nested",
                i === code.length ? "border-ring ring-2 ring-ring/25" : "border-input")}>{code[i] ?? ""}</span>
            ))}
          </div>
        </div>
        <Alert tone="critical">{error}</Alert>
        <button type="button" disabled={wait > 0 || !email} onClick={resend}
          className="self-start rounded-pill px-1 text-[14px] font-semibold text-signal-ink outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-ink-3">
          {wait > 0 ? <>Resend code in <span className="tabular">{wait}s</span></> : "Resend code"}
        </button>
      </Page>
      <Footer>
        <Button type="submit" loading={busy} disabled={code.length !== 6}>Confirm</Button>
      </Footer>
    </form>
  );
}
