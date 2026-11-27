import Link from "next/link";
import { Logo } from "@/components/app-bits";

/** Splash on the brand plate (dark in both themes on purpose). */
export default function Splash() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-plate text-plate-ink">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="animate-bloom"><Logo onPlate size="lg" /></div>
        <p className="entrance font-mono text-[12px] tracking-[0.34em] text-plate-ink-2 uppercase" style={{ "--i": 4 } as React.CSSProperties}>
          Together, we move.
        </p>
      </div>
      <div className="entrance flex flex-col gap-3 px-6 pb-[max(34px,env(safe-area-inset-bottom))]" style={{ "--i": 6 } as React.CSSProperties}>
        <Link href="/welcome"
          className="flex h-12 items-center justify-center rounded-pill bg-primary text-[15px] font-semibold text-primary-foreground no-underline outline-none transition-transform focus-visible:ring-2 focus-visible:ring-plate-ink active:scale-[0.98]">
          Get started
        </Link>
        <span className="text-center font-mono text-[11px] tracking-wide text-plate-ink-2 uppercase">Starting at ABU Zaria</span>
      </div>
    </main>
  );
}
