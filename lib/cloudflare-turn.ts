/**
 * Validate Cloudflare Realtime TURN's ephemeral ICE response before passing it
 * to a browser. The Cloudflare API token and TURN key never leave the server.
 */
export type ManagedIceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

const cloudflareStun = /^stuns?:stun\.cloudflare\.com:(?:3478|5349)$/i;
const cloudflareTurn = /^turns?:turn\.cloudflare\.com:(?:80|443|3478|5349)(?:\?transport=(?:udp|tcp))?$/i;
const keyIdPattern = /^[a-zA-Z0-9_-]{8,64}$/;

/** Reject unexpected URLs and incomplete credentials from a provider response. */
export function validateCloudflareIceServers(payload: unknown): ManagedIceServer[] {
  const body = payload as { iceServers?: unknown } | null;
  if (!body || !Array.isArray(body.iceServers) || body.iceServers.length > 12) {
    throw new Error("Invalid TURN credential response.");
  }

  const servers: ManagedIceServer[] = [];
  let hasRelay = false;
  for (const raw of body.iceServers) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { urls?: unknown; username?: unknown; credential?: unknown };
    const candidates = typeof item.urls === "string" ? [item.urls] : item.urls;
    if (!Array.isArray(candidates) || candidates.length > 12) continue;
    const urls = candidates.filter((url): url is string =>
      typeof url === "string" && url.length < 200 &&
      (cloudflareTurn.test(url) || cloudflareStun.test(url))
    );
    if (!urls.length) continue;
    const username = typeof item.username === "string" ? item.username : "";
    const credential = typeof item.credential === "string" ? item.credential : "";
    const hasCredentials = username.length > 0 && username.length <= 512 &&
      credential.length > 0 && credential.length <= 512;
    // Never return unauthenticated TURN URLs.
    const safeUrls = urls.filter((url) => !cloudflareTurn.test(url) || hasCredentials);
    if (!safeUrls.length) continue;
    const relayUrls = safeUrls.filter((url) => cloudflareTurn.test(url));
    if (relayUrls.length) hasRelay = true;
    servers.push(relayUrls.length && hasCredentials
      ? { urls: safeUrls, username, credential }
      : { urls: safeUrls });
  }
  if (!hasRelay) throw new Error("Provider supplied no valid TURN relay.");
  return servers;
}

/** Cloudflare returns expiring, protocol-diverse STUN/TURN credentials. */
export async function generateCloudflareTurnCredentials(
  keyId: string,
  apiToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ManagedIceServer[]> {
  if (!keyIdPattern.test(keyId) || !apiToken || apiToken.length > 2048) {
    throw new Error("TURN key configuration is invalid.");
  }
  const response = await fetcher(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ttl: 14400 }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok) {
    // No token or upstream response body in application errors/logs.
    throw new Error("Managed TURN service is unavailable.");
  }
  return validateCloudflareIceServers(await response.json());
}
