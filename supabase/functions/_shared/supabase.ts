import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { AppError, requireEnv } from "./http.ts";

/** Service-role client: bypasses RLS. Only for svc_* RPCs and lookups. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client acting as the caller, so RLS and the RPCs' own checks apply. */
export function userClient(req: Request): SupabaseClient {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new AppError("not_authenticated", 401);
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Caller = {
  id: string;
  email: string;
  full_name: string;
  status: "pending" | "verified" | "suspended";
  role: "student" | "admin";
};

/** The signed-in caller's profile; throws unless verified (when required). */
export async function requireCaller(req: Request, opts: { verified?: boolean } = {}): Promise<{ caller: Caller; db: SupabaseClient }> {
  const db = userClient(req);
  const { data: userData, error: userErr } = await db.auth.getUser();
  if (userErr || !userData.user) throw new AppError("not_authenticated", 401);

  const { data: profile, error } = await db
    .from("profiles")
    .select("id, email, full_name, status, role")
    .eq("id", userData.user.id)
    .single();
  if (error || !profile) throw new AppError("no_profile", 403);
  if (profile.status === "suspended") throw new AppError("account_suspended", 403);
  if (opts.verified && profile.status !== "verified") throw new AppError("not_verified", 403);
  return { caller: profile as Caller, db };
}
