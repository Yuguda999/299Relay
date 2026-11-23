"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
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
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy p-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-7">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" className="h-8 w-auto" />
          <span className="font-display text-[19px] font-bold">Admin</span>
        </div>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="pw">
          <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" loading={busy}>Log in</Button>
      </form>
    </main>
  );
}
