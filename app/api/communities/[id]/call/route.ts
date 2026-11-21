import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getCommunityAccess } from "@/lib/community-access";
import {
  activeCommunityCall,
  communityCallsConfigured,
  createCommunityCallJoinUrl,
  endCommunityCall,
} from "@/lib/community-calls";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function reject(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers });
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
  // A public community is not an open call: only accepted, unbanned members
  // may discover presence or receive private meeting credentials.
  if (!access.canParticipate) return { status: 403 as const };
  return { status: 200 as const, user, admin, access };
}

function accessError(status: number) {
  return reject(status === 401 ? "Please sign in first." :
    status === 404 ? "Community not found." :
    status === 403 ? "Only approved, unbanned members can join this community call." :
    "Community access is temporarily unavailable.", status);
}

function providerError() {
  return reject("The group-call service is temporarily unavailable. Please try again.", 503);
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.status !== 200) return accessError(ctx.status);
  try {
    return NextResponse.json(await activeCommunityCall(id), { headers });
  } catch {
    return providerError();
  }
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.status !== 200 || !ctx.user || !ctx.admin) return accessError(ctx.status);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reject("Invalid request origin.", 403);
  if (!communityCallsConfigured()) return reject("Community group calls are not configured yet.", 503);
  try {
    const { data: profile } = await ctx.admin.from("profiles")
      .select("display_name,username").eq("id", ctx.user.id).maybeSingle();
    const displayName = profile?.display_name || profile?.username || "Converge member";
    const joinUrl = await createCommunityCallJoinUrl(id, ctx.user.id, displayName);
    return NextResponse.json({ joinUrl }, { headers });
  } catch {
    return providerError();
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await context(id);
  if (ctx.status !== 200 || !ctx.user || !ctx.admin || !ctx.access) return accessError(ctx.status);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reject("Invalid request origin.", 403);

  if (!ctx.access.isOwner) {
    const { data: roleRow, error } = await ctx.admin.from("community_members")
      .select("role").eq("community_id", id).eq("user_id", ctx.user.id).maybeSingle();
    if (error) return reject("Could not verify moderation permission.", 503);
    if (!roleRow || (roleRow.role !== "OWNER" && roleRow.role !== "MODERATOR")) {
      return reject("Only owners and moderators can end a community call for everyone.", 403);
    }
  }

  if (!communityCallsConfigured()) return reject("Community group calls are not configured yet.", 503);
  try {
    await endCommunityCall(id);
    return NextResponse.json({ ended: true }, { headers });
  } catch {
    return providerError();
  }
}
