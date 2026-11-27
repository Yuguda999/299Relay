"use client";

// Print jobs: options, cost estimate, document upload and access.
import { supabase } from "@/lib/supabase/client";

export type PrintOptions = {
  copies: number;
  color: "bw" | "color";
  sides: "single" | "double";
  binding: "none" | "staple" | "spiral";
};
export const DEFAULT_PRINT: PrintOptions = { copies: 1, color: "bw", sides: "single", binding: "none" };

export const PRINT_LABELS = {
  color: { bw: "Black & white", color: "Colour" },
  sides: { single: "Single-sided", double: "Double-sided" },
  binding: { none: "No binding", staple: "Stapled", spiral: "Spiral bound" },
} as const;

// Typical campus business-centre prices (naira). Only a starting estimate; the
// requester can change the budget, and the traveler asks if it costs more.
const PER_PAGE = { bw: 50, color: 150 };
const BINDING = { none: 0, staple: 0, spiral: 500 };

export function estimatePrintNaira(pages: number, o: PrintOptions): number {
  if (!pages) return 0;
  const perCopy = pages * PER_PAGE[o.color] + BINDING[o.binding];
  return Math.ceil((perCopy * o.copies) / 50) * 50; // round up to ₦50
}

export function printSummary(pages: number, o: PrintOptions): string {
  return [
    `${pages} ${pages === 1 ? "page" : "pages"}${o.copies > 1 ? ` × ${o.copies} copies` : ""}`,
    PRINT_LABELS.color[o.color],
    PRINT_LABELS.sides[o.sides],
    o.binding !== "none" ? PRINT_LABELS.binding[o.binding] : null,
  ].filter(Boolean).join(" · ");
}

export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,application/pdf,image/*";
export const MAX_DOC_BYTES = 20 * 1024 * 1024;

/** Page count for PDFs (counts page objects); null for other formats. */
export async function countPdfPages(file: File): Promise<number | null> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return null;
  try {
    const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
    const n = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

export type DocDraft = { file: File; pages: number | null };

/** Uploads documents to <uid>/<batch>/<name> in the private documents bucket. */
export async function uploadDocuments(docs: DocDraft[]) {
  const db = supabase();
  const { data } = await db.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) throw new Error("not_authenticated");
  const batch = crypto.randomUUID();
  return Promise.all(docs.map(async ({ file, pages }, i) => {
    const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120) || `document-${i + 1}`;
    const path = `${uid}/${batch}/${i + 1}-${safe}`;
    const { error } = await db.storage.from("documents").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (error) throw error;
    return { path, name: file.name, size: file.size, pages };
  }));
}

/** Short-lived download link; null if the caller may not open it yet. */
export async function documentUrl(path: string): Promise<string | null> {
  const name = path.split("/").pop()?.replace(/^\d+-/, "");
  const { data } = await supabase().storage.from("documents").createSignedUrl(path, 600, { download: name ?? true });
  return data?.signedUrl ?? null;
}

export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
