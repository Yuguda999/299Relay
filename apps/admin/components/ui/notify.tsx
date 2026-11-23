"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { BANNER_SPRING } from "@/lib/motion";
import { Button } from "./button";
import { Dialog, Portal } from "./overlay";

// ─── Toasts ───────────────────────────────────────────────────────────────
type ToastTone = "ok" | "info" | "critical" | "message";
type Toast = { id: number; title: string; body?: string; tone: ToastTone; href?: string };
const ICON: Record<ToastTone, { icon: IconName; cls: string }> = {
  ok: { icon: "ok", cls: "text-ok" },
  info: { icon: "info", cls: "text-ink-2" },
  critical: { icon: "error", cls: "text-critical" },
  message: { icon: "chat", cls: "text-signal-ink" },
};

// ─── Confirm ──────────────────────────────────────────────────────────────
type ConfirmOptions = { title: string; body?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: "default" | "danger" };

type Ctx = {
  /** `href` makes the whole toast a link (e.g. a new chat message). */
  toast: (t: { title: string; body?: string; tone?: ToastTone; href?: string }) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
};
const NotifyCtx = createContext<Ctx | null>(null);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback<Ctx["toast"]>(({ title, body, tone = "ok", href }) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, title, body, tone, href }]);
    setTimeout(() => dismiss(id), tone === "critical" || tone === "message" ? 6500 : 3800);
  }, [dismiss]);

  const confirm = useCallback<Ctx["confirm"]>((o) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const settle = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <NotifyCtx.Provider value={{ toast, confirm }}>
      {children}
      <Portal>
        <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 top-0 z-[210] flex flex-col items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]">
          <AnimatePresence initial={false}>
            {toasts.map((t) => (
              <motion.div key={t.id} layout={!reduce}
                initial={{ opacity: 0, y: -16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, transition: { duration: reduce ? 0 : 0.16 } }}
                transition={reduce ? { duration: 0 } : BANNER_SPRING}
                role={t.tone === "critical" ? "alert" : "status"}
                className="glass pointer-events-auto relative flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-lift">
                {t.href && <Link href={t.href} onClick={() => dismiss(t.id)} aria-label={`Open: ${t.title}`} className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
                <Icon name={ICON[t.tone].icon} className={cn("mt-px size-[18px] shrink-0", ICON[t.tone].cls)} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[14px] font-semibold">{t.title}</p>
                  {t.body && <p className="text-[13px] leading-snug text-ink-2">{t.body}</p>}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss"
                  className="relative -mt-0.5 -mr-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  <Icon name="x" className="size-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Portal>
      <Dialog open={Boolean(dialog)} onClose={() => settle(false)} title={dialog?.title ?? ""} description={dialog?.body}
        footer={
          <>
            <Button variant="surface" size="pill" onClick={() => settle(false)}>{dialog?.cancelLabel ?? "Keep it"}</Button>
            <Button variant={dialog?.tone === "danger" ? "destructive" : "primary"} size="pill" data-autofocus onClick={() => settle(true)}>
              {dialog?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        } />
    </NotifyCtx.Provider>
  );
}

export function useNotify(): Ctx {
  const c = useContext(NotifyCtx);
  if (!c) throw new Error("useNotify outside NotifyProvider");
  return c;
}
