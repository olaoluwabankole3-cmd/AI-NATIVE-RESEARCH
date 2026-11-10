import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 5;

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function result(ready: boolean) {
  return NextResponse.json(
    { status: ready ? "ready" : "degraded" },
    { status: ready ? 200 : 503, headers },
  );
}

/**
 * Anonymous, read-only readiness check against Supabase Auth's documented
 * health endpoint. It uses only the public publishable key; no service-role
 * credential, database mutation, user lookup, or detailed error response.
 */
export async function GET() {
  if (process.env.NEXT_PUBLIC_CONVERGE_PREVIEW_MODE === "ui-only") {
    return result(false);
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) return result(false);

  try {
    const url = new URL("/auth/v1/health", baseUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      return result(false);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: { apikey: publishableKey },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    return result(response.ok);
  } catch {
    return result(false);
  }
}
