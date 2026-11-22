"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Tables } from "@/lib/supabase/client";

type Session = {
  profile: Tables<"profiles"> | null;
  wallet: Tables<"wallets"> | null;
  unread: number;
  places: Tables<"places">[];
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

/** Signed-in user: profile, wallet (live), unread notifications (live), campus places. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Session, "refresh" | "signOut">>({
    profile: null, wallet: null, unread: 0, places: [], loading: true,
  });

  const refresh = useCallback(async () => {
    const db = supabase();
    const { data: claims } = await db.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) {
      router.replace("/start");
      return;
    }
    const [profile, wallet, unread, places] = await Promise.all([
      db.from("profiles").select("*").eq("id", uid).single(),
      db.from("wallets").select("*").eq("profile_id", uid).single(),
      db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      db.from("places").select("*").eq("active", true).order("name"),
    ]);
    setState({
      profile: profile.data,
      wallet: wallet.data,
      unread: unread.count ?? 0,
      places: places.data ?? [],
      loading: false,
    });
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from Supabase
    void refresh();
    const db = supabase();
    const channel = db
      .channel("session")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, (p) => {
        setState((s) => ({ ...s, wallet: p.new as Tables<"wallets"> }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        setState((s) => ({ ...s, unread: s.unread + 1 }));
      })
      .subscribe();
    const { data: sub } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/start");
    });
    return () => {
      void db.removeChannel(channel);
      sub.subscription.unsubscribe();
    };
  }, [refresh, router]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    router.replace("/start");
    router.refresh();
  }, [router]);

  return <Ctx.Provider value={{ ...state, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}

export function usePlace(id: string | null | undefined) {
  const { places } = useSession();
  return places.find((p) => p.id === id);
}
