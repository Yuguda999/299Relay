"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNotify } from "@/components/ui";
import { realtimeAuth, supabase, type Tables } from "@/lib/supabase/client";

type Session = {
  profile: Tables<"profiles"> | null;
  wallet: Tables<"wallets"> | null;
  unread: number;
  /** Active places, for pickers. */
  places: Tables<"places">[];
  /** Name of any place, including retired ones on old jobs. */
  placeName: (id: string | null | undefined) => string;
  /** Add a place a student typed in; returns the new (or existing) place. */
  addPlace: (name: string, offCampus: boolean) => Promise<Tables<"places">>;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

/** Signed-in user: profile, wallet (live), unread notifications (live), campus places. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toast } = useNotify();
  // Read the current path inside the realtime callback without re-subscribing.
  const path = usePathname();
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const [state, setState] = useState<Omit<Session, "refresh" | "signOut" | "placeName" | "addPlace">>({
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
      db.from("places").select("*").order("name"),
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
    let cancelled = false;
    const channel = db
      .channel(`session:${crypto.randomUUID()}`) // unique per mount: a reused name can bind to the closing channel
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, (p) => {
        setState((s) => ({ ...s, wallet: p.new as Tables<"wallets"> }));
      })
      // Places other students add (or the team edits) show up without a reload.
      .on("postgres_changes", { event: "*", schema: "public", table: "places" }, (p) => {
        if (p.eventType === "DELETE") return;
        setState((s) => ({ ...s, places: upsertPlace(s.places, p.new as Tables<"places">) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
        const n = p.new as Tables<"notifications">;
        setState((s) => ({ ...s, unread: s.unread + 1 }));
        // Pop up new chat messages unless that chat is already on screen.
        if (n.kind === "message" && n.link !== pathRef.current) {
          toast({ title: n.title, body: n.body ?? undefined, tone: "message", href: n.link ?? undefined });
        }
      });
    void realtimeAuth().then(() => !cancelled && channel.subscribe());
    const { data: sub } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/start");
    });
    // Coming back to a tab: if its session is gone (e.g. another account logged in
    // within the same browser, which shares the cookie), go to login instead of
    // letting requests fail as a logged-out visitor.
    const recheck = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await db.auth.getClaims();
      if (!data?.claims) {
        toast({ title: "Your session ended", body: "Log in again to continue.", tone: "info" });
        router.replace("/login");
      }
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      cancelled = true;
      void db.removeChannel(channel);
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [refresh, router, toast]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    router.replace("/start");
    router.refresh();
  }, [router]);

  const addPlace = useCallback(async (name: string, offCampus: boolean) => {
    const { data, error } = await supabase().rpc("add_place", { p_name: name, p_off_campus: offCampus });
    if (error) throw error;
    setState((s) => ({ ...s, places: upsertPlace(s.places, data) }));
    return data;
  }, []);

  const value = useMemo(() => {
    const byId = new Map(state.places.map((p) => [p.id, p]));
    return {
      ...state,
      places: state.places.filter((p) => p.active),
      placeName: (id: string | null | undefined) => (id && byId.get(id)?.name) || "",
      addPlace, refresh, signOut,
    };
  }, [state, addPlace, refresh, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function upsertPlace(list: Tables<"places">[], p: Tables<"places">) {
  const rest = list.filter((x) => x.id !== p.id);
  return [...rest, p].sort((a, b) => a.name.localeCompare(b.name));
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
