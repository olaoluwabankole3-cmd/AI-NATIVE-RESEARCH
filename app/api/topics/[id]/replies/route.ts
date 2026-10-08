import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgent, runAgent, type AgentArtifactContext } from "@/lib/agent-runtime";
import type { Agent } from "@/lib/agents";
import { selectAgentsForResponse } from "@/lib/agent-routing";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

function missingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (["42P01", "PGRST205"].includes(error.code || "") || /relation .* does not exist|could not find the table/i.test(error.message || "")));
}

export async function POST(request: Request, { params }: Params) {
  const { id: topicId } = await params;
  const payload = (await request.json().catch(() => null)) as { body?: unknown; requestId?: unknown } | null;
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Reply body is required." }, { status: 400 });
  const suppliedRequestId = typeof payload?.requestId === "string" ? payload.requestId.trim() : "";
  if (suppliedRequestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedRequestId)) {
    return NextResponse.json({ error: "Reply request ID must be a UUID." }, { status: 400 });
  }
  const requestId = suppliedRequestId || randomUUID();
  if (body.length > 12000) {
    return NextResponse.json({ error: "Replies must be 12,000 characters or fewer." }, { status: 413 });
  }

  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const userId = user.id;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "Server runtime is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: topic, error: topicError } = await admin.from("topics").select("id, title, body, type").eq("id", topicId).single();
  if (topicError || !topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const { data: humanParticipant } = await admin.from("topic_participants").select("id").eq("topic_id", topicId).eq("participant_type", "HUMAN").eq("user_id", userId).maybeSingle();
  if (!humanParticipant) return NextResponse.json({ error: "Join the topic before replying." }, { status: 403 });

  const postFields = "id, topic_id, participant_id, body, created_at, updated_at";
  const { data: insertedHumanPost, error: postError } = await admin
    .from("posts")
    .insert({ topic_id: topicId, participant_id: humanParticipant.id, body, client_request_id: requestId })
    .select(postFields)
    .single();
  let humanPost = insertedHumanPost;

  if (postError?.code === "23505") {
    // A retry with the same request ID reuses the first human post.
    const { data: existingHumanPost, error: lookupError } = await admin
      .from("posts")
      .select(postFields)
      .eq("topic_id", topicId)
      .eq("participant_id", humanParticipant.id)
      .eq("client_request_id", requestId)
      .maybeSingle();
    if (lookupError || !existingHumanPost) {
      return NextResponse.json({ error: "The existing reply could not be recovered safely." }, { status: 500 });
    }
    humanPost = existingHumanPost;
  } else if (postError || !humanPost) {
    return NextResponse.json({ error: postError?.message || "Could not publish your reply." }, { status: 500 });
  }

  const warnings: string[] = [];
  const { data: allParticipants, error: allParticipantsError } = await admin
    .from("topic_participants")
    .select("id, participant_type, user_id, agent_id")
    .eq("topic_id", topicId);

  if (allParticipantsError) {
    return NextResponse.json({
      humanPost,
      agentPosts: [],
      selectedAgentIds: [],
      failures: [],
      warnings: ["Your reply was published, but the AI participant list could not be loaded."],
    });
  }

  const attachedAgentIds = (allParticipants ?? [])
    .filter((p) => p.participant_type === "AGENT" && p.agent_id)
    .map((p) => p.agent_id as string);
  const selectedAgents = selectAgentsForResponse(topic, body, attachedAgentIds, 2);

  const { data: recentPosts, error: recentPostsError } = await admin
    .from("posts")
    .select("id, participant_id, body, created_at")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (recentPostsError) warnings.push("The specialists could not load the full recent conversation.");
  const chronologicalPosts = [...(recentPosts ?? [])].reverse();
  const participantIds = Array.from(new Set(chronologicalPosts.map((post) => post.participant_id)));
  const { data: participants, error: participantsError } = participantIds.length
    ? await admin.from("topic_participants").select("id, participant_type, user_id, agent_id").in("id", participantIds)
    : { data: [], error: null };
  if (participantsError) warnings.push("Some conversation author labels could not be resolved.");

  const userIds = Array.from(new Set((participants ?? [])
    .filter((p) => p.participant_type === "HUMAN" && p.user_id)
    .map((p) => p.user_id as string)));
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("profiles").select("id, username, display_name").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) warnings.push("Some human author names could not be resolved.");

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.username || "Human"]));
  const participantMap = new Map((participants ?? []).map((p) => [p.id, p]));
  const contextPostIds = new Set(chronologicalPosts.map((post) => post.id));
  const contextPosts: Array<{ author: string; body: string }> = chronologicalPosts.map((post) => {
    const participant = participantMap.get(post.participant_id);
    const author = participant?.participant_type === "AGENT"
      ? getAgent(participant.agent_id || "")?.name || "AI agent"
      : profileMap.get(participant?.user_id || "") || "Human";
    return { author, body: post.body };
  });

  if (recentPostsError && contextPosts.length === 0) {
    contextPosts.push({ author: "Human", body });
  }

  const { data: artifactRows, error: artifactsError } = await admin
    .from("research_artifacts")
    .select("id, artifact_type, title, content, created_at, provenance")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (artifactsError && !missingTable(artifactsError)) {
    warnings.push("Saved research artifacts were unavailable to the specialists for this reply.");
  }
  const contextArtifacts = artifactsError
    ? [] as AgentArtifactContext[]
    : (artifactRows ?? []) as AgentArtifactContext[];

  function appendContextPost(agent: Agent, post: { id: string; body: string }) {
    if (contextPostIds.has(post.id)) return;
    contextPosts.push({ author: agent.name, body: post.body });
    contextPostIds.add(post.id);
  }

  const results: Array<{ agent: Agent; post: unknown }> = [];
  const failures: string[] = [];

  async function recordFailedExecution(agent: Agent, errorMessage: string) {
    const { error } = await admin.from("agent_executions").insert({
      topic_id: topicId,
      agent_id: agent.id,
      agent_name: agent.name,
      execution_type: "REPLY",
      status: "FAILED",
      triggered_by: userId,
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
    if (error) warnings.push("An agent failure could not be recorded in execution history.");
    return !error;
  }

  for (const agent of selectedAgents) {
    const participant = (allParticipants ?? []).find((p) => p.participant_type === "AGENT" && p.agent_id === agent.id);
    if (!participant) continue;

    try {
      const { data: existingReply, error: existingReplyError } = await admin
        .from("posts")
        .select(postFields)
        .eq("topic_id", topicId)
        .eq("participant_id", participant.id)
        .eq("triggering_post_id", humanPost.id)
        .maybeSingle();

      if (existingReplyError) {
        warnings.push(`Could not check whether ${agent.name} already replied to this message.`);
        failures.push(agent.name);
        continue;
      }
      if (existingReply) {
        results.push({ agent, post: existingReply });
        appendContextPost(agent, existingReply);
        continue;
      }

      const result = await runAgent(agent, { ...topic, latestMessage: body }, contextPosts, contextArtifacts);
      const { data: agentPost, error: agentPostError } = await admin
        .from("posts")
        .insert({ topic_id: topicId, participant_id: participant.id, body: result.content, triggering_post_id: humanPost.id })
        .select(postFields)
        .single();

      if (agentPostError || !agentPost) {
        // Concurrent retries may race; a unique index lets only one reply win.
        if (agentPostError?.code === "23505") {
          const { data: winningPost } = await admin
            .from("posts")
            .select(postFields)
            .eq("topic_id", topicId)
            .eq("participant_id", participant.id)
            .eq("triggering_post_id", humanPost.id)
            .maybeSingle();
          if (winningPost) {
            results.push({ agent, post: winningPost });
            appendContextPost(agent, winningPost);
            continue;
          }
        }
        const errorMessage = agentPostError?.message || "The agent response could not be published.";
        await recordFailedExecution(agent, errorMessage);
        failures.push(agent.name);
        continue;
      }

      const { error: executionError } = await admin.from("agent_executions").insert({ topic_id: topicId, agent_id: agent.id, agent_name: agent.name, execution_type: "REPLY", status: "SUCCEEDED", triggered_by: userId, provider: result.provider, model: result.model, context_post_count: contextPosts.length, context_artifact_ids: result.contextArtifactIds, output_post_id: agentPost.id, output_artifact_id: null, error_message: null, started_at: new Date().toISOString(), completed_at: new Date().toISOString() });
      results.push({ agent, post: agentPost });
      // Later specialists see earlier specialists\u2019 posts from this same turn.
      appendContextPost(agent, agentPost);
      if (executionError) warnings.push(`The reply from ${agent.name} was published, but its execution history could not be saved.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Agent execution failed.";
      await recordFailedExecution(agent, errorMessage);
      failures.push(agent.name);
    }
  }

  return NextResponse.json({
    humanPost,
    agentPosts: results,
    selectedAgentIds: selectedAgents.map((agent) => agent.id),
    failures,
    warnings,
  });
}