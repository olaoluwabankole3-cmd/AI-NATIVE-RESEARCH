import { NextResponse } from "next/server";
import { checkPlatformAdmin } from "@/lib/admin-auth";
import { createAgentRegistryAdminClient } from "@/lib/agent-registry";

type Params = { params: Promise<{ id: string }> };
type AgentInput = {
  name?: unknown;
  handle?: unknown;
  role?: unknown;
  description?: unknown;
  capabilities?: unknown;
  specialties?: unknown;
  participation?: unknown;
  permissions?: unknown;
  status?: unknown;
  systemPrompt?: unknown;
  isActive?: unknown;
};

function text(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown, maxItems = 30): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,]+/) : [];
  return items.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 120)).filter(Boolean).slice(0, maxItems);
}

function parseAgent(input: AgentInput) {
  const name = text(input.name, 100);
  const role = text(input.role, 180);
  const description = text(input.description, 1500);
  const handleInput = text(input.handle, 100);
  const handle = handleInput ? (handleInput.startsWith("@") ? handleInput : "@" + handleInput).replace(/\s+/g, "-") : "";
  if (!name || !role || !description) return { error: "Name, role, and description are required." as const };
  if (!/^@[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(handle)) {
    return { error: "Handle must begin with @ and contain only letters, numbers, hyphens, or underscores." as const };
  }
  return { row: {
    name, handle, role, description, capabilities: list(input.capabilities),
    specialties: list(input.specialties), participation: text(input.participation, 1000),
    permissions: list(input.permissions), status: input.status === "PLANNED" ? "PLANNED" : "AVAILABLE",
    system_prompt: text(input.systemPrompt, 15000),
    is_active: typeof input.isActive === "boolean" ? input.isActive : true,
    updated_at: new Date().toISOString(),
  } };
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await checkPlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const payload = await request.json().catch(() => null) as AgentInput | null;
  if (!payload) return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  const parsed = parseAgent(payload);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const client = createAgentRegistryAdminClient();
  if (!client) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });

  const { data, error } = await client.from("agent_registry")
    .update(parsed.row)
    .eq("id", id)
    .select("id, name, handle, role, description, capabilities, specialties, participation, permissions, status, system_prompt, is_active, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({
      error: error?.code === "23505" ? "That handle is already in use." : error?.message || "Agent not found.",
    }, { status: error?.code === "23505" ? 409 : error ? 500 : 404 });
  }

  return NextResponse.json({ agent: {
    id: data.id, name: data.name, handle: data.handle, role: data.role,
    description: data.description, capabilities: data.capabilities ?? [],
    specialties: data.specialties ?? [], participation: data.participation ?? "",
    permissions: data.permissions ?? [], status: data.status,
    systemPrompt: data.system_prompt ?? "", isActive: data.is_active,
    createdAt: data.created_at, updatedAt: data.updated_at,
  } });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await checkPlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const client = createAgentRegistryAdminClient();
  if (!client) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });

  // Deactivate instead of deleting: old posts, participants, and execution history retain their references.
  const { data, error } = await client.from("agent_registry")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id).select("id, is_active").maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Agent not found." }, { status: error ? 500 : 404 });
  }
  return NextResponse.json({ success: true, id: data.id, isActive: data.is_active });
}
