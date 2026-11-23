"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui";
import { signedUrl } from "@/lib/data";
import { TAB_SPRING } from "@/lib/motion";

/** Brand lockup. Navy art on light, white art on dark (CSS, not resolvedTheme, so SSR matches). */
export function Logo({ onPlate = false, size = "md" }: { onPlate?: boolean; size?: "md" | "lg" }) {
  const h = size === "lg" ? ["h-[104px]", "h-[74px]"] : ["h-8", "h-7"];
  const wrap = size === "lg" ? "flex-col gap-5" : "gap-2.5";
  /* eslint-disable @next/next/no-img-element */
  if (onPlate) {
    return (
      <div className={cn("flex items-center", wrap)}>
        <img src="/brand/mark-white.svg" alt="" className={cn("w-auto", h[0])} />
        <img src="/brand/wordmark-white.svg" alt="299 Relay" className={cn("w-auto", h[1])} />
      </div>
    );
  }
  return (
    <div className={cn("flex items-center", wrap)}>
      <img src="/brand/mark.svg" alt="" className={cn("w-auto dark:hidden", h[0])} />
      <img src="/brand/mark-white.svg" alt="" className={cn("hidden w-auto dark:block", h[0])} />
      <img src="/brand/wordmark.svg" alt="299 Relay" className={cn("w-auto dark:hidden", h[1])} />
      <img src="/brand/wordmark-white.svg" alt="299 Relay" className={cn("hidden w-auto dark:block", h[1])} />
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/jobs", label: "My jobs", icon: "jobs" },
  { href: "/wallet", label: "Wallet", icon: "wallet" },
  { href: "/profile", label: "Profile", icon: "user" },
];

/** Floating glass tab bar; the active pill springs between tabs. */
export function BottomNav() {
  const path = usePathname();
  return (
    <>
      <div aria-hidden className="h-24 shrink-0" />
      <nav aria-label="Main" className="glass fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 mx-auto flex h-16 w-[calc(100%-24px)] max-w-[456px] items-center justify-around rounded-full px-2 shadow-lift">
        {NAV.map((n) => {
          const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
              className={cn("relative isolate flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                on ? "font-semibold text-inverse-foreground dark:text-signal" : "font-medium text-ink-2 hover:text-foreground")}>
              {on && (
                <motion.span layoutId="tabbar-pill" layoutDependency={path} transition={TAB_SPRING} aria-hidden style={{ borderRadius: 9999 }}
                  className="absolute inset-0 -z-10 bg-inverse dark:bg-signal-soft" />
              )}
              <Icon name={n.icon} className="size-[18px]" />{n.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Pick photos from camera/gallery; thumbnails with remove buttons. */
export function PhotoPicker({ files, onChange, max = 3, capture, label = "Add photo" }:
  { files: File[]; onChange: (f: File[]) => void; max?: number; capture?: "user" | "environment"; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived object URLs need cleanup
    setUrls(u);
    return () => u.forEach(URL.revokeObjectURL);
  }, [files]);
  return (
    <div className="flex flex-wrap gap-2.5">
      {urls.map((u, i) => (
        <div key={u} className="relative animate-pop-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt={`Photo ${i + 1}`} className="size-[72px] rounded-2xl object-cover ring-1 ring-border" />
          <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-inverse text-inverse-foreground outline-none ring-2 ring-band focus-visible:ring-ring">
            <Icon name="x" className="size-3" />
          </button>
        </div>
      ))}
      {files.length < max && (
        <button type="button" onClick={() => input.current?.click()}
          className="flex size-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-input bg-sheet text-ink-2 outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:bg-card">
          <Icon name="camera" className="size-5" />
          <span className="text-[10.5px] font-medium">{label}</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/*" capture={capture} hidden tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange([...files, f]);
          e.target.value = "";
        }} />
    </div>
  );
}

/** Private image via a short-lived signed URL, with a shimmer while loading. */
export function StoredImage({ bucket, path, alt, className, zoom = false }:
  { bucket: string; path: string | null | undefined; alt: string; className?: string; zoom?: boolean }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined); // undefined = loading, null = missing
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    void signedUrl(bucket, path).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [bucket, path]);
  if (url === null) return <div className={cn("grid place-items-center rounded-2xl bg-card-nested text-[12px] text-ink-2", className)}>Photo not available</div>;
  if (!url) return <div className={cn("skeleton rounded-2xl", className)} role="img" aria-label={alt} />;
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={url} alt={alt} className={cn("rounded-2xl object-cover", className)} />;
  if (!zoom) return img;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`View ${alt.toLowerCase()} full size`}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] transition-transform">
        {img}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={alt} size="md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="max-h-[70svh] w-full rounded-2xl bg-card-nested object-contain" />
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 block text-center text-[13px] font-semibold text-signal-ink">Open original</a>
      </Dialog>
    </>
  );
}

/** Four boxes for a 4-digit handoff code (one real input underneath). */
export function CodeInput({ value, onChange, disabled, invalid }: { value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={4} value={value} disabled={disabled}
        aria-label="Handoff code" aria-invalid={invalid || undefined}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="absolute inset-0 z-10 w-full cursor-text opacity-0" />
      <div className="grid grid-cols-4 gap-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const current = focused && i === Math.min(value.length, 3);
          return (
            <span key={i} style={{ "--i": i } as CSSProperties}
              className={cn("relative grid h-16 place-items-center rounded-2xl border-[1.5px] bg-sheet font-mono text-[30px] font-medium tabular transition-[border-color,box-shadow] duration-150 dark:bg-card-nested",
                invalid ? "border-critical" : current ? "border-ring ring-2 ring-ring/25" : "border-input")}>
              {value[i] ?? ""}
              {current && !value[i] && <span className="absolute h-7 w-0.5 animate-pulse rounded-full bg-signal" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}
