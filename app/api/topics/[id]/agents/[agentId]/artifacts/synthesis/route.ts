import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgent, runAgent, type AgentArtifactContext } from "@/lib/agent-runtime";
import { createClient as createServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; agentId: string }> };

export const maxDuration = 60;

export async function POST(_request: Request, { params }: Params) {
  const { id: topicId, agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Agent runtime is not configured: SUPABASE_SERVICE_ROLE_KEY is missing." },
      { status: 503 },
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: humanParticipant } = await admin.from("topic_participants")
    .select("id").eq("topic_id", topicId).eq("participant_type", "HUMAN")
    .eq("user_id", user.id).maybeSingle();
  if (!humanParticipant) {
    return NextResponse.json({ error: "Join the topic before generating research." }, { status: 403 });
  }

  const { data: topic, error: topicError } = await admin.from("topics")
    .select("id, title, body, type").eq("id", topicId).single();
  if (topicError || !topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  if (topic.type !== "RESEARCH") {
    return NextResponse.json({ error: "Synthesis artifacts are available for research topics only." }, { status: 409 });
  }

  const { data: agentParticipant } = await admin.from("topic_participants")
    .select("id").eq("topic_id", topicId).eq("participant_type", "AGENT")
    .eq("agent_id", agent.id).maybeSingle();
  if (!agentParticipant) {
    return NextResponse.json({ error: "Add this agent to the topic first." }, { status: 409 });
  }

  const { data: existingPosts, error: postsError } = await admin.from("posts")
    .select("participant_id, body, created_at").eq("topic_id", topicId)
    .order("created_at", { ascending: false }).limit(60);
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500 });

  const chronologicalPosts = [...(existingPosts ?? [])].reverse();
  const participantIds = Array.from(new Set(chronologicalPosts.map((post) => post.participant_id)));
  const { data: participants, error: participantsError } = participantIds.length
    ? await admin.from("topic_participants").select("id, participant_type, user_id, agent_id").in("id", participantIds)
    : { data: [], error: null };
  if (participantsError) return NextResponse.json({ error: participantsError.message }, { status: 500 });

  const userIds = Array.from(new Set((participants ?? [])
    .filter((participant) => participant.participant_type === "HUMAN" && participant.user_id)
    .map((participant) => participant.user_id as string)));
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("profiles").select("id, username, display_name").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.username || "Human"]));
  const participantMap = new Map((participants ?? []).map((participant) => [participant.id, participant]));
  const contextPosts = chronologicalPosts.map((post) => {
    const participant = participantMap.get(post.participant_id);
    const author = participant?.participant_type === "AGENT"
      ? getAgent(participant.agent_id || "")?.name || "AI agent"
      : profileMap.get(participant?.user_id || "") || "Human";
    return { author, body: post.body };
  });

  const { data: artifactRows, error: artifactsError } = await admin.from("research_artifacts")
    .select("id, artifact_type, title, content, created_at, provenance")
    .eq("topic_id", topicId).order("created_at", { ascending: false }).limit(12);
  if (artifactsError) {
    return NextResponse.json({
      error: "Research artifact storage is not ready. Apply the research_artifacts migration before generating a synthesis.",
      detail: artifactsError.message,
    }, { status: 503 });
  }

  const contextArtifacts = (artifactRows ?? []) as AgentArtifactContext[];
  const startedAt = new Date().toISOString();

  async function recordExecution(values: {
    status: "SUCCEEDED" | "FAILED";
    provider?: string;
    model?: string;
    outputArtifactId?: string;
    errorMessage?: string;
    contextArtifactIds?: string[];
  }) {
    const { error } = await admin.from("agent_executions").insert({
      topic_id: topicId,
      agent_id: agent.id,
      agent_name: agent.name,
      execution_type: "SYNTHESIS",
      status: values.status,
      triggered_by: user.id,
      provider: values.provider ?? null,
      model: values.model ?? null,
      context_post_count: contextPosts.length,
      context_artifact_ids: values.contextArtifactIds ?? contextArtifacts.map((artifact) => artifact.id),
      output_post_id: null,
      output_artifact_id: values.outputArtifactId ?? null,
      error_message: values.errorMessage ?? null,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return !error;
  }

  let result;
  try {
    result = await runAgent(
      agent,
      topic,
      contextPosts.length ? contextPosts : [{ author: "Human", body: "No replies yet; synthesize the research question from the opening topic." }],
      contextArtifacts,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Research synthesis failed.";
    const executionLogged = await recordExecution({ status: "FAILED", errorMessage });
    return NextResponse.json({ error: errorMessage, executionLogged }, { status: 502 });
  }

  const { data: artifact, error: artifactError } = await admin.from("research_artifacts").insert({
    topic_id: topicId,
    created_by_participant_id: agentParticipant.id,
    artifact_type: "SYNTHESIS",
    title: agent.name + " synthesis",
    content: result.content,
    provenance: {
      generated: true,
      generated_by_agent_id: agent.id,
      generated_by_agent_name: agent.name,
      provider: result.provider,
      model: result.model,
      generated_from: "topic_posts_and_research_artifacts",
      context_artifact_ids: result.contextArtifactIds,
      context_post_count: contextPosts.length,
    },
  }).select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, created_at").single();

  if (artifactError || !artifact) {
    const errorMessage = artifactError?.message || "Synthesis was generated but could not be saved.";
    const executionLogged = await recordExecution({
      status: "FAILED",
      provider: result.provider,
      model: result.model,
      contextArtifactIds: result.contextArtifactIds,
      errorMessage,
    });
    return NextResponse.json({ error: errorMessage, executionLogged }, { status: 500 });
  }

  const executionLogged = await recordExecution({
    status: "SUCCEEDED",
    provider: result.provider,
    model: result.model,
    outputArtifactId: artifact.id,
    contextArtifactIds: result.contextArtifactIds,
  });

  return NextResponse.json({
    artifact,
    agent: { id: agent.id, name: agent.name },
    provider: result.provider,
    model: result.model,
    contextArtifactCount: result.contextArtifactIds.length,
    executionLogged,
  });
}
