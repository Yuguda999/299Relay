"use client";

// Web push through Firebase Cloud Messaging. The dispatch-notification Edge
// Function sends to every token saved with register_device().
import { supabase } from "@/lib/supabase/client";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const TOKEN_KEY = "relay_push_token";
// Firebase's default scope, so it doesn't clash with the app's own /sw.js.
const SCOPE = "/firebase-cloud-messaging-push-scope";

export function pushConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId && vapidKey);
}

export function pushEnabledHere(): boolean {
  try {
    return typeof Notification !== "undefined" && Notification.permission === "granted" && Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

async function messaging() {
  const [{ initializeApp, getApps }, m] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await m.isSupported())) throw new Error("push_unsupported");
  const app = getApps()[0] ?? initializeApp(config);
  return { m, messaging: m.getMessaging(app) };
}

/** Asks permission, gets an FCM token, saves it for this student. */
export async function enablePush(): Promise<void> {
  if (!pushConfigured()) throw new Error("push_not_configured");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("push_denied");
  const qs = new URLSearchParams(Object.entries(config).map(([k, v]) => [k, v ?? ""]));
  const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${qs}`, { scope: SCOPE });
  const { m, messaging: msg } = await messaging();
  const token = await m.getToken(msg, { vapidKey, serviceWorkerRegistration: reg });
  const { error } = await supabase().rpc("register_device", { p_token: token, p_platform: "web" });
  if (error) throw error;
  localStorage.setItem(TOKEN_KEY, token);
}

export async function disablePush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) await supabase().rpc("unregister_device", { p_token: token });
  localStorage.removeItem(TOKEN_KEY);
  try {
    const { m, messaging: msg } = await messaging();
    await m.deleteToken(msg);
  } catch {
    // token already gone
  }
}
