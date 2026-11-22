"use client";

import { useState } from "react";
import { Button, Card, ErrorNote, Field, Header, Input, Notice, Page } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Settings() {
  const { profile, refresh } = useSession();
  const [hostel, setHostel] = useState(profile?.hostel ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(patch: { hostel?: string; women_only?: boolean }) {
    setError(null);
    const { error } = await supabase().from("profiles").update(patch).eq("id", profile!.id);
    if (error) return setError(errorMessage(error));
    setSaved(true);
    void refresh();
  }

  if (!profile) return null;
  return (
    <>
      <Header title="Settings and safety" />
      <Page className="gap-4">
        <Card className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Safety</h2>
          <label className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-[14.5px] font-medium">Women-only matching</span>
              <span className="text-[12.5px] text-muted">Prefer to request from and carry for women only. Matching by this setting is rolling out soon.</span>
            </span>
            <input type="checkbox" checked={profile.women_only} onChange={(e) => void update({ women_only: e.target.checked })} className="mt-1 size-6 shrink-0 accent-navy" />
          </label>
          <Notice>Handoffs happen only at listed public points (gates, porters&apos; lodges, faculty entrances) and before 9:00pm.</Notice>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">Your details</h2>
          <Field label="Hostel" htmlFor="hostel">
            <Input id="hostel" value={hostel} onChange={(e) => { setHostel(e.target.value); setSaved(false); }} />
          </Field>
          <Button size="md" variant="dark" onClick={() => void update({ hostel })}>{saved ? "Saved" : "Save"}</Button>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold">Privacy</h2>
          <p className="text-[13px] leading-relaxed text-muted">Your phone number is never shown. Other students see your first name, last initial, photo, hostel and rating. ID photos are visible only to admins and deleted 30 days after review.</p>
          <p className="text-[13px] leading-relaxed text-muted">Language: English. Hausa is coming.</p>
          <p className="text-[13px] leading-relaxed text-muted">Account deletion from the app is coming. Until then, ask the 299 RELAY team and we&apos;ll delete your data.</p>
        </Card>
        <ErrorNote>{error}</ErrorNote>
      </Page>
    </>
  );
}
