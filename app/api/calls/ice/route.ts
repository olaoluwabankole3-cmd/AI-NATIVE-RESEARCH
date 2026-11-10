import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function listUrls(raw: string, allowed: string[]) {
  return raw.split(",").map((value) => value.trim()).filter((value) =>
    allowed.some((protocol) => value.startsWith(protocol)) && value.length < 512
  );
}

/** Issue short-lived coturn REST-style credentials only to call participants. */
export async function GET(request: Request) {
  const callId = new URL(request.url).searchParams.get("callId") ?? "";
  if (!uuid.test(callId)) {
    return NextResponse.json({ error: "Invalid call ID." }, { status: 400, headers });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to call." }, { status: 401, headers });
  }
  const { data: call, error } = await supabase.from("voice_calls")
    .select("caller_id,callee_id,status,ring_expires_at")
    .eq("id", callId).maybeSingle();

  if (error || !call || (call.caller_id !== user.id && call.callee_id !== user.id) ||
    !["ringing", "active"].includes(call.status) ||
    (call.status === "ringing" && Date.parse(call.ring_expires_at) < Date.now())) {
    return NextResponse.json({ error: "Call not available." }, { status: 404, headers });
  }

  const stunUrls = listUrls(process.env.STUN_URLS || "stun:stun.l.google.com:19302", ["stun:", "stuns:"]);
  const servers: Array<{ urls: string[]; username?: string; credential?: string }> = [];
  if (stunUrls.length) servers.push({ urls: stunUrls });

  const turnUrls = listUrls(process.env.TURN_URLS || "", ["turn:", "turns:"]);
  const secret = process.env.TURN_SHARED_SECRET;
  const turnConfigured = turnUrls.length > 0 && Boolean(secret);

  if (turnConfigured && secret) {
    // Standard coturn use-auth-secret credential format: expiry:identity / HMAC-SHA1.
    const username = Math.floor(Date.now() / 1000 + 7200) + ":" + user.id;
    const credential = createHmac("sha1", secret).update(username).digest("base64");
    servers.push({ urls: turnUrls, username, credential });
  }

  return NextResponse.json({
    iceServers: servers,
    turnConfigured,
    ...(turnConfigured ? {} : { warning: "Relay service is not configured; some networks cannot connect." }),
  }, { status: 200, headers });
}
