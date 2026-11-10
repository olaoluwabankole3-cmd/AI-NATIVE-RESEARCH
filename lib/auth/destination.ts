/** Normalize post-auth return paths without allowing off-site redirects. */
export function safeAuthDestination(
  requested: string | null | undefined,
  origin: string,
  fallback = "/communities",
): string {
  if (!requested || !requested.startsWith("/") || requested.startsWith("//") || requested.includes("\\")) {
    return fallback;
  }
  try {
    const destination = new URL(requested, origin);
    if (destination.origin !== origin) return fallback;
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return fallback;
  }
}

/** Accept legacy next links while keeping redirect as the canonical login parameter. */
export function authDestinationFromSearch(search: string, origin: string): string {
  const params = new URLSearchParams(search);
  return safeAuthDestination(params.get("redirect") ?? params.get("next"), origin);
}
