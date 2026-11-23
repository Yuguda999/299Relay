"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Button, Loading, cx } from "@/components/ui";
import { AdminProvider } from "@/lib/admin";
import { supabase, type Tables } from "@/lib/supabase/client";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/verifications", label: "ID checks", icon: "shield" },
  { href: "/disputes", label: "Disputes", icon: "alert" },
  { href: "/review", label: "Flagged requests", icon: "bag" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/users", label: "Students", icon: "user" },
  { href: "/places", label: "Places and rules", icon: "route" },
  { href: "/money", label: "Money", icon: "wallet" },
  { href: "/audit", label: "Audit log", icon: "settings" },
];

/** Loads the signed-in admin; anyone else is signed out. */
export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Tables<"profiles"> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const db = supabase();
    void (async () => {
      const { data: claims } = await db.auth.getClaims();
      const uid = claims?.claims?.sub;
      const { data } = uid ? await db.from("profiles").select("*").eq("id", uid).single() : { data: null };
      if (!data || data.role !== "admin") {
        await db.auth.signOut();
        router.replace("/login");
        return;
      }
      setMe(data);
    })();
  }, [router]);

  useEffect(() => {
    if (!me) return;
    const db = supabase();
    const load = async () => {
      const [v, d, r] = await Promise.all([
        db.from("verifications").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        db.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        db.from("requests").select("id", { count: "exact", head: true }).eq("status", "review"),
      ]);
      setCounts({ "/verifications": v.count ?? 0, "/disputes": d.count ?? 0, "/review": r.count ?? 0 });
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [me, path]);

  if (!me) return <div className="flex min-h-dvh"><Loading /></div>;

  return (
    <AdminProvider me={me}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 bg-navy p-4 text-white md:flex">
          <div className="mb-4 flex items-center gap-2 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark-white.svg" alt="" className="h-7 w-auto" />
            <span className="font-display text-[17px] font-bold">Admin</span>
          </div>
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cx("flex min-h-10 items-center gap-3 rounded-lg px-3 text-[14px] no-underline", on ? "bg-white/15 font-semibold text-white" : "text-mist hover:bg-white/10")}>
                <Icon name={n.icon} size={18} /><span className="flex-1">{n.label}</span>
                {counts[n.href] ? <span className="rounded-full bg-orange px-2 py-0.5 text-[11.5px] font-bold text-navy">{counts[n.href]}</span> : null}
              </Link>
            );
          })}
          <div className="mt-auto flex flex-col gap-2 px-2 text-[12.5px] text-mist">
            <span>{me.full_name}</span>
            <Button size="md" variant="outline" onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}>Log out</Button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <nav className="flex gap-1 overflow-x-auto bg-navy px-3 py-2 md:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="shrink-0 rounded-lg px-3 py-2 text-[13px] text-white no-underline">{n.label}{counts[n.href] ? ` (${counts[n.href]})` : ""}</Link>
            ))}
          </nav>
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-5 md:p-8">{children}</main>
        </div>
      </div>
    </AdminProvider>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] font-semibold tracking-tight">{title}</h1>
        {sub && <p className="text-[14px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Compact table wrapper that scrolls sideways on small screens. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-left text-[13.5px]">
        <thead className="border-b border-line bg-bg text-[12px] font-semibold tracking-wide text-muted uppercase">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
