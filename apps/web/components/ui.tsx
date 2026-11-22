"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { initials } from "@/lib/format";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ── Buttons ──
type Variant = "primary" | "dark" | "outline" | "soft" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-orange text-navy font-bold",
  dark: "bg-ink text-white font-semibold",
  outline: "bg-white text-ink border border-field font-semibold",
  soft: "bg-soft text-navy font-semibold",
  danger: "bg-white text-danger border border-danger/40 font-semibold",
};
const SIZES = { lg: "min-h-[54px] rounded-[14px] text-base px-5", md: "min-h-11 rounded-[10px] text-[14px] px-4" };

export function Button({ variant = "primary", size = "lg", loading, className, children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; loading?: boolean }) {
  return (
    <button type="button" disabled={disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 transition-opacity disabled:opacity-50", VARIANTS[variant], SIZES[size], className)}
      {...rest}>
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "lg", className, ...rest }:
  ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={cx("inline-flex items-center justify-center gap-2 no-underline", VARIANTS[variant], SIZES[size], className)} {...rest} />;
}

/** Two-tap confirm: first tap arms it, second tap runs. Avoids blocking dialogs. */
export function ConfirmButton({ onConfirm, confirmLabel = "Tap again to confirm", children, ...rest }:
  Omit<ComponentProps<typeof Button>, "onClick"> & { onConfirm: () => void; confirmLabel?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button {...rest} variant={armed ? "danger" : rest.variant} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : children}
    </Button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-label="Loading" className={cx("inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

// ── Layout ──
export function Header({ title, subtitle, back = true, right }: { title: string; subtitle?: string; back?: boolean | string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-bg/95 px-3 pt-3.5 pb-1 backdrop-blur">
      {back && (
        typeof back === "string"
          ? <Link href={back} aria-label="Back" className="flex size-11 items-center justify-center rounded-xl text-ink"><Icon name="back" /></Link>
          : <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-11 items-center justify-center rounded-xl text-ink"><Icon name="back" /></button>
      )}
      <div className={cx("flex min-w-0 flex-1 flex-col", !back && "pl-2")}>
        <h1 className="truncate font-display text-[21px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <span className="truncate text-[12.5px] text-muted">{subtitle}</span>}
      </div>
      {right}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx("flex flex-1 flex-col gap-3 px-5 pt-2 pb-6", className)}>{children}</main>;
}

/** Sticky bottom action area (like the canvas footers). */
export function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t border-line bg-white px-5 pt-3.5 pb-[max(24px,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

export function Card({ children, className, as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "article" | "div" } & Record<string, unknown>) {
  return <As className={cx("rounded-2xl border border-line bg-white p-3.5", className)} {...rest}>{children}</As>;
}

// ── Form ──
const fieldCls = "w-full rounded-xl border border-field bg-white px-3.5 py-3 text-[15px] text-ink min-h-12 placeholder:text-muted/70";

export function Field({ label, hint, htmlFor, children, error }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; error?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13.5px] font-semibold">{label}</label>
      {children}
      {error ? <span className="text-[12.5px] text-danger">{error}</span> : hint && <span className="text-[12.5px] text-muted">{hint}</span>}
    </div>
  );
}
export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(fieldCls, props.className)} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(fieldCls, "resize-none leading-snug", props.className)} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(fieldCls, "px-3", props.className)} />;
}

export function Chip({ on, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button type="button" aria-pressed={on}
      className={cx("min-h-11 rounded-full px-3.5 text-[13.5px]", on ? "border-[1.5px] border-navy bg-soft font-semibold text-navy" : "border border-field bg-white font-medium text-ink", className)}
      {...rest}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="grid rounded-xl bg-tab p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button key={o.value} role="tab" type="button" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx("min-h-11 rounded-[9px] px-2 text-[14px]", value === o.value ? "bg-white font-semibold text-ink" : "font-medium text-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Display ──
const TYPE_TONE: Record<string, string> = {
  buy: "bg-soft text-navy",
  pick_up: "bg-blue-soft text-blue",
  drop_off: "bg-blue-soft text-blue",
  urgent: "bg-amber-soft text-amber",
};
export function TypeBadge({ type, urgent }: { type: string; urgent?: boolean | null }) {
  const label = { buy: "BUY", pick_up: "PICK UP", drop_off: "DROP OFF" }[type] ?? type.toUpperCase();
  return (
    <span className={cx("rounded-md px-2 py-1 text-[12px] font-bold tracking-wide", TYPE_TONE[urgent ? "urgent" : type])}>
      {urgent ? `URGENT · ${label}` : label}
    </span>
  );
}

export function Pill({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "success" | "danger" | "amber" | "muted" }) {
  const t = { soft: "bg-soft text-navy", success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", amber: "bg-amber-soft text-amber", muted: "bg-tab text-muted" }[tone];
  return <span className={cx("rounded-full px-2 py-1 text-[12px] font-semibold whitespace-nowrap", t)}>{children}</span>;
}

const AVATAR_TONES = ["bg-soft text-navy", "bg-amber-soft text-amber", "bg-blue-soft text-blue"];
export function Avatar({ name, src, size = 40 }: { name?: string | null; src?: string | null; size?: number }) {
  const tone = AVATAR_TONES[(name?.charCodeAt(0) ?? 0) % AVATAR_TONES.length];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className={cx("flex shrink-0 items-center justify-center rounded-full font-bold", tone)} style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials(name)}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">{children}</p>;
}

export function Notice({ children, tone = "soft", action }: { children: ReactNode; tone?: "soft" | "amber" | "success"; action?: ReactNode }) {
  const t = { soft: "bg-soft text-navy", amber: "bg-amber-soft text-amber", success: "bg-success-soft text-success" }[tone];
  return (
    <div className={cx("flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[13.5px] leading-snug", t)}>
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-field bg-white/60 px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="text-[13.5px] text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function Loading() {
  return <div className="flex flex-1 items-center justify-center py-16 text-navy"><Spinner className="size-7" /></div>;
}

export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cx("flex justify-between gap-3", strong ? "text-[15px] font-bold" : "text-[13.5px] text-muted")}>
      <span>{label}</span><span className={strong ? "" : "text-ink"}>{value}</span>
    </div>
  );
}

export { cx };
