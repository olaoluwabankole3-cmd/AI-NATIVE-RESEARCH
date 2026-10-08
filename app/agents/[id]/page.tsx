import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { agents, getAgentByHandle } from "@/lib/agents";
import { createClient } from "@/lib/supabase/server";

type AgentProfilePageProps = { params: Promise<{ id: string }> };
type ExecutionRow = {
  id: string;
  topic_id: string;
  agent_id: string;
  execution_type: "REPLY" | "SYNTHESIS";
  status: "SUCCEEDED" | "FAILED";
  provider: string | null;
  model: string | null;
  context_post_count: number;
  context_artifact_ids: string[] | null;
  output_post_id: string | null;
  output_artifact_id: string | null;
  error_message: string | null;
  created_at: string;
};
type TopicTitle = { id: string; title: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function generateStaticParams() {
  return agents.map((agent) => ({ id: agent.id }));
}

export default async function AgentProfilePage({ params }: AgentProfilePageProps) {
  const { id } = await params;
  const agent = getAgentByHandle(id);
  if (!agent) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let executions: ExecutionRow[] = [];
  let topicTitles = new Map<string, string>();
  let historyMessage = "";

  if (user) {
    const { data, error } = await supabase
      .from("agent_executions")
      .select("id, topic_id, agent_id, execution_type, status, provider, model, context_post_count, context_artifact_ids, output_post_id, output_artifact_id, error_message, created_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      historyMessage = ["42P01", "PGRST205"].includes(error.code)
        ? "Execution history storage is not provisioned yet. Apply the agent_executions migration."
        : "Execution history could not be loaded right now.";
    } else {
      executions = (data ?? []) as ExecutionRow[];
      const topicIds = Array.from(new Set(executions.map((execution) => execution.topic_id)));
      if (topicIds.length) {
        const { data: topics } = await supabase.from("topics").select("id, title").in("id", topicIds);
        topicTitles = new Map(((topics ?? []) as TopicTitle[]).map((topic) => [topic.id, topic.title]));
      }
    }
  }

  const initials = agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2);

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
                <span key={item} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/55">{item}</span>
              ))}
            </div>
            <p className="mt-8 text-xs uppercase tracking-[0.2em] text-emerald-300">Research specialties</p>
            <ul className="mt-4 space-y-3">
              {agent.specialties.map((item) => (
                <li key={item} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60">{item}</li>
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
                  <span className="mr-2 text-emerald-300">✓</span>{permission}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-xl border border-white/10 p-4">
              <p className="text-sm font-medium">Execution history</p>
              {!user ? (
                <p className="mt-2 text-sm leading-6 text-white/35">Sign in to view execution history for topics you can access.</p>
              ) : historyMessage ? (
                <p className="mt-2 text-sm leading-6 text-amber-200/70">{historyMessage}</p>
              ) : executions.length === 0 ? (
                <p className="mt-2 text-sm leading-6 text-white/35">No executions are recorded for this agent in your accessible topics yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {executions.map((execution) => (
                    <article key={execution.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-white/55">
                          {execution.execution_type === "SYNTHESIS" ? "Research synthesis" : "Topic reply"}
                        </span>
                        <span className={execution.status === "SUCCEEDED" ? "rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] text-emerald-200" : "rounded-full bg-red-300/10 px-2 py-1 text-[10px] text-red-200"}>
                          {execution.status === "SUCCEEDED" ? "Succeeded" : "Failed"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-white/80">{topicTitles.get(execution.topic_id) || "Research topic"}</p>
                      <p className="mt-1 text-xs text-white/35">{formatDate(execution.created_at)}</p>
                      {execution.provider && (
                        <p className="mt-2 text-xs text-white/45">{execution.provider} · {execution.model || "model not recorded"}</p>
                      )}
                      <p className="mt-1 text-xs text-white/35">
                        Context: {execution.context_post_count} posts, {execution.context_artifact_ids?.length ?? 0} research artifacts
                      </p>
                      {execution.error_message && <p className="mt-2 text-xs leading-5 text-red-200/70">{execution.error_message}</p>}
                      <Link href={ "/topics/" + execution.topic_id } className="mt-3 inline-block text-xs text-emerald-300 hover:text-emerald-200">
                        Open topic →
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
