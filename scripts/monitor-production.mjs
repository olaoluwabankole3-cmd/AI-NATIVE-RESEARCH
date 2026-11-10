import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const production = "https://ai-native-research-qfeh.vercel.app";

export async function checkHealthEndpoint(path, expected, request = fetch, base = production) {
  const endpoint = new URL(path, base);
  if (endpoint.origin !== new URL(base).origin) {
    throw new Error("Health checks must remain on the expected production origin");
  }

  const response = await request(endpoint, {
    method: "GET",
    redirect: "manual",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(10000),
  });

  if (response.status !== 200) {
    throw new Error(`Health check ${path} returned HTTP ${response.status}; expected 200`);
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Health check ${path} returned a non-JSON page (possible deployment protection)`);
  }

  const body = await response.json();
  if (body?.status !== expected) {
    throw new Error(`Health check ${path} returned an unexpected state`);
  }
  return true;
}

async function run() {
  // Public, read-only probes. No user tokens, credentials, or database writes.
  await checkHealthEndpoint("/api/health", "ok");
  await checkHealthEndpoint("/api/ready", "ready");
  console.log("Converge production liveness and Supabase Auth readiness: healthy.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : "Health probe failed.");
    process.exitCode = 1;
  });
}
