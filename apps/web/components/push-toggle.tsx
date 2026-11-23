"use client";

import { useEffect, useState } from "react";
import { Alert, Switch } from "@/components/ui";
import { disablePush, enablePush, pushConfigured, pushEnabledHere } from "@/lib/push";

const MESSAGES: Record<string, string> = {
  push_denied: "Notifications are blocked. Allow them for this site in your browser settings.",
  push_unsupported: "This browser can't receive push notifications. On iPhone, add the app to your home screen first.",
};

export function PushToggle() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state
    setOn(pushEnabledHere());
  }, []);

  if (!pushConfigured()) {
    return <p className="text-[13px] leading-relaxed text-ink-2">Push notifications aren&apos;t set up yet. You&apos;ll still see everything in Notifications.</p>;
  }

  async function toggle(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      if (next) await enablePush();
      else await disablePush();
      setOn(next);
    } catch (e) {
      setError(MESSAGES[(e as Error).message] ?? "Couldn't change notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Switch checked={on} disabled={busy} onChange={(v) => void toggle(v)}
        label="Push notifications on this device" description="New matches on your route, acceptances, job updates and wallet events." />
      <Alert tone="warn">{error}</Alert>
    </div>
  );
}
