"use client";

import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    const db = supabase();
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setBusy(false);
      return setError(errorMessage(error));
    }
    const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).single();
    if (profile?.role !== "admin") {
      await db.auth.signOut();
      setBusy(false);
      return setError("This account is not an admin.");
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the proxy sees the new session cookie
    window.location.assign("/");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-plate p-6">
      <form onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-4 rounded-card bg-sheet p-7 shadow-pop animate-rise-in">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-white.svg" alt="" className="hidden h-8 w-auto dark:block" />
          <span className="font-display text-[19px] font-semibold">Relay admin</span>
        </div>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Alert tone="critical">{error}</Alert>
        <Button type="submit" loading={busy}>Log in</Button>
      </form>
    </main>
  );
}
