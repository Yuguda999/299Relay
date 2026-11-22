"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "@/components/ui";
import { signedUrl } from "@/lib/data";

export const Logo = ({ white = false }: { white?: boolean }) => (
  <div className="flex items-center gap-2.5">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={white ? "/brand/mark-white.svg" : "/brand/mark.svg"} alt="" className="h-[34px] w-auto" />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={white ? "/brand/wordmark-white.svg" : "/brand/wordmark.svg"} alt="299 Relay" className="h-8 w-auto" />
  </div>
);

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/jobs", label: "My jobs", icon: "jobs" },
  { href: "/wallet", label: "Wallet", icon: "wallet" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-10 grid grid-cols-4 border-t border-line bg-white px-2 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
      {NAV.map((n) => {
        const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
            className={cx("flex min-h-11 flex-col items-center justify-center gap-1 text-[11.5px] no-underline", on ? "font-semibold text-navy" : "font-medium text-muted")}>
            <Icon name={n.icon} />{n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Pick photos from camera/gallery; shows thumbnails; hands back File objects. */
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
    <div className="flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <div key={u} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt={`Photo ${i + 1}`} className="size-16 rounded-[10px] object-cover" />
          <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-ink text-white">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      {files.length < max && (
        <button type="button" aria-label={label} onClick={() => input.current?.click()}
          className="flex size-16 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#B4BCC9] bg-white text-navy">
          <Icon name="camera" />
        </button>
      )}
      <input ref={input} type="file" accept="image/*" capture={capture} hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange([...files, f]);
          e.target.value = "";
        }} />
    </div>
  );
}

/** Private image from storage via a short-lived signed URL. */
export function StoredImage({ bucket, path, alt, className }: { bucket: string; path: string | null | undefined; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void signedUrl(bucket, path).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [bucket, path]);
  if (!url) return <div className={cx("bg-tab", className)} aria-label={alt} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={cx("object-cover", className)} />;
}

/** Four boxes for a 4-digit handoff code. */
export function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={4} value={value} disabled={disabled}
        aria-label="Handoff code"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="absolute inset-0 z-10 w-full opacity-0" />
      <div className="grid grid-cols-4 gap-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx("flex h-16 items-center justify-center rounded-xl border-[1.5px] bg-white font-display text-[32px] font-bold",
            i === value.length ? "border-navy" : "border-field")}>
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

