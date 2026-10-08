import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgent, runAgent, type AgentArtifactContext } from "@/lib/agent-runtime";
import { selectAgentsForResponse } from "@/lib/agent-routing";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

function missingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (["42P01", "PGRST205"].includes(error.code || "") || /relation .* does not exist|could not find the table/i.test(error.message || "")));
}

export async function POST(request: Request, { params }: Params) {
  const { id: topicId } = await params;
  const payload = (await request.json().catch(() => null)) as { body?: string } | null;
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Reply body is required." }, { status: 400 });
  if (body.length > 12000) {
    return NextResponse.json({ error: "Replies must be 12,000 characters or fewer." }, { status: 413 });
  }

  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Server runtime is not configured: SUPABASE_SERVICE_ROLE_KEY is missing." }, { status: 503 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: topic, error: topicError } = await admin.from("topics").select("id, title, body, type").eq("id", topicId).single();
  if (topicError || !topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const { data: humanParticipant } = await admin.from("topic_participants").select("id").eq("topic_id", topicId).eq("participant_type", "HUMAN").eq("user_id", user.id).maybeSingle();
  if (!humanParticipant) return NextResponse.json({ error: "Join the topic before replying." }, { status: 403 });

  const { data: humanPost, error: postError } = await admin.from("posts").insert({ topic_id: topicId, participant_id: humanParticipant.id, body }).select("id, topic_id, participant_id, body, created_at, updated_at").single();
  if (postError || !humanPost) return NextResponse.json({ error: postError?.message || "Could not publish your reply." }, { status: 500 });

  const { data: allParticipants } = await admin.from("topic_participants").select("id, participant_type, user_id, agent_id").eq("topic_id", topicId);
  const attachedAgentIds = (allParticipants ?? []).filter((p) => p.participant_type === "AGENT" && p.agent_id).map((p) => p.agent_id as string);
  const selectedAgents = selectAgentsForResponse(topic, body, attachedAgentIds, 2);

  const { data: recentPosts } = await admin.from("posts").select("participant_id, body, created_at").eq("topic_id", topicId).order("created_at", { ascending: true }).limit(40);
  const participantIds = Array.from(new Set((recentPosts ?? []).map((post) => post.participant_id)));
  const { data: participants } = participantIds.length ? await admin.from("topic_participants").select("id, participant_type, user_id, agent_id").in("id", participantIds) : { data: [] };
  const userIds = Array.from(new Set((participants ?? []).filter((p) => p.participant_type === "HUMAN" && p.user_id).map((p) => p.user_id as string)));
  const { data: profiles } = userIds.length ? await admin.from("profiles").select("id, username, display_name").in("id", userIds) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.username || "Human"]));
  const participantMap = new Map((participants ?? []).map((p) => [p.id, p]));
  const contextPosts: Array<{ author: string; body: string }> = (recentPosts ?? []).map((post) => {
    const participant = participantMap.get(post.participant_id);
    const author = participant?.participant_type === "AGENT" ? getAgent(participant.agent_id || "")?.name || "AI agent" : profileMap.get(participant?.user_id || "") || "Human";
    return { author, body: post.body };
  });

  const { data: artifactRows, error: artifactsError } = await admin.from("research_artifacts").select("id, artifact_type, title, content, created_at, provenance").eq("topic_id", topicId).order("created_at", { ascending: false }).limit(12);
  const contextArtifacts = artifactsError && missingTable(artifactsError) ? [] as AgentArtifactContext[] : (artifactRows ?? []) as AgentArtifactContext[];

  const results: Array<{ agent: Agent; post: unknown }> = [];
  const failures: string[] = [];

  async function recordFailedExecution(agent: Agent, errorMessage: string) {
    const { error } = await admin.from("agent_executions").insert({
      topic_id: topicId,
      agent_id: agent.id,
      agent_name: agent.name,
      execution_type: "REPLY",
      status: "FAILED",
      triggered_by: user.id,
      provider: null,
      model: null,
      context_post_count: contextPosts.length,
      context_artifact_ids: contextArtifacts.map((artifact) => artifact.id),
      output_post_id: null,
      output_artifact_id: null,
      error_message: errorMessage,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    return !error;
  }

  for (const agent of selectedAgents) {
    const participant = (allParticipants ?? []).find((p) => p.participant_type === "AGENT" && p.agent_id === agent.id);
    if (!participant) continue;
    try {
      const result = await runAgent(agent, { ...topic, latestMessage: body }, contextPosts, contextArtifacts);
      const { data: agentPost, error: agentPostError } = await admin.from("posts").insert({ topic_id: topicId, participant_id: participant.id, body: result.content }).select("id, topic_id, participant_id, body, created_at, updated_at").single();
      if (agentPostError || !agentPost) {
        const errorMessage = agentPostError?.message || "The agent response could not be published.";
        await recordFailedExecution(agent, errorMessage);
        failures.push(agent.name);
        continue;
      }

      const { error: executionError } = await admin.from("agent_executions").insert({ topic_id: topicId, agent_id: agent.id, agent_name: agent.name, execution_type: "REPLY", status: "SUCCEEDED", triggered_by: user.id, provider: result.provider, model: result.model, context_post_count: contextPosts.length, context_artifact_ids: result.contextArtifactIds, output_post_id: agentPost.id, output_artifact_id: null, error_message: null, started_at: new Date().toISOString(), completed_at: new Date().toISOString() });
      results.push({ agent, post: agentPost });
      // Later specialists see earlier specialists' posts from this same turn.
      contextPosts.push({ author: agent.name, body: agentPost.body });
      if (executionError) { /* The post is still valid even if audit logging is unavailable. */ }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Agent execution failed.";
      await recordFailedExecution(agent, errorMessage);
      failures.push(agent.name);
    }
  }

  return NextResponse.json({ humanPost, agentPosts: results, selectedAgentIds: selectedAgents.map((agent) => agent.id), failures });
}