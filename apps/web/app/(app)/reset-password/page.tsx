"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, Field, Footer, Header, Input, Page } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

/** Reached from the reset email (session set by /auth/callback). */
export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    const db = supabase();
    const { error } = await db.auth.updateUser({ password });
    if (!error) await db.auth.signOut({ scope: "others" }); // sign out every other session
    setBusy(false);
    if (error) return setError(errorMessage(error));
    router.replace("/");
  }

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col">
      <Header title="Choose a new password" back={false} />
      <Page>
        <Field label="New password" htmlFor="pw" hint="At least 8 characters">
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </Page>
      <Footer><Button type="submit" loading={busy}>Save password</Button></Footer>
    </form>
  );
}
