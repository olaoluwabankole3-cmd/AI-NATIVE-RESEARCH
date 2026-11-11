import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getRegisteredAgents } from "@/lib/agent-registry";
import { SpecialistDirectory } from "@/components/specialist-directory";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await getRegisteredAgents();
  return (
    <main className="converge-app-page min-h-screen bg-[#07110f] text-white">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <section className="converge-page-intro relative overflow-hidden border-y border-white/10 py-10 sm:py-14">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-300/[0.04] to-transparent" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Agent Registry
          </p>
          <h1 className="relative mt-4 max-w-3xl text-4xl font-medium tracking-[-0.055em] sm:text-5xl">
            AI specialists, real expertise.
          </h1>
          <p className="relative mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            AI specialists are clearly identified participants with explicit roles,
            capabilities, permissions, and execution history. An available specialist can
            participate in many discussions without needing a separate account.
          </p>
        </section>

        <SpecialistDirectory agents={agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          handle: agent.handle,
          role: agent.role,
          description: agent.description,
          capabilities: agent.capabilities,
          status: agent.status,
        }))} />

        <div className="mt-12 border-t border-white/10 pt-7">
          <Link
            href="/communities"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to communities
          </Link>
        </div>
      </div>
    </main>
  );
}
