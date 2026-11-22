"use client";

import Link from "next/link";
import { useState } from "react";
import { PhotoPicker } from "@/components/app-bits";
import { Icon } from "@/components/icons";
import { Button, ButtonLink, ErrorNote, Field, Footer, Header, Input, Loading, Notice, Page, Pill } from "@/components/ui";
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

  if (!profile || latest.loading) return <Loading />;

  // Already verified, or waiting for review: status screen.
  if (profile.status === "verified" || latest.data?.status === "submitted") {
    const ok = profile.status === "verified";
    return (
      <div className="flex min-h-dvh flex-col">
        <Header title={ok ? "Student ID" : "ID in review"} subtitle={ok ? undefined : "Step 3 of 3"} back="/" />
        <Page className="items-center gap-4 pt-8 text-center">
          <span className={`flex size-20 items-center justify-center rounded-full ${ok ? "bg-success-soft text-success" : "bg-soft text-navy"}`}>
            <Icon name={ok ? "check" : "shield"} size={36} />
          </span>
          <h2 className="font-display text-[22px] font-semibold">{ok ? "You're verified" : "We're checking your ID"}</h2>
          <p className="max-w-[300px] text-[14.5px] leading-relaxed text-muted">
            {ok ? "You can post requests, post trips, carry jobs and withdraw." : "An admin compares your selfie, ID and matric number, usually within a few hours. You'll get a push and an email."}
          </p>
          {latest.data && <Pill tone={ok ? "success" : "amber"}>{latest.data.matric_number} · sent {ago(latest.data.created_at)}</Pill>}
          {!ok && <p className="text-[13.5px] text-muted">Meanwhile you can browse trips and requests.</p>}
        </Page>
        <Footer><ButtonLink href="/">Go to home</ButtonLink></Footer>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    <form onSubmit={submit} className="flex min-h-dvh flex-col">
      <Header title="Verify your student ID" subtitle="Step 2 of 3" back="/" />
      <Page className="gap-4">
        {latest.data?.status === "rejected" && (
          <Notice tone="amber">Your last ID wasn&apos;t approved: {latest.data.reject_reason}. Please try again.</Notice>
        )}
        <p className="text-[14px] leading-relaxed text-muted">Only verified students can post and carry. Your photos are private: only admins see them, and they&apos;re deleted 30 days after review.</p>
        <Field label="Matric number" htmlFor="matric">
          <Input id="matric" autoCapitalize="characters" value={matric} onChange={(e) => setMatric(e.target.value.toUpperCase())} placeholder="U21CS1234" required />
        </Field>
        <Field label="Hostel" htmlFor="hostel">
          <Input id="hostel" value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="Amina Hall" />
        </Field>
        <Field label="Selfie" hint="Face the camera in good light, no cap or glasses.">
          <PhotoPicker files={selfie} onChange={setSelfie} max={1} capture="user" label="Take a selfie" />
        </Field>
        <Field label="Student ID card" hint="The whole card, readable, no glare.">
          <PhotoPicker files={idPhoto} onChange={setIdPhoto} max={1} capture="environment" label="Photo of student ID" />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </Page>
      <Footer>
        <Button type="submit" loading={busy}>Submit for review</Button>
        <Link href="/" className="text-center text-[13.5px] font-semibold text-navy">Do this later</Link>
      </Footer>
    </form>
  );
}
