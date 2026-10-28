import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getCommunityAccess } from "@/lib/community-access";

type Params = { params: Promise<{ id: string; agentId: string }> };
type AgentInput = {
  name?: unknown; handle?: unknown; role?: unknown; description?: unknown;
  capabilities?: unknown; specialties?: unknown; participation?: unknown;
  systemPrompt?: unknown; status?: unknown; isActive?: unknown;
};
function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function list(value: unknown, max = 20): string[] {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]+/) : [];
  return source.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, max);
}

export async function PUT(request: Request, { params }: Params) {
  const { id, agentId } = await params;
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const admin = await createCommunityAdminClient();
  if (!admin) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });
  const access = await getCommunityAccess(admin, id, user.id);
  if (!access.community) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  if (!access.isOwner) return NextResponse.json({ error: "Only the community owner can edit AI agents." }, { status: 403 });

  const payload = await request.json().catch(() => null) as AgentInput | null;
  if (!payload) return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  const name = text(payload.name, 100);
  const role = text(payload.role, 180);
  const description = text(payload.description, 1500);
  const rawHandle = text(payload.handle, 100);
  const handle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : "@" + rawHandle).replace(/\s+/g, "-") : "";
  if (name.length < 2 || role.length < 2 || description.length < 2) return NextResponse.json({ error: "Name, role, and description are required." }, { status: 400 });
  if (!/^@[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(handle)) return NextResponse.json({ error: "Enter a valid @handle." }, { status: 400 });

  const { data: agent, error } = await admin.from("community_agents").update({
    name, handle, role, description, capabilities: list(payload.capabilities),
    specialties: list(payload.specialties), participation: text(payload.participation, 1000),
    status: payload.status === "PAUSED" ? "PAUSED" : "AVAILABLE",
    is_active: typeof payload.isActive === "boolean" ? payload.isActive : true,
    updated_at: new Date().toISOString(),
  }).eq("id", agentId).eq("community_id", id)
    .select("id, community_id, name, handle, role, description, capabilities, specialties, participation, status, is_active, created_at, updated_at").maybeSingle();
  if (error || !agent) return NextResponse.json({ error: error?.code === "23505" ? "That handle is already used in this community." : error ? "Could not update the agent." : "Agent not found." }, { status: error?.code === "23505" ? 409 : error ? 500 : 404 });

  const { error: promptError } = await admin.from("community_agent_prompts").upsert({
    agent_id: agentId, system_prompt: text(payload.systemPrompt, 15000), updated_at: new Date().toISOString(),
  }, { onConflict: "agent_id" });
  if (promptError) return NextResponse.json({ error: "The profile was updated, but its prompt could not be saved." }, { status: 500 });
  return NextResponse.json({ agent: { ...agent, systemPrompt: text(payload.systemPrompt, 15000) } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, agentId } = await params;
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const admin = await createCommunityAdminClient();
  if (!admin) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });
  const access = await getCommunityAccess(admin, id, user.id);
  if (!access.community) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  if (!access.isOwner) return NextResponse.json({ error: "Only the community owner can manage AI agents." }, { status: 403 });

  const { data, error } = await admin.from("community_agents").update({
    is_active: false, status: "PAUSED", updated_at: new Date().toISOString(),
  }).eq("id", agentId).eq("community_id", id).select("id, is_active, status").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error ? "Could not pause the agent." : "Agent not found." }, { status: error ? 500 : 404 });
  return NextResponse.json({ success: true, agent: data });
}
