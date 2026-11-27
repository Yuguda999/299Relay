"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { DIALOG_SPRING } from "@/lib/motion";

/** Renders children into document.body (after mount, so SSR stays clean). */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only on the client
    setMounted(true);
  }, []);
  return mounted ? createPortal(children, document.body) : null;
}

type Placement = { top: number; left: number; width: number; maxHeight: number; above: boolean };

/**
 * Positions a floating layer under (or above, when there's no room) an anchor,
 * in fixed coordinates so scroll containers never clip it.
 */
export function useAnchoredPosition(anchor: RefObject<HTMLElement | null>, open: boolean, preferred = 320, minWidth = 0) {
  const [pos, setPos] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 6;
      const below = window.innerHeight - r.bottom - gap - 12;
      const aboveSpace = r.top - gap - 12;
      const above = below < Math.min(preferred, 220) && aboveSpace > below;
      const maxHeight = Math.max(160, Math.min(preferred, above ? aboveSpace : below));
      const width = Math.max(r.width, minWidth);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setPos({ top: above ? r.top - gap : r.bottom + gap, left, width, maxHeight, above });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchor, preferred, minWidth]);
  return pos;
}

/** Closes on pointer-down outside any of the given elements. */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onClose: () => void) {
  const cb = useRef(onClose);
  useEffect(() => {
    cb.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      cb.current();
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. A bottom sheet on phones, a centred card from `sm` up.
 * Traps focus, closes on Escape and scrim tap, restores focus on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, dismissable = true, size = "sm" }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode;
  dismissable?: boolean; size?: "sm" | "md";
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const restore = useRef<HTMLElement | null>(null);
  // Parents usually pass an inline onClose, which is new on every render. Read it
  // through a ref so the open/focus effect below runs only when `open` changes;
  // otherwise each keystroke re-ran it and yanked focus back to the first field.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel.current)?.focus();
    }, 30);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // a nested select/popover already handled it
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0]!, last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", key);
      restore.current?.focus?.();
    };
  }, [open, dismissable]);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div aria-hidden className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.16 }}
              onClick={() => dismissable && onClose()} />
            <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} tabIndex={-1}
              initial={{ opacity: 0, y: 32, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, transition: { duration: reduce ? 0 : 0.14 } }}
              transition={reduce ? { duration: 0 } : DIALOG_SPRING}
              className={cn("relative flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-frame bg-popover text-popover-foreground shadow-pop outline-none sm:rounded-card",
                size === "sm" ? "sm:max-w-sm" : "sm:max-w-lg")}>
              <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-pill bg-foreground/15 sm:hidden" />
              <div className="flex items-start gap-3 px-5 pt-4 sm:pt-5">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 id={titleId} className="font-display text-[19px] leading-tight font-semibold tracking-[-0.01em]">{title}</h2>
                  {description && <p id={descId} className="text-[13.5px] leading-relaxed text-pretty text-ink-2">{description}</p>}
                </div>
                {dismissable && (
                  <button type="button" onClick={onClose} aria-label="Close"
                    className="-mt-1 -mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-ink-2 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                    <Icon name="x" className="size-[18px]" />
                  </button>
                )}
              </div>
              {children && <div className="min-h-0 overflow-y-auto px-5 pt-4">{children}</div>}
              {footer && <div className="flex flex-col-reverse gap-2 px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-5">{footer}</div>}
              {!footer && <div className="pb-[max(20px,env(safe-area-inset-bottom))] sm:pb-5" />}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
