"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Footer, Header, Input, Page, useNotify } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

/** Reached from the reset email (session set by /auth/callback). */
export default function ResetPassword() {
  const router = useRouter();
  const { toast } = useNotify();
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
    toast({ title: "Password changed", body: "Other devices have been signed out." });
    router.replace("/");
  }

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col" noValidate>
      <Header title="Choose a new password" back={false} />
      <Page className="gap-4">
        <Field label="New password" htmlFor="pw" hint="At least 8 characters">
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Alert tone="critical">{error}</Alert>
      </Page>
      <Footer><Button type="submit" loading={busy}>Save password</Button></Footer>
    </form>
  );
}
