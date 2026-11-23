"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const circleBtn = "grid size-11 shrink-0 place-items-center rounded-full text-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-95";

/** Screen header: back circle, display title, mono subtitle, right slot. */
export function Header({ title, subtitle, back = true, right }: { title: string; subtitle?: string; back?: boolean | string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-1.5 bg-band/90 px-3 pt-[max(10px,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
      {back && (typeof back === "string"
        ? <Link href={back} aria-label="Back" className={circleBtn}><Icon name="back" className="size-5" /></Link>
        : <button type="button" onClick={() => router.back()} aria-label="Back" className={circleBtn}><Icon name="back" className="size-5" /></button>)}
      <div className={cn("flex min-w-0 flex-1 flex-col", !back && "pl-2")}>
        <h1 className="truncate font-display text-[20px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
        {subtitle && <span className="truncate font-mono text-[11px] tracking-wide text-ink-2 uppercase">{subtitle}</span>}
      </div>
      {right}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("flex flex-1 flex-col gap-3 px-4 pt-2 pb-6", className)}>{children}</main>;
}

/** Sticky glass action bar at the bottom of a screen. */
export function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="glass sticky bottom-0 z-20 flex flex-col gap-2.5 border-x-0 border-b-0 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

/** Bento card. Pass `i` for a staggered entrance. */
export function Card({ children, className, as: As = "section", i, ...rest }:
  { children: ReactNode; className?: string; as?: "section" | "article" | "div"; i?: number } & Record<string, unknown>) {
  return (
    <As className={cn("bento p-4", i !== undefined && "entrance", className)} style={i !== undefined ? ({ "--i": i } as CSSProperties) : undefined} {...rest}>
      {children}
    </As>
  );
}

/** Tile inside a card. */
export function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[18px] bg-card-nested p-3.5 dark:ring-1 dark:ring-glass-border", className)}>{children}</div>;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pt-3">
      <h2 className="readout">{children}</h2>
      {right}
    </div>
  );
}

/** Key/value line; values are tabular. */
export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong ? "text-[15px] font-semibold" : "text-[13.5px]")}>
      <span className={strong ? "" : "text-ink-2"}>{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}

/** Mono-initials avatar on neutral tints (never the signal). */
const TINTS = ["bg-foreground/[0.07]", "bg-foreground/[0.11]", "bg-foreground/[0.05]"];
export function Avatar({ name, src, size = 40 }: { name?: string | null; src?: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-1 ring-border" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-mono font-medium text-foreground", TINTS[(name?.charCodeAt(0) ?? 0) % TINTS.length])}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {initials(name)}
    </span>
  );
}

/** Stretched-link list row card: the whole card opens `href`. */
export function LinkRow({ href, children, className, active, i }: { href: string; children: ReactNode; className?: string; active?: boolean; i?: number }) {
  return (
    <div className={cn("group/row relative rounded-[20px] p-3.5 transition-[background-color,box-shadow] duration-200", i !== undefined && "entrance",
      active ? "bg-signal-soft ring-1 ring-signal/30" : "bg-card hover:bg-card-nested hover:shadow-lift dark:ring-1 dark:ring-glass-border", className)}
      style={i !== undefined ? ({ "--i": i } as CSSProperties) : undefined}>
      {children}
      <Link href={href} className="absolute inset-0 rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open" />
    </div>
  );
}

/** Small brand-dot unread marker. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full bg-signal", className)} />;
}
