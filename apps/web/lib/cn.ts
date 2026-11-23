/** Joins class names, skipping falsy values. */
export function cn(...c: (string | false | null | undefined | 0)[]): string {
  return c.filter(Boolean).join(" ");
}
