"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/app-bits";
import { Button, ErrorNote, Field, Footer, Input, Page } from "@/components/ui";
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
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) {
      if (error.message === "Email not confirmed") {
        sessionStorage.setItem("signup_email", email.trim().toLowerCase());
        await supabase().auth.resend({ type: "signup", email: email.trim().toLowerCase() });
        router.push("/signup/confirm");
        return;
      }
      return setError(errorMessage(error));
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col">
      <Page className="gap-5 pt-7">
        <Logo />
        <h1 className="font-display text-[28px] font-bold tracking-tight">Welcome back</h1>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Link href="/forgot" className="self-start text-[14px] font-semibold text-navy">Forgot password?</Link>
        <ErrorNote>{error}</ErrorNote>
      </Page>
      <Footer>
        <Button type="submit" loading={busy}>Log in</Button>
        <span className="text-center text-[13.5px] text-muted">New here? <Link href="/signup" className="font-semibold text-navy">Create an account</Link></span>
      </Footer>
    </form>
  );
}
