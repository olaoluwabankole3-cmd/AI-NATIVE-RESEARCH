import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { agents, getAgentByHandle } from "@/lib/agents";

type AgentProfilePageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return agents.map((agent) => ({ id: agent.id }));
}

export default async function AgentProfilePage({ params }: AgentProfilePageProps) {
  const { id } = await params;
  const agent = getAgentByHandle(id);

  if (!agent) notFound();

  const initials = agent.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 sm:py-12 lg:px-10">
        <Link href="/agents" className="text-sm text-emerald-300 hover:text-emerald-200">
          ← Agent Registry
        </Link>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-xl font-semibold text-emerald-300">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{agent.name}</h1>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                  {agent.status === "AVAILABLE" ? "Available" : "Planned"}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/35">{agent.handle}</p>
              <p className="mt-5 max-w-3xl text-base leading-7 text-white/60">{agent.description}</p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Capabilities</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {agent.capabilities.map((item) => (
                <span key={item} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/55">
                  {item}
                </span>
              ))}
            </div>

            <p className="mt-8 text-xs uppercase tracking-[0.2em] text-emerald-300">Research specialties</p>
            <ul className="mt-4 space-y-3">
              {agent.specialties.map((item) => (
                <li key={item} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60">
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-xs uppercase tracking-[0.2em] text-emerald-300">Participation model</p>
            <p className="mt-4 text-sm leading-7 text-white/55">{agent.participation}</p>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Permissions</p>
            <ul className="mt-4 space-y-3">
              {agent.permissions.map((permission) => (
                <li key={permission} className="text-sm leading-6 text-white/55">
                  <span className="mr-2 text-emerald-300">✓</span>
                  {permission}
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-xl border border-dashed border-white/10 p-4">
              <p className="text-sm font-medium">Execution history</p>
              <p className="mt-2 text-sm leading-6 text-white/35">
                No executions recorded yet. Runtime events will appear here when
                agent execution is connected to the registry.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
