"use client";

import Link from "next/link";
import { useRef } from "react";
import { BottomNav } from "@/components/app-bits";
import { Icon, type IconName } from "@/components/icons";
import { Avatar, Card, Header, Loading, Page, StatusChip, useNotify } from "@/components/ui";
import { avatarUrl, compressImage } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Profile() {
  const { profile, refresh, signOut } = useSession();
  const { confirm, toast } = useNotify();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return <><Header title="Profile" back={false} /><Page><Loading /></Page></>;

  async function changePhoto(file: File) {
    try {
      const blob = await compressImage(file, 512);
      const path = `${profile!.id}/avatar-${Date.now()}.jpg`;
      const db = supabase();
      const up = await db.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await db.from("profiles").update({ photo_path: path }).eq("id", profile!.id);
      if (error) throw error;
      toast({ title: "Photo updated" });
      void refresh();
    } catch (e) {
      toast({ title: "Couldn't update photo", body: errorMessage(e), tone: "critical" });
    }
  }

  async function logOut() {
    if (await confirm({ title: "Log out?", body: "You'll need your email and password to log back in.", confirmLabel: "Log out" })) void signOut();
  }

  const menu: { href: string; label: string; icon: IconName }[] = [
    { href: "/verify", label: profile.status === "verified" ? "Student ID" : "Verify student ID", icon: "shield" },
    { href: "/wallet", label: "Wallet", icon: "wallet" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/settings", label: "Settings and safety", icon: "settings" },
  ];
  const stats: [string, string | number][] = [
    ["Rating", profile.rating_count ? Number(profile.rating_avg).toFixed(1) : "—"],
    ["Delivered", profile.jobs_carried],
    ["Requested", profile.jobs_requested],
  ];

  return (
    <>
      <Header title="Profile" back={false} />
      <Page>
        <Card i={0} className="flex flex-col items-center gap-2 py-6 text-center">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Change profile photo"
            className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
            <Avatar name={profile.full_name} src={avatarUrl(profile.photo_path)} size={84} />
            <span className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full bg-inverse text-inverse-foreground ring-2 ring-card"><Icon name="camera" className="size-3.5" /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) void changePhoto(f); e.target.value = ""; }} />
          <span className="mt-1 font-display text-[21px] font-semibold tracking-[-0.015em]">{profile.full_name}</span>
          <span className="text-[13px] text-ink-2">{profile.email}{profile.hostel ? ` · ${profile.hostel}` : ""}</span>
          <StatusChip tone={profile.status === "verified" ? "ok" : "warn"}>{profile.status === "verified" ? "Verified student" : "ID not yet approved"}</StatusChip>
        </Card>
        <div className="grid grid-cols-3 gap-2">
          {stats.map(([l, v], i) => (
            <Card key={l} i={i + 1} className="flex flex-col items-center gap-0.5 px-2 py-3.5">
              <span className="font-display text-kpi-sm font-semibold tabular">{v}</span>
              <span className="readout">{l}</span>
            </Card>
          ))}
        </div>
        <nav aria-label="Account" className="bento flex flex-col p-1.5">
          {menu.map((m) => (
            <Link key={m.href} href={m.href}
              className="flex h-[52px] items-center gap-3 rounded-[18px] px-3 text-[14.5px] font-medium text-foreground no-underline outline-none transition-colors hover:bg-card-nested focus-visible:ring-2 focus-visible:ring-ring">
              <Icon name={m.icon} className="size-[18px] text-ink-2" /><span className="flex-1">{m.label}</span><Icon name="chevron" className="size-4 text-ink-3" />
            </Link>
          ))}
          <button type="button" onClick={logOut}
            className="flex h-[52px] items-center gap-3 rounded-[18px] px-3 text-left text-[14.5px] font-medium text-critical outline-none transition-colors hover:bg-critical/8 focus-visible:ring-2 focus-visible:ring-ring">
            <Icon name="logout" className="size-[18px]" />Log out
          </button>
        </nav>
      </Page>
      <BottomNav />
    </>
  );
}
