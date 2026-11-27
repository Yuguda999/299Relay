"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { EASE_OUT } from "@/lib/motion";
import { Portal, useAnchoredPosition, useDismiss } from "./overlay";
import { fieldShell } from "./field";

export type Option<T extends string = string> = { value: T; label: string; hint?: string; group?: string; disabled?: boolean };
/** Extra rows shown under the results when the search text isn't an existing option. */
export type CreateOption = { key: string; label: (query: string) => string; hint?: string };

/**
 * Custom select (ARIA combobox + listbox). Long lists get a search box.
 * Keyboard: ↑/↓ move, Home/End, Enter/Space choose, Esc close, type to jump.
 */
export function Select<T extends string = string>({
  id, value, onChange, options, placeholder = "Choose", searchable, searchPlaceholder = "Search", disabled, invalid,
  "aria-label": ariaLabel, "aria-labelledby": labelledBy, className, renderValue, size = "md", createOptions, onCreate,
}: {
  id?: string; value: T | "" | null | undefined; onChange: (v: T) => void; options: Option<T>[]; placeholder?: string;
  searchable?: boolean; searchPlaceholder?: string; disabled?: boolean; invalid?: boolean; "aria-label"?: string;
  "aria-labelledby"?: string; className?: string; renderValue?: (o: Option<T>) => ReactNode; size?: "md" | "sm";
  /** Let people add a value that isn't listed. onCreate returns the new value, or null if it failed. */
  createOptions?: CreateOption[]; onCreate?: (query: string, key: string) => Promise<T | null>;
}) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const listId = `${triggerId}-list`;
  const reduce = useReducedMotion();
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Phones get a full-screen picker: an anchored popover can't survive the on-screen keyboard.
  const [sheet, setSheet] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const typeahead = useRef({ text: "", at: 0 });
  const showSearch = Boolean(onCreate) || (searchable ?? options.length > 8);
  const [creating, setCreating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const typed = query.trim().replace(/\s+/g, " ");
  const creates = onCreate && createOptions && typed.length >= 3 && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase())
    ? createOptions : [];
  const count = filtered.length + creates.length;
  const selected = options.find((o) => o.value === value);
  const pos = useAnchoredPosition(trigger, open && !sheet, 320);

  function openList() {
    if (disabled) return;
    setQuery("");
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(i);
    const small = window.matchMedia("(max-width: 639px), (pointer: coarse)").matches;
    setSheet(small);
    if (small) setSheetTitle((labelledBy && document.getElementById(labelledBy)?.textContent?.replace(/·\s*optional/i, "").trim()) || ariaLabel || placeholder);
    setOpen(true);
  }
  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  }
  function choose(o: Option<T> | undefined) {
    if (!o || o.disabled) return;
    onChange(o.value);
    close();
  }
  async function create(c: CreateOption | undefined) {
    if (!c || !onCreate || creating) return;
    setCreating(c.key);
    try {
      const v = await onCreate(typed, c.key);
      if (v) { onChange(v); close(); }
    } finally {
      setCreating(null);
    }
  }
  function chooseAt(i: number) {
    if (i < filtered.length) choose(filtered[i]);
    else void create(creates[i - filtered.length]);
  }
  useDismiss(open, [trigger, pop], () => close(false));

  // Focus once the popover is actually mounted (it renders after the anchor is measured).
  const mounted = Boolean(open && (sheet || pos));
  useEffect(() => {
    if (!mounted) return;
    if (showSearch) search.current?.focus({ preventScroll: true });
    else listRef.current?.focus({ preventScroll: true });
  }, [mounted, showSearch]);

  // Close on Escape from anywhere, and when the page (not the list) scrolls.
  useEffect(() => {
    if (!open) return;
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); close(); }
    };
    // Follow the trigger while it stays visible (the hook repositions); close once it
    // slides under the sticky header or off screen (e.g. the page was scrolled away).
    const scroll = (e: Event) => {
      if (sheet || pop.current?.contains(e.target as Node)) return;
      const r = trigger.current?.getBoundingClientRect();
      if (!r || r.bottom < 72 || r.top > window.innerHeight - 48) close(false);
    };
    // Capture phase: runs before a surrounding Dialog's Escape handler, so only the picker closes.
    document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scroll, true);
    const prevOverflow = document.body.style.overflow;
    if (sheet) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", scroll, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, sheet]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function move(delta: number) {
    if (!count) return;
    let i = active;
    for (let n = 0; n < count; n++) {
      i = (i + delta + count) % count;
      if (!filtered[i]?.disabled) break;
    }
    setActive(i);
  }

  function onListKey(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(1); break;
      case "ArrowUp": e.preventDefault(); move(-1); break;
      case "Home": e.preventDefault(); setActive(0); break;
      case "End": e.preventDefault(); setActive(count - 1); break;
      case "Enter": e.preventDefault(); chooseAt(active); break;
      case " ": if (!showSearch) { e.preventDefault(); chooseAt(active); } break;
      case "Escape": e.preventDefault(); close(); break;
      case "Tab": close(false); break;
      default:
        if (!showSearch && e.key.length === 1) {
          const now = Date.now();
          const t = typeahead.current;
          t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const i = filtered.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
          if (i >= 0) setActive(i);
        }
    }
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  const big = sheet; // larger touch rows in the full-screen picker
  const panel = (
    <>
      {showSearch && (
        <div className={cn("relative shrink-0 border-b border-border", big ? "px-4 pb-3" : "p-2")}>
          <Icon name="search" className={cn("pointer-events-none absolute size-4 -translate-y-1/2 text-ink-3", big ? "top-[calc(50%-6px)] left-8" : "top-1/2 left-5")} />
          <input ref={search} type="text" role="searchbox" value={query} placeholder={searchPlaceholder}
            aria-controls={listId} aria-activedescendant={active < count ? `${listId}-${active}` : undefined}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onListKey}
            className={cn("w-full rounded-pill bg-card pr-3 pl-9 text-foreground", big ? "h-12 text-[16px]" : "h-10 text-[14px]", "outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring/40")} />
        </div>
      )}
      <ul ref={listRef} id={listId} role="listbox" tabIndex={showSearch ? -1 : 0} aria-labelledby={labelledBy ?? triggerId}
        aria-activedescendant={!showSearch && filtered[active] ? `${listId}-${active}` : undefined}
        onKeyDown={showSearch ? undefined : onListKey}
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none", big ? "px-2 pt-1 pb-[max(16px,env(safe-area-inset-bottom))]" : "p-1.5")}>
        {count === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-2">{onCreate && typed ? "Type at least 3 letters to add it" : "No matches"}</li>}
        {filtered.map((o, i) => {
          const header = o.group && o.group !== filtered[i - 1]?.group ? o.group : null;
          const isSel = o.value === value;
          return (
            <li key={`${o.value}:${i}`} role="presentation">
              {header && <div className="readout px-3 pt-3 pb-1.5">{header}</div>}
              <div id={`${listId}-${i}`} data-index={i} role="option" aria-selected={isSel} aria-disabled={o.disabled || undefined}
                onPointerMove={() => !o.disabled && setActive(i)} onClick={() => choose(o)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", big ? "min-h-13 text-[15.5px]" : "min-h-11 text-[14.5px]",
                  i === active && "bg-muted", o.disabled && "cursor-not-allowed opacity-45", isSel && "font-semibold")}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={big ? "leading-snug" : "truncate"}>{o.label}</span>
                  {o.hint && <span className="truncate text-[12px] font-normal text-ink-2">{o.hint}</span>}
                </span>
                {isSel && <Icon name="check" className="size-4 shrink-0 text-signal-ink" />}
              </div>
            </li>
          );
        })}
        {creates.map((c, j) => {
          const i = filtered.length + j;
          return (
            <li key={`create:${c.key}`} role="presentation">
              {j === 0 && <div className="readout px-3 pt-3 pb-1.5">Not listed?</div>}
              <div id={`${listId}-${i}`} data-index={i} role="option" aria-selected={false} aria-busy={creating === c.key || undefined}
                onPointerMove={() => setActive(i)} onClick={() => void create(c)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", big ? "min-h-13 text-[15.5px]" : "min-h-11 text-[14.5px]",
                  i === active && "bg-muted", creating && creating !== c.key && "opacity-45")}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-signal-soft text-signal-ink">
                  {creating === c.key ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon name="plus" className="size-4" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={big ? "leading-snug" : "truncate"}>{c.label(typed)}</span>
                  {c.hint && <span className="truncate text-[12px] font-normal text-ink-2">{c.hint}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <>
      <button ref={trigger} id={triggerId} type="button" role="combobox" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-label={ariaLabel} aria-labelledby={labelledBy} aria-invalid={invalid || undefined}
        onClick={() => (open ? close() : openList())} onKeyDown={onTriggerKey}
        className={cn(fieldShell(invalid), "flex items-center gap-2 text-left", size === "sm" ? "h-10" : "h-12", open && "border-ring ring-2 ring-ring/25", className)}>
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-ink-3")}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}
        </span>
        <Icon name="down" className={cn("size-4 shrink-0 text-ink-2 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <Portal>
        <AnimatePresence>
          {open && sheet && (
            <motion.div ref={pop} role="dialog" aria-modal="true" aria-label={sheetTitle}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
              transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
              className="fixed inset-0 z-[200] flex flex-col bg-popover pt-[env(safe-area-inset-top)] text-popover-foreground">
              <div className="flex h-14 shrink-0 items-center gap-2 pr-2 pl-4">
                <h2 className="min-w-0 flex-1 truncate font-display text-[18px] font-semibold tracking-[-0.01em]">{sheetTitle}</h2>
                <button type="button" onClick={() => close()} aria-label="Close"
                  className="grid size-11 place-items-center rounded-full text-ink-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  <Icon name="x" className="size-5" />
                </button>
              </div>
              {panel}
            </motion.div>
          )}
          {open && !sheet && pos && (
            <motion.div ref={pop}
              initial={{ opacity: 0, scale: 0.96, y: pos.above ? 4 : -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: reduce ? 0 : 0.14, ease: EASE_OUT }}
              style={{ position: "fixed", left: pos.left, width: pos.width, maxHeight: pos.maxHeight,
                top: pos.above ? undefined : pos.top, bottom: pos.above ? window.innerHeight - pos.top : undefined,
                transformOrigin: pos.above ? "bottom" : "top" }}
              className="z-[200] flex flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-pop">
              {panel}
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}

/** Time picker built on Select: slots between min and max (HH:MM, 24h) every `step` minutes. */
export function TimeSelect({ value, onChange, min = "06:00", max = "21:00", step = 15, ...rest }:
  { value: string; onChange: (v: string) => void; min?: string; max?: string; step?: number; id?: string; "aria-label"?: string; "aria-labelledby"?: string; invalid?: boolean }) {
  const options = useMemo(() => {
    const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    const out: Option[] = [];
    for (let m = toMin(min); m <= toMin(max); m += step) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const h12 = ((Math.floor(m / 60) + 11) % 12) + 1;
      out.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${m < 720 ? "am" : "pm"}` });
    }
    return out;
  }, [min, max, step]);
  return <Select value={value} onChange={onChange} options={options} searchable={false} {...rest}
    renderValue={(o) => <span className="flex items-center gap-2"><Icon name="clock" className="size-4 text-ink-2" /><span className="tabular">{o.label}</span></span>} />;
}
