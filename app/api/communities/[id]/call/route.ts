import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getCommunityAccess } from "@/lib/community-access";
import {
  CommunityCallError,
  communityCallsConfigured,
  createCloudflareMeeting,
  endCloudflareMeeting,
  getCloudflareSession,
  issueCloudflareParticipantToken,
} from "@/lib/community-calls";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
type MeetingRow = { community_id: string; meeting_id: string | null; created_at: string };

function reject(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers });
}
async function context(id: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { status: 401 as const };
  const admin = await createCommunityAdminClient();
  if (!admin) return { status: 503 as const };
  const access = await getCommunityAccess(admin, id, user.id);
  if (access.error) return { status: 503 as const };
  if (!access.community) return { status: 404 as const };
  if (!access.canParticipate) return { status: 403 as const };
  return { status: 200 as const, user, admin, access };
}
function accessError(status: number) {
  return reject(status === 401 ? "Sign in before joining community calls." :
    status === 404 ? "Community not found." :
    status === 403 ? "Only approved, unbanned community members can join." :
    "Could not verify community access.", status);
}
function providerError(error: unknown) {
  if (error instanceof CommunityCallError && error.status === 409) return reject(error.message, 409);
  return reject("Community call service temporarily unavailable.", 503);
}
function requestOriginOkay(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
async function meetingRow(admin: SupabaseClient, communityId: string) {
  const { data, error } = await admin.from("community_group_call_rooms")
    .select("community_id, meeting_id, created_at")
    .eq("community_id", communityId).maybeSingle();
  if (error) throw new CommunityCallError("Meeting storage unavailable.");
  return data as MeetingRow | null;
}

async function startOrFindMeeting(admin: SupabaseClient, communityId: string, title: string, userId: string) {
  let row = await meetingRow(admin, communityId);
  if (row?.meeting_id) return row.meeting_id;

  if (row) {
    // A crashed worker should not reserve a community room forever.
    if (Date.now() - Date.parse(row.created_at) < 60_000) {
      throw new CommunityCallError("Another member is preparing the group call. Retry shortly.", 409);
    }
    await admin.from("community_group_call_rooms")
      .delete().eq("community_id", communityId).is("meeting_id", null)
      .eq("created_at", row.created_at);
  }

  const { error: reservationError } = await admin.from("community_group_call_rooms").insert({
    community_id: communityId,
    created_by: userId,
    meeting_id: null,
  });
  if (reservationError) {
    if (reservationError.code === "23505") {
      row = await meetingRow(admin, communityId);
      if (row?.meeting_id) return row.meeting_id;
      throw new CommunityCallError("Another member is preparing the group call. Retry shortly.", 409);
    }
    throw new CommunityCallError("Could not reserve community meeting.");
  }

  try {
    const meetingId = await createCloudflareMeeting(title);
    const { data, error: saveError } = await admin.from("community_group_call_rooms")
      .update({ meeting_id: meetingId })
      .eq("community_id", communityId)
      .is("meeting_id", null)
      .select("meeting_id").single();
    if (saveError || data?.meeting_id !== meetingId) {
      // Do not leak provider identifiers; an orphan provider room is a
      // maintenance concern and should be reviewed before enabling production.
      throw new CommunityCallError("Could not save the meeting.");
    }
    return meetingId;
  } catch (error) {
    await admin.from("community_group_call_rooms")
      .delete().eq("community_id", communityId).is("meeting_id", null);
    throw error;
  }
}
async function terminate(admin: SupabaseClient, communityId: string, meetingId: string) {
  await endCloudflareMeeting(meetingId);
  const { error } = await admin.from("community_group_call_rooms")
    .delete().eq("community_id", communityId).eq("meeting_id", meetingId);
  if (error) throw new CommunityCallError("Could not clear ended meeting.");
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.status !== 200 || !ctx.admin) return accessError(ctx.status);
  if (!communityCallsConfigured()) {
    return NextResponse.json({ configured: false, active: false, participants: 0 }, { headers });
  }
  try {
    const row = await meetingRow(ctx.admin, id);
    if (!row?.meeting_id) {
      return NextResponse.json({ configured: true, active: false, participants: 0 }, { headers });
    }
    const session = await getCloudflareSession(row.meeting_id);
    if (session.expired) {
      await terminate(ctx.admin, id, row.meeting_id);
      return NextResponse.json({ configured: true, active: false, participants: 0, expired: true }, { headers });
    }
    return NextResponse.json({
      configured: true,
      active: session.active,
      participants: session.participants,
    }, { headers });
  } catch (error) {
    return providerError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.status !== 200 || !ctx.user || !ctx.admin || !ctx.access?.community) {
    return accessError(ctx.status);
  }
  if (!requestOriginOkay(request)) return reject("Invalid request origin.", 403);
  if (!communityCallsConfigured()) return reject("Cloudflare group calls are not configured yet.", 503);

  try {
    const meetingId = await startOrFindMeeting(
      ctx.admin, id, ctx.access.community.name, ctx.user.id);
    const session = await getCloudflareSession(meetingId);
    if (session.expired) {
      await terminate(ctx.admin, id, meetingId);
      return reject("This call has reached the 30-minute limit. Start a new call.", 409);
    }
    const { data: profile } = await ctx.admin.from("profiles")
      .select("display_name,username").eq("id", ctx.user.id).maybeSingle();
    const name = profile?.display_name || profile?.username || "Converge member";
    const authToken = await issueCloudflareParticipantToken(meetingId, ctx.user.id, name);
    return NextResponse.json({ authToken }, { headers });
  } catch (error) {
    return providerError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.status !== 200 || !ctx.user || !ctx.admin || !ctx.access) return accessError(ctx.status);
  if (!requestOriginOkay(request)) return reject("Invalid request origin.", 403);
  if (!ctx.access.isOwner) {
    const { data: roleRow, error } = await ctx.admin.from("community_members")
      .select("role").eq("community_id", id).eq("user_id", ctx.user.id).maybeSingle();
    if (error) return reject("Could not verify moderator status.", 503);
    if (roleRow?.role !== "OWNER" && roleRow?.role !== "MODERATOR") {
      return reject("Only owners or moderators can end a community call for everyone.", 403);
    }
  }
  if (!communityCallsConfigured()) return reject("Group calls are not configured.", 503);
  try {
    const row = await meetingRow(ctx.admin, id);
    if (row?.meeting_id) await terminate(ctx.admin, id, row.meeting_id);
    return NextResponse.json({ ended: true }, { headers });
  } catch (error) {
    return providerError(error);
  }
}
