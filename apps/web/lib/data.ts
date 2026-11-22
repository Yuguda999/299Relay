"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type Views } from "@/lib/supabase/client";

export type PublicProfile = Views<"public_profiles">;

/** Public cards (first name, last initial, rating) for a set of profile ids. */
export async function fetchPublicProfiles(ids: (string | null | undefined)[]): Promise<Map<string, PublicProfile>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return new Map();
  const { data } = await supabase().from("public_profiles").select("*").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id!, p]));
}

export function displayName(p: PublicProfile | null | undefined): string {
  if (!p) return "Student";
  return p.last_initial ? `${p.first_name} ${p.last_initial}.` : (p.first_name ?? "Student");
}

export function ratingLine(p: PublicProfile | null | undefined): string {
  if (!p) return "";
  const n = (p.jobs_carried ?? 0);
  if (!p.rating_count) return `New · ${n} ${n === 1 ? "delivery" : "deliveries"}`;
  return `${Number(p.rating_avg).toFixed(1)} rating · ${n} ${n === 1 ? "delivery" : "deliveries"}`;
}

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase().storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/** Shrinks a photo before upload (PRD: light on data). JPEG, longest side ≤ 1280px. */
export async function compressImage(file: File, maxSide = 1280, quality = 0.78): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("not_an_image");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress_failed"))), "image/jpeg", quality),
  );
}

/** Uploads into the caller's own folder: <bucket>/<uid>/<sub>/<random>.jpg. Returns the path. */
export async function uploadPhoto(bucket: string, file: File, sub = ""): Promise<string> {
  const db = supabase();
  const { data } = await db.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) throw new Error("not_authenticated");
  const blob = await compressImage(file);
  const path = [uid, sub, `${crypto.randomUUID()}.jpg`].filter(Boolean).join("/");
  const { error } = await db.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

const signedCache = new Map<string, { url: string; exp: number }>();
export async function signedUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase().storage.from(bucket).createSignedUrl(path, 3600);
  if (!data) return null;
  signedCache.set(key, { url: data.signedUrl, exp: Date.now() + 3300_000 });
  return data.signedUrl;
}

/** Calls an Edge Function; throws { error } with the server's code on failure. */
export async function callFunction<T>(name: string, body?: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
  const { data, error } = await supabase().functions.invoke<T>(name, { body: body as Record<string, unknown>, method });
  if (error) {
    let payload: { error?: string } = {};
    try {
      payload = await (error as { context?: Response }).context?.json();
    } catch {
      // not JSON
    }
    throw { error: payload.error ?? "server_error" };
  }
  return data as T;
}

/** Tiny loader: runs `fn`, exposes data/error/loading and a reload. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({
    data: null, error: null, loading: true,
  });
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const reload = useCallback(async () => {
    try {
      const data = await fnRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...state, reload };
}

/** Re-runs `onChange` whenever rows in the given tables change (RLS-filtered). */
export function useRealtime(key: string, tables: { table: string; filter?: string }[], onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    const db = supabase();
    let ch = db.channel(`rt:${key}`);
    for (const t of tables) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t.table, filter: t.filter }, () => cb.current());
    }
    ch.subscribe();
    return () => {
      void db.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
