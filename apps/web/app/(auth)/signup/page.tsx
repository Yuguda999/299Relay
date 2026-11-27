"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Field, Footer, Header, Input, Page, Select } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { supabase, type Tables } from "@/lib/supabase/client";

export default function SignUp() {
  const router = useRouter();
  const [campuses, setCampuses] = useState<Tables<"campuses">[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", campus: "", terms: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase().from("campuses").select("*").eq("active", true).then(({ data }) => {
      setCampuses(data ?? []);
      if (data?.length === 1) setForm((f) => ({ ...f, campus: data[0]!.id }));
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name.trim().split(/\s+/).length < 2) return setError("Enter your first and last name, as on your student ID.");
    if (form.password.length < 8) return setError("Use at least 8 characters for your password.");
    if (!form.campus) return setError("Choose your campus.");
    if (!form.terms) return setError("Please agree to the terms to continue.");
    setBusy(true);
    const { error } = await supabase().auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: { data: { full_name: form.name.trim(), campus_id: form.campus } },
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    sessionStorage.setItem("signup_email", form.email.trim().toLowerCase());
    router.push("/signup/confirm");
  }

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col" noValidate>
      <Header title="Create your account" subtitle="Step 1 of 3 · details" back="/welcome" />
      <Page className="gap-4">
        <Field label="Full name" htmlFor="name" hint="As it appears on your student ID">
          <Input id="name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters">
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </Field>
        <Field label="Campus" htmlFor="campus">
          <Select id="campus" value={form.campus} onChange={(v) => setForm({ ...form, campus: v })}
            placeholder="Choose your campus" options={campuses.map((c) => ({ value: c.id, label: c.name, hint: c.short_name }))} />
        </Field>
        <Checkbox checked={form.terms} onChange={(v) => setForm({ ...form, terms: v })}>
          I agree to the terms of use and privacy policy, and confirm I am a student at this campus.
        </Checkbox>
        <Alert tone="critical">{error}</Alert>
      </Page>
      <Footer>
        <Button type="submit" loading={busy}>Continue</Button>
        <span className="text-center text-[13px] text-ink-2">Already have an account? <Link href="/login" className="font-semibold text-signal-ink">Log in</Link></span>
      </Footer>
    </form>
  );
}
