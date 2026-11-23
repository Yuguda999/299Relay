"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { NotifyProvider } from "@/components/ui";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Reduced motion, layer 2: Motion follows the OS setting. */}
      <MotionConfig reducedMotion="user">
        <NotifyProvider>{children}</NotifyProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

/** Switches theme with a circular reveal grown from the tapped control. */
export function useThemeSwitch() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; report "system" until mounted so SSR matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
    setMounted(true);
  }, []);
  function switchTo(next: "light" | "dark" | "system", origin?: { x: number; y: number }) {
    const root = document.documentElement;
    const resolved = next === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next;
    const apply = () => {
      root.classList.toggle("dark", resolved === "dark");
      root.classList.toggle("light", resolved === "light");
      root.style.colorScheme = resolved;
      setTheme(next);
    };
    const reduced = root.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const unchanged = root.classList.contains("dark") === (resolved === "dark");
    if (reduced || unchanged || typeof document.startViewTransition !== "function") return apply();
    const x = origin?.x ?? innerWidth / 2;
    const y = origin?.y ?? innerHeight / 2;
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    document.startViewTransition(apply);
  }
  return { theme: mounted ? (theme ?? "system") : "system", switchTo };
}
