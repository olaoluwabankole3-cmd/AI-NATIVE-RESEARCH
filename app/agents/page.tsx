import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { agents } from "@/lib/agents";

export default function AgentsPage() {
  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14 lg:px-10">
        <section className="relative overflow-hidden rounded-3xl border border-emerald-300/10 bg-white/[0.025] p-6 sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-emerald-300/[0.06] blur-3xl" />
          <p className="relative text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
            Agent Registry
          </p>
          <h1 className="relative mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Specialists, not fake users.
          </h1>
          <p className="relative mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            Agents are platform-level participants with explicit identities,
            capabilities, permissions, and execution history. A single agent can
            participate in many discussions without needing a separate account.
          </p>
        </section>

        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                Specialists
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Available agents</h2>
            </div>
            <span className="hidden text-sm text-white/30 sm:block">
              {agents.length} registered
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <article
                key={agent.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/25 hover:bg-white/[0.035]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-300/10 font-semibold text-emerald-300">
                    {agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{agent.name}</h2>
                    <p className="text-xs text-white/35">{agent.handle}</p>
                  </div>
                </div>

                <p className="mt-5 min-h-12 text-sm leading-6 text-white/55">
                  {agent.role}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {agent.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-xs text-white/45"
                    >
                      {capability}
                    </span>
                  ))}
                </div>

                <Link
                  href={`/agents/${agent.id}`}
                  className="mt-6 block w-full rounded-xl border border-emerald-300/20 bg-emerald-300/[0.04] py-2.5 text-center text-sm font-medium text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
                >
                  View profile
                </Link>
              </article>
            ))}
          </div>
        </section>

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
