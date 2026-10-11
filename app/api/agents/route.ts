import { NextResponse } from "next/server";
import { getRegisteredAgents } from "@/lib/agent-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await getRegisteredAgents();
  const publicAgents = agents
    .filter((agent) => agent.status === "AVAILABLE" || agent.status === "PLANNED")
    .map(({ id, name, handle, role, description, capabilities, specialties, participation, permissions, status }) => ({
      id, name, handle, role, description, capabilities, specialties, participation, permissions, status,
    }));

  return NextResponse.json({ agents: publicAgents }, {
    headers: { "Cache-Control": "no-store" },
  });
}
