"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase, type Tables } from "@/lib/supabase/client";

type AdminCtx = {
  me: Tables<"profiles">;
  campus: Tables<"campuses"> | null;
  places: Tables<"places">[];
  reloadCampus: () => Promise<void>;
};
const Ctx = createContext<AdminCtx | null>(null);

export function AdminProvider({ me, children }: { me: Tables<"profiles">; children: ReactNode }) {
  const [campus, setCampus] = useState<Tables<"campuses"> | null>(null);
  const [places, setPlaces] = useState<Tables<"places">[]>([]);
  const reloadCampus = useCallback(async () => {
    const db = supabase();
    const [c, p] = await Promise.all([
      db.from("campuses").select("*").eq("id", me.campus_id).single(),
      db.from("places").select("*").eq("campus_id", me.campus_id).order("name"),
    ]);
    setCampus(c.data);
    setPlaces(p.data ?? []);
  }, [me.campus_id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load campus on mount
    void reloadCampus();
  }, [reloadCampus]);
  return <Ctx.Provider value={{ me, campus, places, reloadCampus }}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside AdminProvider");
  return c;
}

export function usePlaceName() {
  const { places } = useAdmin();
  return (id: string | null | undefined) => places.find((p) => p.id === id)?.name ?? "—";
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const reload = useCallback(async () => {
    try {
      setState({ data: await fnRef.current(), error: null, loading: false });
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

const cache = new Map<string, { url: string; exp: number }>();
export async function signedUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase().storage.from(bucket).createSignedUrl(path, 600);
  if (!data) return null;
  cache.set(key, { url: data.signedUrl, exp: Date.now() + 540_000 });
  return data.signedUrl;
}

export function useSignedUrl(bucket: string, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void signedUrl(bucket, path).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [bucket, path]);
  return url;
}

export const pct = (v: unknown) => (v == null ? "—" : `${Math.round(Number(v) * 100)}%`);
