"use client";

import Link from "next/link";
import { useState } from "react";
import { PhotoPicker } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { Alert, Button, ButtonLink, Field, Footer, Header, Input, Loading, Page, StatusChip, cn } from "@/components/ui";
import { uploadPhoto, useLoad } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { ago } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Verify() {
  const { profile, refresh } = useSession();
  const latest = useLoad(async () => {
    const { data } = await supabase().from("verifications").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  }, [profile?.status]);

  const [matric, setMatric] = useState("");
  const [hostel, setHostel] = useState(profile?.hostel ?? "");
  const [selfie, setSelfie] = useState<File[]>([]);
  const [idPhoto, setIdPhoto] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile || latest.loading) return <><Header title="Student ID" back="/" /><Page><Loading /></Page></>;

  if (profile.status === "verified" || latest.data?.status === "submitted") {
    const ok = profile.status === "verified";
    return (
      <div className="flex min-h-dvh flex-col">
        <Header title={ok ? "Student ID" : "ID in review"} subtitle={ok ? undefined : "Step 3 of 3"} back="/" />
        <Page className="items-center gap-4 pt-10 text-center">
          <span aria-hidden className="relative grid size-28 place-items-center animate-bloom">
            <span className="absolute inset-0 rounded-full ring-1 ring-border dark:ring-glass-border" />
            <span className="absolute inset-4 rounded-full ring-1 ring-border dark:ring-glass-border" />
            <span className={cn("grid size-12 place-items-center rounded-full", ok ? "bg-ok/12 text-ok" : "bg-signal-soft text-signal-ink")}>
              <Icon name={ok ? "check" : "shield"} className="size-6" />
            </span>
          </span>
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.015em]">{ok ? "You're verified" : "We're checking your ID"}</h2>
          <p className="max-w-[300px] text-[14px] leading-relaxed text-pretty text-ink-2">
            {ok ? "You can post requests, post trips, carry jobs and withdraw." : "An admin compares your selfie, ID and matric number, usually within a few hours. You'll get an alert and an email."}
          </p>
          {latest.data && <StatusChip tone={ok ? "ok" : "live"}>{latest.data.matric_number} · sent {ago(latest.data.created_at)}</StatusChip>}
          {!ok && <p className="text-[13px] text-ink-2">Meanwhile you can browse trips and requests.</p>}
        </Page>
        <Footer><ButtonLink href="/">Go to home</ButtonLink></Footer>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!matric.trim()) return setError("Enter your matric number.");
    if (!selfie[0] || !idPhoto[0]) return setError("Add both a selfie and a photo of your student ID.");
    setBusy(true);
    try {
      const [s, i] = await Promise.all([uploadPhoto("id-documents", selfie[0]), uploadPhoto("id-documents", idPhoto[0])]);
      const { error } = await supabase().rpc("submit_verification", { p_matric: matric, p_hostel: hostel, p_selfie_path: s, p_id_photo_path: i });
      if (error) throw error;
      await refresh();
      void latest.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col" noValidate>
      <Header title="Verify your student ID" subtitle="Step 2 of 3" back="/" />
      <Page className="gap-4">
        {latest.data?.status === "rejected" && <Alert tone="warn" title="Your last ID wasn't approved">{latest.data.reject_reason}. Please try again.</Alert>}
        <p className="text-[14px] leading-relaxed text-ink-2">Only verified students can post and carry. Your photos are private: only admins see them, and they&apos;re deleted 30 days after review.</p>
        <Field label="Matric number" htmlFor="matric">
          <Input id="matric" autoCapitalize="characters" className="font-mono tracking-wide" value={matric} onChange={(e) => setMatric(e.target.value.toUpperCase())} placeholder="U21CS1234" />
        </Field>
        <Field label="Hostel" htmlFor="hostel">
          <Input id="hostel" value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="Amina Hall" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Selfie" hint="Good light, no cap.">
            <PhotoPicker files={selfie} onChange={setSelfie} max={1} capture="user" label="Selfie" />
          </Field>
          <Field label="Student ID" hint="Whole card, no glare.">
            <PhotoPicker files={idPhoto} onChange={setIdPhoto} max={1} capture="environment" label="ID card" />
          </Field>
        </div>
        <Alert tone="critical">{error}</Alert>
      </Page>
      <Footer>
        <Button type="submit" loading={busy}>Submit for review</Button>
        <Link href="/" className="text-center text-[13.5px] font-semibold text-signal-ink">Do this later</Link>
      </Footer>
    </form>
  );
}
