import "server-only";

/** Server-only Daily media provider for community calls.
 * No API keys, reusable room URLs or meeting tokens are sent without authorization.
 * Rooms are always private, and tokens are individually scoped to the community.
 */
const API_BASE = "https://api.daily.co/v1";
const MEMBER_TOKEN_LIFETIME_SECONDS = 60 * 60 * 2;

type DailyRoom = { name: string; url: string; privacy: string };
type DailyPresence = { total_count?: number; data?: unknown[] };
type DailyToken = { token: string };

export class DailyCallError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function communityCallsConfigured() {
  return Boolean(process.env.DAILY_API_KEY);
}

export function communityCallRoomName(communityId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(communityId)) {
    throw new DailyCallError("Invalid community.", 400);
  }
  return "converge-community-" + communityId.replace(/-/g, "").toLowerCase();
}

async function dailyRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new DailyCallError("Community calls need media-provider setup.", 503);
  const response = await fetch(API_BASE + path, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new DailyCallError("Call provider returned an error.", response.status);
  return await response.json() as T;
}

function assertPrivateRoom(room: DailyRoom, roomName: string) {
  const url = new URL(room.url);
  if (room.name !== roomName || room.privacy !== "private" ||
      url.protocol !== "https:" ||
      !(url.hostname === "daily.co" || url.hostname.endsWith(".daily.co")) ||
      url.pathname !== "/" + roomName) {
    throw new DailyCallError("The media room did not pass private-room validation.", 503);
  }
  return room;
}

export async function activeCommunityCall(communityId: string) {
  const name = communityCallRoomName(communityId);
  if (!communityCallsConfigured()) return { configured: false, active: false, participants: 0 };
  try {
    const presence = await dailyRequest<DailyPresence>("/rooms/" + name + "/presence");
    const count = typeof presence.total_count === "number" ? presence.total_count :
      (Array.isArray(presence.data) ? presence.data.length : 0);
    return { configured: true, active: count > 0, participants: Math.max(0, count) };
  } catch (error) {
    if (error instanceof DailyCallError && error.status === 404) {
      return { configured: true, active: false, participants: 0 };
    }
    throw error;
  }
}

async function ensurePrivateCommunityRoom(communityId: string) {
  const name = communityCallRoomName(communityId);
  let room: DailyRoom;
  try {
    room = await dailyRequest<DailyRoom>("/rooms/" + name);
  } catch (error) {
    if (!(error instanceof DailyCallError && error.status === 404)) throw error;
    try {
      room = await dailyRequest<DailyRoom>("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name,
          privacy: "private",
          properties: {
            enable_prejoin_ui: true,
            start_video_off: true,
            start_audio_off: true,
          },
        }),
      });
    } catch (createError) {
      // Two members can try to start the first call simultaneously.
      if (!(createError instanceof DailyCallError && [400, 409].includes(createError.status))) throw createError;
      room = await dailyRequest<DailyRoom>("/rooms/" + name);
    }
  }
  return assertPrivateRoom(room, name);
}

export async function createCommunityCallJoinUrl(communityId: string, userId: string, displayName: string) {
  const room = await ensurePrivateCommunityRoom(communityId);
  const tokenResponse = await dailyRequest<DailyToken>("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: room.name,
        user_id: userId,
        user_name: displayName.trim().slice(0, 80) || "Converge member",
        is_owner: false,
        exp: Math.floor(Date.now() / 1000) + MEMBER_TOKEN_LIFETIME_SECONDS,
        eject_at_token_exp: true,
      },
    }),
  });
  if (!tokenResponse.token || typeof tokenResponse.token !== "string") {
    throw new DailyCallError("The call provider did not issue a meeting token.", 502);
  }
  const url = new URL(room.url);
  url.searchParams.set("t", tokenResponse.token);
  return url.toString();
}

export async function endCommunityCall(communityId: string) {
  const name = communityCallRoomName(communityId);
  try {
    await dailyRequest<unknown>("/rooms/" + name, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof DailyCallError && error.status === 404)) throw error;
  }
}
