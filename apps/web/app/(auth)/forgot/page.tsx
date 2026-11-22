"use client";

import { useState } from "react";
import { Button, Field, Footer, Header, Input, Notice, Page } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Same message whatever happens, so emails can't be probed.
    await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col">
      <Header title="Reset password" back="/login" />
      <Page>
        <p className="text-[14.5px] leading-relaxed text-muted">Enter your account email and we&apos;ll send a link to choose a new password.</p>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        {sent && <Notice tone="success">If an account exists for that email, a reset link is on its way. It works once and expires in 10 minutes.</Notice>}
      </Page>
      <Footer>
        <Button type="submit" loading={busy}>Send reset link</Button>
      </Footer>
    </form>
  );
}
