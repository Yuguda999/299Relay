"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BottomNav } from "@/components/app-bits";
import { Icon, type IconName } from "@/components/icons";
import { Avatar, Card, ErrorNote, Header, Loading, Page, Pill } from "@/components/ui";
import { avatarUrl, compressImage } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

export default function Profile() {
  const { profile, refresh, signOut } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return <Loading />;

  async function changePhoto(file: File) {
    try {
      const blob = await compressImage(file, 512);
      const path = `${profile!.id}/avatar-${Date.now()}.jpg`;
      const db = supabase();
      const up = await db.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await db.from("profiles").update({ photo_path: path }).eq("id", profile!.id);
      if (error) throw error;
      void refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const menu: { href: string; label: string; icon: IconName }[] = [
    { href: "/verify", label: profile.status === "verified" ? "Student ID" : "Verify student ID", icon: "shield" },
    { href: "/wallet", label: "Wallet", icon: "wallet" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
    { href: "/settings", label: "Settings and safety", icon: "settings" },
  ];

  return (
    <>
      <Header title="Profile" back={false} />
      <Page>
        <Card className="flex flex-col items-center gap-2 py-5 text-center">
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Change profile photo" className="relative">
            <Avatar name={profile.full_name} src={avatarUrl(profile.photo_path)} size={80} />
            <span className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-navy text-white"><Icon name="camera" size={14} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void changePhoto(f); e.target.value = ""; }} />
          <span className="font-display text-[20px] font-semibold">{profile.full_name}</span>
          <span className="text-[13px] text-muted">{profile.email}{profile.hostel ? ` · ${profile.hostel}` : ""}</span>
          {profile.status === "verified" ? <Pill tone="success">Verified student</Pill> : <Pill tone="amber">ID not yet approved</Pill>}
        </Card>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            [profile.rating_count ? Number(profile.rating_avg).toFixed(1) : "–", "Rating"],
            [profile.jobs_carried, "Delivered"],
            [profile.jobs_requested, "Requested"],
          ].map(([v, l]) => (
            <Card key={String(l)} className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-[19px] font-bold">{v}</span>
              <span className="text-[12px] text-muted">{l}</span>
            </Card>
          ))}
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {menu.map((m) => (
            <Link key={m.href} href={m.href} className="flex min-h-[52px] items-center gap-3 px-3.5 text-[14.5px] font-medium text-ink no-underline">
              <Icon name={m.icon} size={20} className="text-navy" /><span className="flex-1">{m.label}</span><Icon name="chevron" size={18} className="text-muted" />
            </Link>
          ))}
          <button type="button" onClick={signOut} className="flex min-h-[52px] items-center gap-3 px-3.5 text-left text-[14.5px] font-medium text-danger">
            <Icon name="logout" size={20} />Log out
          </button>
        </div>
      </Page>
      <BottomNav />
    </>
  );
}
