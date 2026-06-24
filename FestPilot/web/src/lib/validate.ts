/** Client-side input validators. Mirrors the server's light email check (DEC-060). */

/** A single @ with a dotted domain. Empty/whitespace is NOT valid here (callers treat empty as "skip"). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
