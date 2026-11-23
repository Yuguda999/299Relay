"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { TAB_SPRING } from "@/lib/motion";

/** Pill tabs with one springing indicator per group. Arrow keys wrap. */
export function PillTabs<T extends string>({ value, onChange, options, "aria-label": ariaLabel, className, fill = true }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; "aria-label"?: string; className?: string; fill?: boolean;
}) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n]!.value);
    refs.current[n]?.focus();
  }
  return (
    <div role="tablist" aria-label={ariaLabel}
      className={cn("flex items-center rounded-pill bg-sheet p-1 ring-1 ring-border dark:bg-card dark:ring-glass-border", !fill && "inline-flex", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}
            className={cn("relative isolate inline-flex h-10 items-center justify-center gap-1.5 rounded-pill px-4 text-[13.5px] font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
              fill && "flex-1", active ? "text-inverse-foreground dark:text-signal" : "text-ink-2 hover:text-foreground")}>
            {active && (
              <motion.span layoutId={layoutId} layoutDependency={value} transition={TAB_SPRING} aria-hidden style={{ borderRadius: 9999 }}
                className="absolute inset-0 -z-10 bg-inverse dark:bg-signal-soft" />
            )}
            {o.label}
            {o.count ? <span className="tabular font-mono text-[11px] opacity-80">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Single-choice chips (radio group) for short option sets. */
export function ChoiceChips<T extends string | number>({ value, onChange, options, "aria-label": ariaLabel, className, columns }: {
  value: T | T[]; onChange: (v: T) => void; options: { value: T; label: string; disabled?: boolean }[]; "aria-label"?: string; className?: string; columns?: number;
}) {
  const multi = Array.isArray(value);
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={ariaLabel}
      className={cn(columns ? "grid gap-2" : "flex flex-wrap gap-2", className)}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
      {options.map((o) => {
        const on = multi ? (value as T[]).includes(o.value) : value === o.value;
        return (
          <button key={String(o.value)} type="button" role={multi ? "checkbox" : "radio"} aria-checked={on} disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn("inline-flex h-11 items-center justify-center rounded-pill px-4 text-[13.5px] whitespace-nowrap outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 active:scale-[0.97]",
              on ? "bg-inverse font-semibold text-inverse-foreground dark:bg-signal-soft dark:text-signal dark:ring-1 dark:ring-signal/40"
                : "bg-sheet font-medium text-foreground ring-1 ring-border hover:bg-card dark:bg-card dark:ring-glass-border dark:hover:bg-card-nested")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
