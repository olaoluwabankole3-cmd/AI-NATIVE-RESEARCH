import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voiceCallsEnabled } from "@/lib/voice-calls-config";
import { generateCloudflareTurnCredentials } from "@/lib/cloudflare-turn";

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
  if (!voiceCallsEnabled) return NextResponse.json({ error: "Voice calls are not enabled." }, { status: 503, headers });
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
    call.status !== "active") {
    // Only answered calls receive relay credentials, limiting TURN abuse.
    return NextResponse.json({ error: "Call not available." }, { status: 404, headers });
  }

  const stunUrls = listUrls(process.env.STUN_URLS || "stun:stun.l.google.com:19302", ["stun:", "stuns:"]);
  const servers: Array<{ urls: string[]; username?: string; credential?: string }> = [];
  if (stunUrls.length) servers.push({ urls: stunUrls });

  const cloudflareKeyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const cloudflareApiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  let turnConfigured = false;
  let relayProvider: "cloudflare" | "coturn" | null = null;
  let warning: string | undefined;

  if (cloudflareKeyId && cloudflareApiToken) {
    try {
      // Generate expiring credentials server-side and only for active-call participants.
      // The long-lived API token never enters browser JavaScript or the response.
      const managed = await generateCloudflareTurnCredentials(cloudflareKeyId, cloudflareApiToken);
      servers.push(...managed);
      turnConfigured = true;
      relayProvider = "cloudflare";
    } catch {
      // Retain existing direct STUN calling if the relay provider is unreachable.
      warning = "TURN relay is temporarily unavailable; this call may still connect directly.";
    }
  } else if (cloudflareKeyId || cloudflareApiToken) {
    warning = "TURN relay configuration is incomplete; direct calling is still available.";
  }

  // Existing self-hosted coturn remains available as an alternative / fallback.
  if (!turnConfigured) {
    const turnUrls = listUrls(process.env.TURN_URLS || "", ["turn:", "turns:"]);
    const secret = process.env.TURN_SHARED_SECRET;
    if (turnUrls.length > 0 && secret) {
      // Standard coturn use-auth-secret credential format: expiry:identity / HMAC-SHA1.
      const username = Math.floor(Date.now() / 1000 + 7200) + ":" + user.id;
      const credential = createHmac("sha1", secret).update(username).digest("base64");
      servers.push({ urls: turnUrls, username, credential });
      turnConfigured = true;
      relayProvider = "coturn";
      warning = undefined;
    }
  }

  return NextResponse.json({
    iceServers: servers,
    turnConfigured,
    ...(relayProvider ? { relayProvider } : {}),
    ...(!turnConfigured ? { warning: warning || "Relay service is not configured; some networks cannot connect." } : {}),
  }, { status: 200, headers });
}
