"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/app-bits";
import { Alert, Button, Field, Footer, Input, Page } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    const addr = email.trim().toLowerCase();
    const { error } = await supabase().auth.signInWithPassword({ email: addr, password });
    setBusy(false);
    if (error) {
      if (error.message === "Email not confirmed") {
        sessionStorage.setItem("signup_email", addr);
        await supabase().auth.resend({ type: "signup", email: addr });
        router.push("/signup/confirm");
        return;
      }
      return setError(errorMessage(error));
    }
    // Full navigation so the proxy sees the fresh session cookie on the first request.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the proxy sees the new session cookie
    window.location.assign("/");
  }

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col" noValidate>
      <Page className="gap-5 pt-[max(28px,env(safe-area-inset-top))]">
        <Logo />
        <div className="entrance flex flex-col gap-1">
          <h1 className="font-display text-hero font-semibold">Welcome back</h1>
          <p className="text-[14.5px] text-ink-2">Log in to post, carry and get paid.</p>
        </div>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Link href="/forgot" className="self-start text-[14px] font-semibold text-signal-ink">Forgot password?</Link>
        <Alert tone="critical">{error}</Alert>
      </Page>
      <Footer>
        <Button type="submit" loading={busy}>Log in</Button>
        <span className="text-center text-[13px] text-ink-2">New here? <Link href="/signup" className="font-semibold text-signal-ink">Create an account</Link></span>
      </Footer>
    </form>
  );
}
