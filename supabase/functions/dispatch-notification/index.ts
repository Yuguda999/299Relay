// Sends one in-app notification out as push (FCM) and, for account/money
// events, email (Resend). Called by the notifications insert trigger with the
// service-role key. Missing provider config = that channel is skipped.
import { AppError, handler, json, readJson, requireEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new AppError("method_not_allowed", 405);
  if (req.headers.get("Authorization") !== `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`) {
    throw new AppError("forbidden", 403);
  }
  const { notification_id } = await readJson<{ notification_id?: string }>(req);
  if (!notification_id) throw new AppError("missing_notification_id");

  const db = adminClient();
  const { data: n } = await db
    .from("notifications")
    .select("id, profile_id, kind, title, body, link, email, pushed_at, profiles(email, full_name)")
    .eq("id", notification_id)
    .single();
  if (!n) throw new AppError("notification_not_found", 404);
  if (n.pushed_at) return json({ ok: true, skipped: "already_sent" });

  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:3000";
  const link = n.link ? `${appUrl}${n.link}` : appUrl;
  const results: Record<string, unknown> = {};

  // ── Push ──
  const fcm = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (fcm) {
    const { data: devices } = await db.from("devices").select("push_token").eq("profile_id", n.profile_id);
    if (devices?.length) {
      const sa = JSON.parse(fcm) as ServiceAccount;
      const token = await googleAccessToken(sa);
      const dead: string[] = [];
      await Promise.all(devices.map(async ({ push_token }) => {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: push_token,
              notification: { title: n.title, body: n.body ?? "" },
              data: { link: n.link ?? "/", kind: n.kind, id: n.id },
              webpush: { fcm_options: { link } },
            },
          }),
        });
        if (res.status === 404 || res.status === 400) dead.push(push_token); // unregistered / invalid token
      }));
      if (dead.length) await db.from("devices").delete().in("push_token", dead);
      results.push = { sent: devices.length - dead.length, removed: dead.length };
    }
  }

  // ── Email ──
  const resendKey = Deno.env.get("RESEND_API_KEY");
  // deno-lint-ignore no-explicit-any
  const profile = (n as any).profiles as { email: string; full_name: string } | null;
  if (n.email && resendKey && profile?.email) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") ?? "299 RELAY <no-reply@example.com>",
        to: profile.email,
        subject: n.title,
        text: `Hi ${profile.full_name.split(" ")[0]},\n\n${n.body ?? n.title}\n\n${link}\n\n— 299 RELAY`,
      }),
    });
    results.email = res.ok ? "sent" : `failed_${res.status}`;
  }

  await db.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
  return json({ ok: true, ...results });
}));

// ── Google OAuth for FCM HTTP v1 (service-account JWT, RS256) ──
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let cached: { token: string; exp: number } | null = null;

async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const b64url = (data: Uint8Array | string) =>
    btoa(typeof data === "string" ? data : String.fromCharCode(...data))
      .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)));
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new AppError("push_auth_failed", 502);
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, exp: now + expires_in };
  return access_token;
}
