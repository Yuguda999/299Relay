"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useThemeSwitch } from "@/components/providers";
import { Button, Dialog, Loading, cn, useNotify } from "@/components/ui";
import { AdminProvider } from "@/lib/admin";
import { TAB_SPRING } from "@/lib/motion";
import { supabase, type Tables } from "@/lib/supabase/client";

const NAV: { section: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  { section: "Today", items: [
    { href: "/", label: "Overview", icon: "dashboard" },
    { href: "/verifications", label: "ID checks", icon: "shield" },
    { href: "/disputes", label: "Disputes", icon: "alert" },
    { href: "/review", label: "Flagged requests", icon: "flag" },
  ] },
  { section: "Records", items: [
    { href: "/jobs", label: "Jobs", icon: "jobs" },
    { href: "/users", label: "Students", icon: "users" },
    { href: "/money", label: "Money", icon: "wallet" },
    { href: "/audit", label: "Audit log", icon: "log" },
  ] },
  { section: "Setup", items: [{ href: "/places", label: "Places and rules", icon: "pin" }] },
];

/** Loads the signed-in admin; anyone else is signed out. */
export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<Tables<"profiles"> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [menu, setMenu] = useState(false);

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

  if (!me) return <div className="mx-auto max-w-xl p-10"><Loading /></div>;

  const nav = (
    <nav aria-label="Admin" className="flex flex-col">
      {NAV.map((g) => (
        <div key={g.section} className="flex flex-col gap-0.5">
          <h2 className="readout px-3 pt-6 pb-2">{g.section}</h2>
          {g.items.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} onClick={() => setMenu(false)} aria-current={on ? "page" : undefined}
                className={cn("relative isolate flex h-10 items-center gap-3 rounded-pill px-3 text-[13.5px] no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "font-semibold text-inverse-foreground dark:text-signal" : "font-medium text-ink-2 hover:bg-card hover:text-foreground")}>
                {on && <motion.span layoutId="admin-nav" layoutDependency={path} transition={TAB_SPRING} aria-hidden style={{ borderRadius: 9999 }}
                  className="absolute inset-0 -z-10 bg-inverse dark:bg-signal-soft dark:shadow-glow" />}
                <Icon name={n.icon} className="size-4" />
                <span className="flex-1">{n.label}</span>
                {counts[n.href] ? (
                  <span className="tabular flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{counts[n.href]}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <AdminProvider me={me}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-band px-3 py-5 lg:flex dark:border-r dark:border-glass-border">
          <Brand />
          <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
          <Account me={me} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-band/90 px-4 backdrop-blur-md lg:hidden">
            <Brand />
            <Button variant="surface" size="sm" onClick={() => setMenu(true)} aria-label="Open menu"><Icon name="dashboard" className="size-4" />Menu</Button>
          </header>
          <main className="flex min-h-full flex-1 flex-col bg-sheet lg:rounded-frame dark:bg-sheet dark:ring-1 dark:ring-glass-border">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-8 md:py-8">{children}</div>
          </main>
        </div>
      </div>
      <Dialog open={menu} onClose={() => setMenu(false)} title="Admin">
        {nav}
        <div className="pt-4"><Account me={me} /></div>
      </Dialog>
    </AdminProvider>
  );
}

function Brand() {
  /* eslint-disable @next/next/no-img-element */
  return (
    <div className="flex items-center gap-2 px-3">
      <img src="/brand/mark.svg" alt="" className="h-7 w-auto dark:hidden" />
      <img src="/brand/mark-white.svg" alt="" className="hidden h-7 w-auto dark:block" />
      <span className="font-display text-[16px] font-semibold tracking-[-0.01em]">Relay admin</span>
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}

function Account({ me }: { me: Tables<"profiles"> }) {
  const router = useRouter();
  const { confirm } = useNotify();
  const { theme, switchTo } = useThemeSwitch();
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-2 rounded-pill bg-sheet p-1.5 pl-3 ring-1 ring-border dark:bg-card dark:ring-glass-border">
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{me.full_name}</span>
      <Button variant="ghost" size="circle-sm" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        onClick={(e) => switchTo(dark ? "light" : "dark", { x: e.clientX, y: e.clientY })}>
        <Icon name="moon" className="dark:hidden" /><Icon name="sun" className="hidden dark:block" />
      </Button>
      <Button variant="ghost" size="circle-sm" aria-label="Log out"
        onClick={async () => { if (await confirm({ title: "Log out of admin?", confirmLabel: "Log out" })) { await supabase().auth.signOut(); router.replace("/login"); } }}>
        <Icon name="logout" />
      </Button>
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        {sub && <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-2">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Table on a bento card; scrolls sideways on narrow screens. */
export function Table({ head, children, minWidth = 680 }: { head: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="bento overflow-x-auto p-1.5">
      <table className="w-full text-left text-[13.5px]" style={{ minWidth }}>
        <thead>
          <tr>{head.map((h) => <th key={h} className="readout px-3.5 pt-2.5 pb-2 font-normal">{h}</th>)}</tr>
        </thead>
        <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-card-nested [&>tr>td]:px-3.5 [&>tr>td]:py-3 [&>tr>td:first-child]:rounded-l-[14px] [&>tr>td:last-child]:rounded-r-[14px]">
          {children}
        </tbody>
      </table>
    </div>
  );
}
