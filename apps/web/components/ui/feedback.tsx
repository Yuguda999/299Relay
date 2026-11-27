"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

// ── Inline alert ──
type Tone = "info" | "ok" | "warn" | "critical" | "signal";
const ALERT: Record<Tone, { box: string; icon: IconName }> = {
  info: { box: "bg-card text-foreground ring-1 ring-border dark:ring-glass-border [&_.alert-icon]:text-ink-2", icon: "info" },
  ok: { box: "bg-ok/10 text-foreground [&_.alert-icon]:text-ok", icon: "ok" },
  warn: { box: "bg-warn/10 text-foreground [&_.alert-icon]:text-warn", icon: "alert" },
  critical: { box: "bg-critical/10 text-foreground [&_.alert-icon]:text-critical", icon: "error" },
  signal: { box: "bg-signal-soft text-foreground [&_.alert-icon]:text-signal-ink", icon: "info" },
};

/** Inline alert. Critical alerts are announced (role=alert); others are polite status. */
export function Alert({ tone = "info", title, children, action, className }:
  { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  if (!children && !title) return null;
  const t = ALERT[tone];
  return (
    <div role={tone === "critical" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-2xl px-3.5 py-3 text-[13.5px] leading-snug animate-rise-in", t.box, className)}>
      <Icon name={t.icon} className="alert-icon mt-px size-[18px] shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "text-ink-2" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

// ── Status chip ──
const CHIP = {
  ok: { pill: "bg-ok/12 text-ok", dot: "bg-ok" },
  warn: { pill: "bg-warn/12 text-warn", dot: "bg-warn" },
  critical: { pill: "bg-critical/12 text-critical", dot: "bg-critical" },
  live: { pill: "bg-signal-soft text-signal-ink", dot: "bg-signal" },
  idle: { pill: "text-ink-2 ring-1 ring-border dark:ring-glass-border", dot: "bg-ink-3" },
  muted: { pill: "bg-foreground/[0.06] text-ink-2", dot: "bg-ink-3" },
} as const;
export type ChipTone = keyof typeof CHIP;

export function StatusChip({ tone = "idle", children, dot = true, className }: { tone?: ChipTone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-pill px-2.5 font-mono text-[10.5px] tracking-wide whitespace-nowrap uppercase", CHIP[tone].pill, className)}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", CHIP[tone].dot)} />}
      {children}
    </span>
  );
}

// ── Empty state: hairline rings around the signal dot ──
export function EmptyState({ title, body, action, tone = "signal" }: { title: string; body?: ReactNode; action?: ReactNode; tone?: "signal" | "critical" }) {
  return (
    <div role={tone === "critical" ? "alert" : undefined} className="flex flex-col items-center justify-center px-8 py-12 text-center animate-rise-in">
      <span aria-hidden className="relative grid size-24 place-items-center">
        <span className="absolute inset-0 rounded-full ring-1 ring-border dark:ring-glass-border" />
        <span className="absolute inset-4 rounded-full ring-1 ring-border dark:ring-glass-border" />
        <span className="grid size-8 place-items-center rounded-full bg-card-nested ring-1 ring-border dark:ring-glass-border">
          <span className={cn("size-2 rounded-full", tone === "critical" ? "bg-critical" : "bg-signal")} />
        </span>
      </span>
      <p className="mt-6 font-display text-xl leading-tight font-semibold tracking-[-0.01em]">{title}</p>
      {body && <div className="mt-2 max-w-xs text-[13px] leading-relaxed text-pretty text-ink-2">{body}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ── Skeletons shaped like list rows, fading down ──
const WIDTHS = [["w-28", "w-3/4"], ["w-20", "w-2/3"], ["w-32", "w-1/2"], ["w-24", "w-3/5"]];
export function RowSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[20px] bg-card p-3.5 dark:ring-1 dark:ring-glass-border" style={{ opacity: Math.max(0.25, 1 - i * 0.12) }}>
          <span className="skeleton size-10 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className={cn("skeleton h-3.5", WIDTHS[i % 4]![0])} />
            <span className={cn("skeleton h-3", WIDTHS[i % 4]![1])} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-3 py-4" aria-busy="true" aria-label={label}>
      <RowSkeletons count={3} />
    </div>
  );
}
