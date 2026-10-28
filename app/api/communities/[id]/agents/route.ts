import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getCommunityAccess } from "@/lib/community-access";

type Params = { params: Promise<{ id: string }> };
type AgentInput = {
  name?: unknown; handle?: unknown; role?: unknown; description?: unknown;
  capabilities?: unknown; specialties?: unknown; participation?: unknown; systemPrompt?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function list(value: unknown, max = 20): string[] {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]+/) : [];
  return source.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, max);
}
function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const admin = await createCommunityAdminClient();
  if (!admin) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });

  const access = await getCommunityAccess(admin, id, user.id);
  if (!access.community) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  if (!access.canRead) return NextResponse.json({ error: "Join this private community to view its agents." }, { status: 403 });

  const manage = new URL(request.url).searchParams.get("manage") === "1";
  if (manage && !access.isOwner) return NextResponse.json({ error: "Only the community owner can manage its agents." }, { status: 403 });

  const { data, error } = await admin.from("community_agents")
    .select("id, community_id, name, handle, role, description, capabilities, specialties, participation, status, is_active, created_at, updated_at")
    .eq("community_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load community agents." }, { status: 500 });

  let prompts = new Map<string, string>();
  if (manage && (data ?? []).length) {
    const { data: promptRows, error: promptError } = await admin.from("community_agent_prompts")
      .select("agent_id, system_prompt").in("agent_id", (data ?? []).map((agent) => agent.id));
    if (promptError) return NextResponse.json({ error: "Could not load agent instructions." }, { status: 500 });
    prompts = new Map((promptRows ?? []).map((row) => [row.agent_id, row.system_prompt]));
  }

  const agents = (data ?? []).filter((agent) => manage || (agent.is_active && agent.status === "AVAILABLE"))
    .map((agent) => ({
      ...agent,
      capabilities: agent.capabilities ?? [],
      specialties: agent.specialties ?? [],
      participation: agent.participation ?? "",
      ...(manage ? { systemPrompt: prompts.get(agent.id) ?? "" } : {}),
    }));
  return NextResponse.json({ agents }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const admin = await createCommunityAdminClient();
  if (!admin) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });
  const access = await getCommunityAccess(admin, id, user.id);
  if (!access.community) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  if (!access.isOwner) return NextResponse.json({ error: "Only the community owner can create AI agents." }, { status: 403 });

  const payload = await request.json().catch(() => null) as AgentInput | null;
  if (!payload) return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  const name = text(payload.name, 100);
  const role = text(payload.role, 180);
  const description = text(payload.description, 1500);
  const idPart = slugify(name);
  const handleInput = text(payload.handle, 100);
  const handle = handleInput ? (handleInput.startsWith("@") ? handleInput : "@" + handleInput).replace(/\s+/g, "-") : "@" + idPart;
  const systemPrompt = text(payload.systemPrompt, 15000);
  if (name.length < 2 || role.length < 2 || description.length < 2 || !idPart) {
    return NextResponse.json({ error: "Name, role, and description are required." }, { status: 400 });
  }
  if (!/^@[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(handle)) {
    return NextResponse.json({ error: "Handle must begin with @ and use letters, numbers, hyphens, or underscores." }, { status: 400 });
  }

  const agentId = "community-" + crypto.randomUUID().replace(/-/g, "");
  const status = payload ? "AVAILABLE" : "AVAILABLE";
  const { data: agent, error } = await admin.from("community_agents").insert({
    id: agentId, community_id: id, name, handle, role, description,
    capabilities: list(payload.capabilities), specialties: list(payload.specialties),
    participation: text(payload.participation, 1000), status, is_active: true, created_by: user.id,
  }).select("id, community_id, name, handle, role, description, capabilities, specialties, participation, status, is_active, created_at, updated_at").single();
  if (error || !agent) return NextResponse.json({ error: error?.code === "23505" ? "That handle is already used in this community." : "Could not create the community agent." }, { status: error?.code === "23505" ? 409 : 500 });

  const { error: promptError } = await admin.from("community_agent_prompts").insert({ agent_id: agentId, system_prompt: systemPrompt });
  if (promptError) {
    await admin.from("community_agents").delete().eq("id", agentId).eq("community_id", id);
    return NextResponse.json({ error: "The agent was not saved because its instructions could not be stored." }, { status: 500 });
  }

  return NextResponse.json({ agent: { ...agent, systemPrompt } }, { status: 201 });
}
