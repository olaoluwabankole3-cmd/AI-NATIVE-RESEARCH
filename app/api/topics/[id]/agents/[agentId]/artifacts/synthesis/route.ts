import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgent, runAgent } from "@/lib/agent-runtime";
import { createClient as createServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; agentId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: topicId, agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Agent runtime is not configured: SUPABASE_SERVICE_ROLE_KEY is missing." }, { status: 503 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: humanParticipant } = await admin.from("topic_participants").select("id").eq("topic_id", topicId).eq("participant_type", "HUMAN").eq("user_id", user.id).maybeSingle();
  if (!humanParticipant) return NextResponse.json({ error: "Join the topic before generating research." }, { status: 403 });

  const { data: topic, error: topicError } = await admin.from("topics").select("id, title, body, type").eq("id", topicId).single();
  if (topicError || !topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  if (topic.type !== "RESEARCH") return NextResponse.json({ error: "Synthesis artifacts are available for research topics only." }, { status: 409 });

  const { data: agentParticipant } = await admin.from("topic_participants").select("id").eq("topic_id", topicId).eq("participant_type", "AGENT").eq("agent_id", agent.id).maybeSingle();
  if (!agentParticipant) return NextResponse.json({ error: "Add this agent to the topic first." }, { status: 409 });

  const { data: existingPosts } = await admin.from("posts").select("participant_id, body, created_at").eq("topic_id", topicId).order("created_at", { ascending: true }).limit(60);
  const participantIds = Array.from(new Set((existingPosts ?? []).map((post) => post.participant_id)));
  const { data: participants } = participantIds.length ? await admin.from("topic_participants").select("id, participant_type, user_id, agent_id").in("id", participantIds) : { data: [] };
  const userIds = Array.from(new Set((participants ?? []).filter((p) => p.participant_type === "HUMAN" && p.user_id).map((p) => p.user_id as string)));
  const { data: profiles } = userIds.length ? await admin.from("profiles").select("id, username, display_name").in("id", userIds) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.username || "Human"]));
  const participantMap = new Map((participants ?? []).map((p) => [p.id, p]));
  const contextPosts = (existingPosts ?? []).map((post) => {
    const participant = participantMap.get(post.participant_id);
    const author = participant?.participant_type === "AGENT" ? getAgent(participant.agent_id || "")?.name || "AI agent" : profileMap.get(participant?.user_id || "") || "Human";
    return { author, body: post.body };
  });

  let result;
  try {
    result = await runAgent(agent, topic, contextPosts.length ? contextPosts : [{ author: "Human", body: "No replies yet; synthesize the research question from the opening topic." }]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research synthesis failed." }, { status: 502 });
  }

  const { data: artifact, error: artifactError } = await admin.from("research_artifacts").insert({
    topic_id: topicId,
    created_by_participant_id: agentParticipant.id,
    artifact_type: "SYNTHESIS",
    title: `${agent.name} synthesis`,
    content: result.content,
    provenance: { generated: true, generated_by_agent_id: agent.id, generated_by_agent_name: agent.name, provider: result.provider, model: result.model, generated_from: "topic_and_conversation" },
  }).select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, created_at").single();

  if (artifactError || !artifact) return NextResponse.json({ error: artifactError?.message || "Synthesis was generated but could not be saved. Apply the research_artifacts migration first." }, { status: 500 });
  return NextResponse.json({ artifact, agent: { id: agent.id, name: agent.name }, provider: result.provider, model: result.model });
}