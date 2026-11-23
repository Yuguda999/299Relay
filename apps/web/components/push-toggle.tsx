"use client";

import { useEffect, useState } from "react";
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
    return <p className="text-[12.5px] text-muted">Push notifications aren&apos;t set up yet. You&apos;ll still see everything in Notifications.</p>;
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
    <div className="flex flex-col gap-1.5">
      <label className="flex items-start justify-between gap-4">
        <span className="flex flex-col gap-0.5">
          <span className="text-[14.5px] font-medium">Push notifications on this device</span>
          <span className="text-[12.5px] text-muted">New matches on your route, acceptances, job updates and wallet events.</span>
        </span>
        <input type="checkbox" checked={on} disabled={busy} onChange={(e) => void toggle(e.target.checked)} className="mt-1 size-6 shrink-0 accent-navy" />
      </label>
      {error && <span className="text-[12.5px] text-danger">{error}</span>}
    </div>
  );
}
