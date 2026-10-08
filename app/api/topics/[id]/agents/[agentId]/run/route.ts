import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgent, runAgent, type AgentArtifactContext } from "@/lib/agent-runtime";
import { createClient as createServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; agentId: string }> };

export const maxDuration = 60;

function isMissingArtifactsTable(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (["42P01", "PGRST205"].includes(error.code || "") ||
        /could not find the table|relation .* does not exist/i.test(error.message || "")),
  );
}

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

  const { data: humanParticipant } = await admin
    .from("topic_participants")
    .select("id")
    .eq("topic_id", topicId)
    .eq("participant_type", "HUMAN")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!humanParticipant) {
    return NextResponse.json({ error: "Join the topic before running an agent." }, { status: 403 });
  }

  const { data: topic, error: topicError } = await admin
    .from("topics")
    .select("id, title, body, type")
    .eq("id", topicId)
    .single();

  if (topicError || !topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const { data: agentParticipant, error: participantError } = await admin
    .from("topic_participants")
    .select("id")
    .eq("topic_id", topicId)
    .eq("participant_type", "AGENT")
    .eq("agent_id", agent.id)
    .maybeSingle();

  if (participantError || !agentParticipant) {
    return NextResponse.json({ error: "Add this agent to the topic first." }, { status: 409 });
  }

  const { data: existingPosts, error: postContextError } = await admin
    .from("posts")
    .select("participant_id, body, created_at")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true })
    .limit(40);

  if (postContextError) return NextResponse.json({ error: postContextError.message }, { status: 500 });

  const participantIds = Array.from(new Set((existingPosts ?? []).map((post) => post.participant_id)));
  const { data: participants, error: participantContextError } = participantIds.length
    ? await admin.from("topic_participants").select("id, participant_type, user_id, agent_id").in("id", participantIds)
    : { data: [], error: null };

  if (participantContextError) {
    return NextResponse.json({ error: participantContextError.message }, { status: 500 });
  }

  const userIds = Array.from(
    new Set((participants ?? [])
      .filter((participant) => participant.participant_type === "HUMAN" && participant.user_id)
      .map((participant) => participant.user_id as string)),
  );

  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("profiles").select("id, username, display_name").in("id", userIds)
    : { data: [], error: null };

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.username || "Human"]));
  const participantMap = new Map((participants ?? []).map((participant) => [participant.id, participant]));
  const contextPosts = (existingPosts ?? []).map((post) => {
    const participant = participantMap.get(post.participant_id);
    const author = participant?.participant_type === "AGENT"
      ? getAgent(participant.agent_id || "")?.name || "AI agent"
      : profileMap.get(participant?.user_id || "") || "Human";
    return { author, body: post.body };
  });

  const { data: artifactRows, error: artifactsError } = await admin
    .from("research_artifacts")
    .select("id, artifact_type, title, content, created_at, provenance")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (artifactsError && !isMissingArtifactsTable(artifactsError)) {
    return NextResponse.json({ error: artifactsError.message }, { status: 500 });
  }

  const contextArtifacts = (artifactRows ?? []) as AgentArtifactContext[];
  const startedAt = new Date().toISOString();

  async function recordExecution(values: {
    status: "SUCCEEDED" | "FAILED";
    provider?: string;
    model?: string;
    outputPostId?: string;
    errorMessage?: string;
    contextArtifactIds?: string[];
  }) {
    const { error } = await admin.from("agent_executions").insert({
      topic_id: topicId,
      agent_id: agent.id,
      agent_name: agent.name,
      execution_type: "REPLY",
      status: values.status,
      triggered_by: user.id,
      provider: values.provider ?? null,
      model: values.model ?? null,
      context_post_count: contextPosts.length,
      context_artifact_ids: values.contextArtifactIds ?? contextArtifacts.map((artifact) => artifact.id),
      output_post_id: values.outputPostId ?? null,
      output_artifact_id: null,
      error_message: values.errorMessage ?? null,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    });
    return !error;
  }

  let result;
  try {
    result = await runAgent(agent, topic, contextPosts, contextArtifacts);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Agent execution failed.";
    const executionLogged = await recordExecution({ status: "FAILED", errorMessage });
    return NextResponse.json({ error: errorMessage, executionLogged }, { status: 502 });
  }

  const { data: insertedPost, error: insertError } = await admin
    .from("posts")
    .insert({ topic_id: topicId, participant_id: agentParticipant.id, body: result.content })
    .select("id, topic_id, participant_id, body, created_at, updated_at")
    .single();

  if (insertError || !insertedPost) {
    const errorMessage = insertError?.message || "Agent response was generated but could not be published.";
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
    outputPostId: insertedPost.id,
    contextArtifactIds: result.contextArtifactIds,
  });

  return NextResponse.json({
    post: insertedPost,
    agent: { id: agent.id, name: agent.name },
    provider: result.provider,
    model: result.model,
    contextArtifactCount: result.contextArtifactIds.length,
    executionLogged,
  });
}
