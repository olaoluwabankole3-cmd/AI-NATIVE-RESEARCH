import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient } from "@/lib/community-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = await createCommunityAdminClient();
  if (!admin) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });
  const { data: community } = await admin.from("communities").select("id, created_by, visibility").eq("id", id).maybeSingle();
  if (!community) return NextResponse.json({ error: "Community not found." }, { status: 404 });

  if (community.created_by === user.id) {
    const { data, error } = await admin.from("community_join_requests")
      .select("id, community_id, user_id, status, message, created_at")
      .eq("community_id", id).eq("status", "PENDING").order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: "Could not load join requests." }, { status: 500 });
    const ids = [...new Set((data ?? []).map((row) => row.user_id))];
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id, display_name, username, avatar_url").in("id", ids)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return NextResponse.json({ requests: (data ?? []).map((row) => ({ ...row, profile: profileMap.get(row.user_id) ?? null })) }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await admin.from("community_join_requests")
    .select("id, status, message, created_at, updated_at")
    .eq("community_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
  if (error) return NextResponse.json({ error: "Could not load your access request." }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const payload = await request.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof payload?.message === "string" ? payload.message.trim().slice(0, 1000) : "";
  const admin = await createCommunityAdminClient();
  if (!admin) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });

  const { data: community, error: communityError } = await admin.from("communities")
    .select("id, visibility, created_by").eq("id", id).maybeSingle();
  if (communityError || !community) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  if (community.visibility !== "PRIVATE") return NextResponse.json({ error: "Public communities can be joined directly." }, { status: 409 });
  if (community.created_by === user.id) return NextResponse.json({ error: "You already own this community." }, { status: 409 });

  const { data: membership } = await admin.from("community_members").select("user_id")
    .eq("community_id", id).eq("user_id", user.id).maybeSingle();
  if (membership) return NextResponse.json({ error: "You are already a member." }, { status: 409 });

  const { data, error } = await admin.from("community_join_requests").insert({
    community_id: id, user_id: user.id, status: "PENDING", message: message || null,
  }).select("id, status, message, created_at").single();

  if (error) return NextResponse.json({
    error: error.code === "23505" ? "You already have a pending request for this community." : "Could not submit your access request.",
  }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}
