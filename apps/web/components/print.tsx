"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Card, Input, StatusChip, cn, useNotify } from "@/components/ui";
import { DOCUMENT_ACCEPT, documentUrl, fileSize, MAX_DOC_BYTES, PRINT_LABELS, countPdfPages, type DocDraft, type PrintOptions } from "@/lib/print";
import type { Tables } from "@/lib/supabase/client";

/** Pick documents to print; PDFs get their page count filled in automatically. */
export function DocumentPicker({ docs, onChange, max = 10 }: { docs: DocDraft[]; onChange: (d: DocDraft[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useNotify();

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const next = [...docs];
    for (const file of Array.from(files)) {
      if (next.length >= max) break;
      if (file.size > MAX_DOC_BYTES) {
        toast({ title: `${file.name} is too large`, body: "Each document can be up to 20 MB.", tone: "critical" });
        continue;
      }
      next.push({ file, pages: await countPdfPages(file) });
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {docs.map((d, i) => (
        <div key={`${d.file.name}:${i}`} className="flex items-center gap-3 rounded-[18px] bg-sheet p-2.5 pl-3 ring-1 ring-border animate-pop-in dark:bg-card dark:ring-glass-border">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card-nested text-ink-2"><Icon name="file" className="size-[18px]" /></span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] font-medium">{d.file.name}</span>
            <span className="font-mono text-[11px] text-ink-2">{fileSize(d.file.size)}</span>
          </div>
          <label className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-ink-2">
            {/* Fixed-width wrapper: the shared input style is full-width. */}
            <span className="w-12">
              <Input aria-label={`Pages in ${d.file.name}`} inputMode="numeric" value={d.pages ?? ""} placeholder="?"
                onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); onChange(docs.map((x, j) => (j === i ? { ...x, pages: n || null } : x))); }}
                className="h-9 rounded-xl px-1 text-center tabular" />
            </span>
            pages
          </label>
          <Button variant="ghost" size="circle-sm" aria-label={`Remove ${d.file.name}`} onClick={() => onChange(docs.filter((_, j) => j !== i))}><Icon name="x" /></Button>
        </div>
      ))}
      {docs.length < max && (
        <button type="button" onClick={() => input.current?.click()}
          className="flex h-14 items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-input bg-sheet text-[14px] font-medium text-ink-2 outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:bg-card">
          <Icon name="plus" className="size-4" />{docs.length ? "Add another document" : "Add documents"}
        </button>
      )}
      <input ref={input} type="file" accept={DOCUMENT_ACCEPT} multiple hidden tabIndex={-1}
        onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

/** Documents and print settings on a print job. Download only for requester/accepted traveler. */
export function DocumentsCard({ files, options, canOpen, i }: {
  files: Tables<"request_files">[]; options: PrintOptions | null; canOpen: boolean; i?: number;
}) {
  const { toast } = useNotify();
  const [busy, setBusy] = useState<string | null>(null);
  const pages = files.reduce((n, f) => n + (f.pages ?? 0), 0);

  async function open(f: Tables<"request_files">) {
    setBusy(f.id);
    const url = await documentUrl(f.path);
    setBusy(null);
    if (!url) return toast({ title: "Couldn't open the document", body: "It may have been removed.", tone: "critical" });
    window.open(url, "_blank", "noopener");
  }

  return (
    <Card i={i} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="readout">Documents to print</h2>
        <span className="font-mono text-[11px] text-ink-2 tabular">{files.length} {files.length === 1 ? "file" : "files"}{pages ? ` · ${pages} pages` : ""}</span>
      </div>
      {options && (
        <div className="flex flex-wrap gap-1.5">
          <StatusChip tone="live" dot={false}>{options.copies} {options.copies === 1 ? "copy" : "copies"}</StatusChip>
          <StatusChip dot={false}>{PRINT_LABELS.color[options.color]}</StatusChip>
          <StatusChip dot={false}>{PRINT_LABELS.sides[options.sides]}</StatusChip>
          {options.binding !== "none" && <StatusChip dot={false}>{PRINT_LABELS.binding[options.binding]}</StatusChip>}
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-[16px] bg-card-nested p-2.5 pl-3 dark:ring-1 dark:ring-glass-border">
            <Icon name="file" className="size-[18px] shrink-0 text-ink-2" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-medium">{f.name}</span>
              <span className="font-mono text-[11px] text-ink-2 tabular">{[f.pages && `${f.pages} pages`, fileSize(f.size_bytes)].filter(Boolean).join(" · ")}</span>
            </div>
            {canOpen
              ? <Button size="sm" variant="surface" loading={busy === f.id} onClick={() => void open(f)}><Icon name="download" className="size-4" />Open</Button>
              : <Icon name="lock" className="size-4 shrink-0 text-ink-3" aria-label="Locked" />}
          </li>
        ))}
      </ul>
      {!canOpen && <p className={cn("text-[12.5px] text-ink-2")}>Documents unlock for the traveler who accepts this job.</p>}
    </Card>
  );
}
