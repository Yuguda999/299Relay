// HTTP helpers shared by every Edge Function.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** An error with a stable code the app can switch on (mirrors private.err in SQL). */
export class AppError extends Error {
  constructor(public code: string, public status = 400, public detail?: string) {
    super(code);
  }
}

/** Postgres errors raised by private.err() carry the code in `message`. */
export function fromPg(err: { message?: string; details?: string; code?: string } | null): AppError | null {
  if (!err) return null;
  if (err.code === "P0001" && err.message) return new AppError(err.message, 400, err.details);
  if (err.code === "42501") return new AppError("forbidden", 403);
  console.error("database error", err);
  return new AppError("server_error", 500);
}

export function handler(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof AppError) {
        return json({ error: e.code, detail: e.detail ?? null }, e.status);
      }
      console.error(e);
      return json({ error: "server_error" }, 500);
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError("invalid_json");
  }
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new AppError("server_misconfigured", 500, `${name} is not set`);
  return v;
}

/** Naira input → whole kobo, rejecting fractions of a kobo and non-numbers. */
export function toKobo(naira: unknown): number {
  const n = typeof naira === "string" ? Number(naira) : naira;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) throw new AppError("invalid_amount");
  const kobo = Math.round(n * 100);
  if (Math.abs(kobo - n * 100) > 1e-6) throw new AppError("invalid_amount");
  return kobo;
}
