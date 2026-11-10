import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Lightweight process liveness only.
 * Does not query users, require credentials or disclose configuration.
 */
export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200, headers });
}
