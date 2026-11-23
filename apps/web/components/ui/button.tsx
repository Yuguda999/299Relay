"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./feedback";

const BASE =
  "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium no-underline outline-none select-none transition-[background-color,color,box-shadow,transform,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sheet disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0";

export const VARIANTS = {
  primary: "bg-primary text-primary-foreground font-semibold hover:brightness-105 active:scale-[0.98]",
  inverse: "bg-inverse text-inverse-foreground hover:opacity-90 active:scale-[0.98]",
  surface: "bg-sheet text-foreground ring-1 ring-border hover:bg-card dark:bg-card-nested dark:ring-glass-border dark:hover:bg-card active:translate-y-px",
  ghost: "text-ink-2 hover:bg-muted hover:text-foreground active:translate-y-px",
  soft: "bg-signal-soft text-signal-ink hover:brightness-[0.98] active:translate-y-px",
  destructive: "bg-critical/10 text-critical hover:bg-critical/15 active:translate-y-px",
  /** Secondary action sitting on a `hero` slab. */
  onHero: "bg-inverse-foreground/12 text-inverse-foreground ring-1 ring-inverse-foreground/20 hover:bg-inverse-foreground/20 dark:bg-foreground/8 dark:text-foreground dark:ring-foreground/15 active:translate-y-px",
} as const;

export const SIZES = {
  /** Full-width mobile CTA. */
  lg: "h-12 rounded-pill px-6 text-[15px]",
  pill: "h-10 rounded-pill px-5 text-sm",
  sm: "h-8 rounded-pill px-3.5 text-[13px]",
  circle: "size-11 rounded-full [&_svg]:size-[18px] active:scale-95",
  "circle-sm": "size-9 rounded-full [&_svg]:size-4 active:scale-95",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "lg", className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({ variant = "primary", size = "lg", loading, className, children, disabled, type = "button", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)} {...rest}>
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "lg", className, disabled, ...rest }:
  ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; disabled?: boolean }) {
  return <Link aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} className={buttonClass(variant, size, className)} {...rest} />;
}
