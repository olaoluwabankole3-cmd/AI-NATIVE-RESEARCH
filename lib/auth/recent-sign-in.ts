/**
 * Destructive account actions require a fresh interactive sign-in.
 * Supabase Auth's last_sign_in_at is the sign-in event, not an access-token
 * refresh timestamp; refreshing a cookie must not extend this interval.
 */
export function isRecentSignIn(
  lastSignInAt: string | null | undefined,
  nowMs: number = Date.now(),
  maxAgeMs = 15 * 60 * 1000,
): boolean {
  if (!lastSignInAt) return false;
  const signedInAt = Date.parse(lastSignInAt);
  if (!Number.isFinite(signedInAt)) return false;
  const age = nowMs - signedInAt;
  return age >= 0 && age <= maxAgeMs;
}
