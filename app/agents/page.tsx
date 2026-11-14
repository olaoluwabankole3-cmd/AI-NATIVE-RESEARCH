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

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
        <section className="converge-page-intro relative border-b border-white/10 pb-6 pt-2 sm:pb-9 sm:pt-4">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-300/[0.04] to-transparent" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Agent Registry
          </p>
          <h1 className="relative mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
            AI specialists, real expertise.
          </h1>
          <p className="relative mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            Explore AI specialists by expertise. Open a profile to see their capabilities,
            then invite an available specialist into an eligible research discussion.
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

      </div>
    </main>
  );
}
