import "server-only";

/** Cloudflare RealtimeKit backend. Distinct from the existing 1:1 TURN credentials.
 * API tokens never reach browsers; only membership-authorized participant tokens do.
 */
const API_ROOT = "https://api.cloudflare.com/client/v4/accounts/";
const MAX_PARTICIPANTS = 10;
const MAX_MEETING_MINUTES = 30;
const TOKEN_LIFETIME_MINUTES = 35;

export class CommunityCallError extends Error {
  constructor(message: string, readonly status = 503) { super(message); }
}

type ApiResult<T> = { success: boolean; data?: T; errors?: { message: string }[] };
type MeetingInfo = { id: string; status?: string };
type LiveSession = { status: "LIVE" | "ENDED"; live_participants: number; started_at?: string };

function config() {
  const account = process.env.CLOUDFLARE_REALTIMEKIT_ACCOUNT_ID;
  const app = process.env.CLOUDFLARE_REALTIMEKIT_APP_ID;
  const token = process.env.CLOUDFLARE_REALTIMEKIT_API_TOKEN;
  const preset = process.env.CLOUDFLARE_REALTIMEKIT_PRESET;
  if (!account || !app || !token || !preset) throw new CommunityCallError("Community calling is not configured.", 503);
  if (!/^[\w-]{1,64}$/.test(account) || !/^[\w-]{1,64}$/.test(app)) {
    throw new CommunityCallError("Invalid Cloudflare media configuration.", 503);
  }
  return { account, app, token, preset };
}

export function communityCallsConfigured() {
  return Boolean(process.env.CLOUDFLARE_REALTIMEKIT_ACCOUNT_ID &&
    process.env.CLOUDFLARE_REALTIMEKIT_APP_ID &&
    process.env.CLOUDFLARE_REALTIMEKIT_API_TOKEN &&
    process.env.CLOUDFLARE_REALTIMEKIT_PRESET);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { account, app, token } = config();
  const response = await fetch(
    API_ROOT + account + "/realtime/kit/" + app + path,
    {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  const raw = await response.text();
  let body: ApiResult<T> | null = null;
  try { body = JSON.parse(raw) as ApiResult<T>; } catch { /* Cloudflare may omit body for errors. */ }
  if (!response.ok || !body?.success || !body.data) {
    if (response.status === 404) throw new CommunityCallError("No active meeting.", 404);
    throw new CommunityCallError("Cloudflare RealtimeKit request failed.", 503);
  }
  return body.data;
}

function checkMeetingId(meetingId: string) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(meetingId)) {
    throw new CommunityCallError("Invalid media meeting identifier.", 400);
  }
  return meetingId;
}

export async function createCloudflareMeeting(title: string) {
  const result = await request<MeetingInfo>("/meetings", {
    method: "POST",
    body: JSON.stringify({
      title: title.trim().slice(0, 100),
      record_on_start: false,
      transcribe_on_end: false,
      summarize_on_end: false,
      live_stream_on_start: false,
      persist_chat: false,
      session_keep_alive_time_in_secs: 60,
    }),
  });
  return checkMeetingId(result.id);
}

export async function getCloudflareSession(meetingId: string): Promise<{
  active: boolean; participants: number; expired: boolean;
}> {
  try {
    const session = await request<LiveSession>(
      "/meetings/" + checkMeetingId(meetingId) + "/active-session");
    const minutes = session.started_at ? (Date.now() - Date.parse(session.started_at)) / 60000 : 0;
    return {
      active: session.status === "LIVE" && session.live_participants > 0,
      participants: Math.max(0, session.live_participants || 0),
      expired: minutes >= MAX_MEETING_MINUTES,
    };
  } catch (error) {
    if (error instanceof CommunityCallError && error.status === 404) {
      return { active: false, participants: 0, expired: false };
    }
    throw error;
  }
}

export async function issueCloudflareParticipantToken(
  meetingId: string,
  viewerId: string,
  displayName: string,
) {
  const session = await getCloudflareSession(meetingId);
  if (session.expired) throw new CommunityCallError("This call has reached its time limit.", 409);
  if (session.participants >= MAX_PARTICIPANTS) throw new CommunityCallError("Community call is full.", 409);
  const expiresOn = new Date(Date.now() + TOKEN_LIFETIME_MINUTES * 60_000).toISOString();
  const { preset } = config();
  const result = await request<{ token: string }>(
    "/meetings/" + checkMeetingId(meetingId) + "/participants",
    {
      method: "POST",
      body: JSON.stringify({
        // A unique record per join allows a freshly authorized short-lived token.
        // UUID contains no personally identifying information.
        custom_participant_id: viewerId + "-" + crypto.randomUUID(),
        name: displayName.trim().slice(0, 80) || "Converge member",
        preset_name: preset,
        token: { expires_on: expiresOn },
      }),
    },
  );
  if (!result.token || typeof result.token !== "string") {
    throw new CommunityCallError("Could not obtain your participant token.", 503);
  }
  return result.token;
}

export async function endCloudflareMeeting(meetingId: string) {
  const id = checkMeetingId(meetingId);
  try {
    await request<unknown>("/meetings/" + id + "/active-session/kick-all", { method: "POST" });
  } catch (error) {
    if (!(error instanceof CommunityCallError && error.status === 404)) throw error;
  }
  // Inactivate the meeting after ending so previously issued bearer tokens
  // cannot start another session of the same room.
  await request<MeetingInfo>("/meetings/" + id, {
    method: "PATCH",
    body: JSON.stringify({ status: "INACTIVE" }),
  });
}
