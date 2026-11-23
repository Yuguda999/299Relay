"use client";

import { useState } from "react";
import { useThemeSwitch } from "@/components/providers";
import { PushToggle } from "@/components/push-toggle";
import { Alert, Button, Card, ChoiceChips, Field, Header, Input, Page, SectionLabel, Switch, useNotify } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Settings() {
  const { profile, refresh } = useSession();
  const { toast } = useNotify();
  const { theme, switchTo } = useThemeSwitch();
  const [hostel, setHostel] = useState(profile?.hostel ?? "");

  async function update(patch: { hostel?: string; women_only?: boolean }, message: string) {
    const { error } = await supabase().from("profiles").update(patch).eq("id", profile!.id);
    if (error) return toast({ title: "Not saved", body: errorMessage(error), tone: "critical" });
    toast({ title: message });
    void refresh();
  }

  if (!profile) return null;
  return (
    <>
      <Header title="Settings and safety" />
      <Page>
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <ChoiceChips aria-label="Theme" columns={3} value={theme as "light" | "dark" | "system"}
            onChange={(v) => {
              const el = document.activeElement?.getBoundingClientRect();
              switchTo(v, el ? { x: el.left + el.width / 2, y: el.top + el.height / 2 } : undefined);
            }}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
        </Card>

        <SectionLabel>Notifications</SectionLabel>
        <Card><PushToggle /></Card>

        <SectionLabel>Safety</SectionLabel>
        <Card className="flex flex-col gap-4">
          <Switch checked={profile.women_only} onChange={(v) => void update({ women_only: v }, v ? "Women-only matching on" : "Women-only matching off")}
            label="Women-only matching" description="Prefer to request from and carry for women only. Matching by this setting is rolling out soon." />
          <Alert tone="info">Handoffs happen only at listed public points (gates, porters&apos; lodges, faculty entrances) and before 9:00pm.</Alert>
        </Card>

        <SectionLabel>Your details</SectionLabel>
        <Card className="flex flex-col gap-3">
          <Field label="Hostel" htmlFor="hostel"><Input id="hostel" value={hostel} onChange={(e) => setHostel(e.target.value)} /></Field>
          <Button size="pill" variant="surface" disabled={hostel === (profile.hostel ?? "")} onClick={() => void update({ hostel }, "Hostel saved")}>Save</Button>
        </Card>

        <SectionLabel>Privacy</SectionLabel>
        <Card className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-2">
          <p>Your phone number is never shown. Other students see your first name, last initial, photo, hostel and rating.</p>
          <p>ID photos are visible only to admins and deleted 30 days after review.</p>
          <p>Language: English. Hausa is coming.</p>
          <p>Account deletion from the app is coming. Until then, ask the 299 RELAY team and we&apos;ll delete your data.</p>
        </Card>
      </Page>
    </>
  );
}
