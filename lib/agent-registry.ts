import "server-only";

import { createClient } from "@supabase/supabase-js";
import { agents, type Agent } from "@/lib/agents";

export type AgentRegistryOptions = { includeInactive?: boolean };

type AgentRegistryRow = {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  capabilities: string[] | null;
  specialties: string[] | null;
  participation: string | null;
  permissions: string[] | null;
  status: "AVAILABLE" | "PLANNED";
  system_prompt: string | null;
  is_active: boolean;
};

export function createAgentRegistryAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function fromRow(row: AgentRegistryRow): Agent {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    role: row.role,
    description: row.description,
    capabilities: row.capabilities ?? [],
    specialties: row.specialties ?? [],
    participation: row.participation ?? "",
    permissions: row.permissions ?? [],
    status: row.status,
    systemPrompt: row.system_prompt ?? "",
    isActive: row.is_active,
  };
}

function isMissingRegistry(error: { code?: string; message?: string } | null) {
  return Boolean(error && (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /agent_registry.*does not exist|could not find the table/i.test(error.message ?? "")
  ));
}

export async function getRegisteredAgents(options: AgentRegistryOptions = {}): Promise<Agent[]> {
  const client = createAgentRegistryAdminClient();
  if (!client) return agents.map((agent) => ({ ...agent, isActive: true, systemPrompt: "" }));

  let query = client.from("agent_registry")
    .select("id, name, handle, role, description, capabilities, specialties, participation, permissions, status, system_prompt, is_active")
    .order("name", { ascending: true });
  if (!options.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    // Keep the app usable until the registry migration is applied, but only
    // use the in-code baseline as a compatibility fallback.
    if (isMissingRegistry(error)) return agents.map((agent) => ({ ...agent, isActive: true, systemPrompt: "" }));
    return agents.map((agent) => ({ ...agent, isActive: true, systemPrompt: "" }));
  }

  return ((data ?? []) as AgentRegistryRow[]).map(fromRow);
}

export async function getRegisteredAgent(
  id: string,
  options: AgentRegistryOptions = {},
): Promise<Agent | undefined> {
  const client = createAgentRegistryAdminClient();
  if (!client) {
    const fallback = agents.find((agent) => agent.id === id);
    return fallback ? { ...fallback, isActive: true, systemPrompt: "" } : undefined;
  }

  let query = client.from("agent_registry")
    .select("id, name, handle, role, description, capabilities, specialties, participation, permissions, status, system_prompt, is_active")
    .eq("id", id);
  if (!options.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query.maybeSingle();
  if (error) {
    const fallback = agents.find((agent) => agent.id === id);
    return fallback ? { ...fallback, isActive: true, systemPrompt: "" } : undefined;
  }
  return data ? fromRow(data as AgentRegistryRow) : undefined;
}
