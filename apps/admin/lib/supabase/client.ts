"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** One browser client for the whole app (shares auth + realtime socket). */
export function supabase() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

export type DB = Database["public"];
export type Tables<T extends keyof DB["Tables"]> = DB["Tables"][T]["Row"];
export type Views<T extends keyof DB["Views"]> = DB["Views"][T]["Row"];
export type Enums<T extends keyof DB["Enums"]> = DB["Enums"][T];
