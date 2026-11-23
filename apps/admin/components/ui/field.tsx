"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Shared input shell (Raven input recipe, sized for touch). */
export function fieldShell(invalid?: boolean) {
  return cn(
    "w-full min-w-0 rounded-2xl border bg-sheet px-3.5 text-[15px] text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-150",
    "placeholder:text-ink-3 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
    "disabled:pointer-events-none disabled:opacity-50 dark:bg-card-nested dark:hover:border-foreground/25",
    invalid ? "border-critical" : "border-input",
  );
}

export function Field({ label, hint, error, htmlFor, labelId, children, optional }: {
  label: ReactNode; hint?: ReactNode; error?: string | null; htmlFor?: string; labelId?: string; children: ReactNode; optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label id={labelId} htmlFor={htmlFor} className="text-[13.5px] font-medium text-foreground">
        {label}{optional && <span className="font-normal text-ink-3"> · optional</span>}
      </label>
      {children}
      {error ? <span role="alert" className="text-[12.5px] text-critical">{error}</span>
        : hint ? <span className="text-[12.5px] leading-snug text-ink-2">{hint}</span> : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} {...props} className={cn(fieldShell(invalid), "h-12", className)} />;
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} {...props} className={cn(fieldShell(invalid), "resize-none py-3 leading-snug", className)} />;
}

/** Naira amount input with a fixed ₦ prefix. */
export function MoneyInput({ className, ...props }: Omit<ComponentProps<"input">, "type" | "inputMode">) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-ink-2">₦</span>
      <input inputMode="decimal" {...props} className={cn(fieldShell(), "h-12 pl-8 tabular", className)} />
    </div>
  );
}

/** Search box: icon, clear button, optional "/" shortcut. */
export function SearchInput({ value, onChange, placeholder = "Search", shortcut = false, className, "aria-label": ariaLabel }: {
  value: string; onChange: (v: string) => void; placeholder?: string; shortcut?: boolean; className?: string; "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shortcut) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [shortcut]);
  return (
    <div className={cn("relative", className)}>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-2" />
      <input ref={ref} type="text" role="searchbox" value={value} placeholder={placeholder} aria-label={ariaLabel ?? placeholder}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onChange("")}
        className={cn(fieldShell(), "h-11 rounded-pill pr-16 pl-11")} />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button type="button" onClick={() => { onChange(""); ref.current?.focus(); }} aria-label="Clear search"
            className="grid size-7 place-items-center rounded-full text-ink-2 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none">
            <Icon name="x" className="size-3.5" />
          </button>
        ) : shortcut ? <Kbd>/</Kbd> : null}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-muted px-1 font-mono text-[11px] text-ink-2 select-none">{children}</kbd>;
}

/** Custom checkbox: a real button with role=checkbox and its label as content. */
export function Checkbox({ checked, onChange, children, disabled, className }: {
  checked: boolean; onChange: (v: boolean) => void; children?: ReactNode; disabled?: boolean; className?: string;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("group/cb flex items-start gap-3 rounded-xl text-left text-[13.5px] leading-snug text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className)}>
      <span aria-hidden className={cn("mt-px grid size-5 shrink-0 place-items-center rounded-[6px] border-[1.5px] transition-colors duration-150",
        checked ? "border-inverse bg-inverse text-inverse-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground" : "border-foreground/40 bg-sheet dark:bg-card-nested")}>
        {checked && <Icon name="check" className="size-3.5" strokeWidth={3} />}
      </span>
      {children && <span>{children}</span>}
    </button>
  );
}

/** Custom switch with label + description. */
export function Switch({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span id={`${id}-l`} className="text-[14.5px] font-medium">{label}</span>
        {description && <span id={`${id}-d`} className="text-[12.5px] leading-snug text-ink-2">{description}</span>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-7 w-12 shrink-0 rounded-pill transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sheet disabled:opacity-50",
          checked ? "bg-primary" : "bg-foreground/15")}>
        <span aria-hidden className={cn("absolute top-1 size-5 rounded-full bg-sheet shadow-sm transition-[left] duration-200 ease-[var(--ease-out-quint)]", checked ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}
