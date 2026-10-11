import { NextResponse } from "next/server";
import { checkPlatformAdmin } from "@/lib/admin-auth";
import { createAgentRegistryAdminClient } from "@/lib/agent-registry";

export const dynamic = "force-dynamic";

type AgentInput = {
  id?: unknown;
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
  const items = Array.isArray(value)
    ? value
    : typeof value === "string" ? value.split(/[\n,]+/) : [];
  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, maxItems);
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function parseAgent(input: AgentInput, createdBy: string, allowId: boolean) {
  const name = text(input.name, 100);
  const id = allowId ? slugify(text(input.id, 80) || name) : "";
  const role = text(input.role, 180);
  const description = text(input.description, 1500);
  const handleInput = text(input.handle, 100);
  const handle = handleInput
    ? (handleInput.startsWith("@") ? handleInput : "@" + handleInput).replace(/\s+/g, "-")
    : "@" + id;
  const status = input.status === "PLANNED" ? "PLANNED" : "AVAILABLE";
  const systemPrompt = text(input.systemPrompt, 15000);
  const isActive = typeof input.isActive === "boolean" ? input.isActive : true;

  if (!name || !role || !description) {
    return { error: "Name, role, and description are required." as const };
  }
  if (allowId && (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))) {
    return { error: "Agent ID must contain lowercase letters, numbers, and hyphens." as const };
  }
  if (!/^@[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(handle)) {
    return { error: "Handle must begin with @ and contain only letters, numbers, hyphens, or underscores." as const };
  }

  return {
    row: {
      ...(allowId ? { id } : {}),
      name, handle, role, description,
      capabilities: list(input.capabilities),
      specialties: list(input.specialties),
      participation: text(input.participation, 1000),
      permissions: list(input.permissions),
      status,
      system_prompt: systemPrompt,
      is_active: isActive,
      ...(allowId ? { created_by: createdBy } : {}),
      updated_at: new Date().toISOString(),
    },
  };
}

export async function GET() {
  const auth = await checkPlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const client = createAgentRegistryAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Server database access is not configured. Check SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const { data, error } = await client.from("agent_registry")
    .select("id, name, handle, role, description, capabilities, specialties, participation, permissions, status, system_prompt, is_active, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({
      error: error.code === "42P01" || error.code === "PGRST205"
        ? "The agent_registry table is missing. Apply supabase/migrations/20261011_agent_registry.sql in Supabase first."
        : "The agent registry could not be loaded: " + error.message,
    }, { status: 503 });
  }

  const agents = (data ?? []).map((row) => ({
    id: row.id, name: row.name, handle: row.handle, role: row.role,
    description: row.description, capabilities: row.capabilities ?? [],
    specialties: row.specialties ?? [], participation: row.participation ?? "",
    permissions: row.permissions ?? [], status: row.status,
    systemPrompt: row.system_prompt ?? "", isActive: row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));

  return NextResponse.json({ agents }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await checkPlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const payload = await request.json().catch(() => null) as AgentInput | null;
  if (!payload) return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  const parsed = parseAgent(payload, auth.user.id, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const client = createAgentRegistryAdminClient();
  if (!client) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });

  const { data, error } = await client.from("agent_registry")
    .insert(parsed.row)
    .select("id, name, handle, role, description, capabilities, specialties, participation, permissions, status, system_prompt, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({
      error: error?.code === "23505"
        ? "That agent ID or handle is already in use."
        : error?.message || "The agent could not be created.",
    }, { status: error?.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json({
    agent: {
      id: data.id, name: data.name, handle: data.handle, role: data.role,
      description: data.description, capabilities: data.capabilities ?? [],
      specialties: data.specialties ?? [], participation: data.participation ?? "",
      permissions: data.permissions ?? [], status: data.status,
      systemPrompt: data.system_prompt ?? "", isActive: data.is_active,
      createdAt: data.created_at, updatedAt: data.updated_at,
    },
  }, { status: 201 });
}
