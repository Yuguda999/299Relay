import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages anyone can open. Everything else needs a session.
const PUBLIC = ["/start", "/welcome", "/signup", "/login", "/forgot", "/auth/callback", "/offline.html"];
// Signed-in users skip these.
const GUEST_ONLY = ["/start", "/welcome", "/signup", "/login", "/forgot"];

/**
 * Refreshes the Supabase session cookie on every navigation and does an
 * optimistic redirect. Real authorization is RLS + the RPCs' own checks.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const matches = (list: string[]) => list.some((p) => path === p || path.startsWith(p + "/"));

  // /signup/confirm needs to stay reachable right after sign-up (no session yet).
  if (!signedIn && !matches(PUBLIC)) {
    return redirectTo(request, "/start", response);
  }
  if (signedIn && matches(GUEST_ONLY) && !path.startsWith("/signup/confirm")) {
    return redirectTo(request, "/", response);
  }
  return response;
}

function redirectTo(request: NextRequest, path: string, carry: NextResponse) {
  const res = NextResponse.redirect(new URL(path, request.url));
  carry.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|sw.js|firebase-messaging-sw.js|manifest.webmanifest|offline.html|favicon.ico).*)"],
};
