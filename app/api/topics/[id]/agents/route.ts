import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createCommunityAdminClient, getCommunityAccess, getAgentForTopic } from "@/lib/community-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: topicId } = await params;
  const payload = (await request.json().catch(() => null)) as { agentId?: unknown } | null;
  const agentId = typeof payload?.agentId === "string" ? payload.agentId.trim() : "";
  if (!agentId) return NextResponse.json({ error: "Agent ID is required." }, { status: 400 });

  const auth = await createServerClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const admin = await createCommunityAdminClient();
  if (!admin) return NextResponse.json({ error: "Server runtime is not configured." }, { status: 503 });

  const { data: topic, error: topicError } = await admin.from("topics")
    .select("id, community_id").eq("id", topicId).maybeSingle();
  if (topicError || !topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const access = await getCommunityAccess(admin, topic.community_id, user.id);
  if (!access.community) return NextResponse.json({ error: "Community not found." }, { status: 404 });
  if (!access.canParticipate) return NextResponse.json({ error: "Join this community before adding an AI specialist." }, { status: 403 });

  const { data: humanParticipant, error: membershipError } = await admin.from("topic_participants")
    .select("id").eq("topic_id", topicId).eq("participant_type", "HUMAN")
    .eq("user_id", user.id).maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Could not verify your participation in this topic." }, { status: 500 });
  if (!humanParticipant) return NextResponse.json({ error: "Open the topic as a community member before adding an AI specialist." }, { status: 403 });

  const agent = await getAgentForTopic(admin, topicId, agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found, inactive, or not available to this community." }, { status: 404 });
  if (agent.status !== "AVAILABLE" || agent.isActive === false) return NextResponse.json({ error: "This agent is not currently available." }, { status: 409 });

  const { data: existingParticipant, error: existingError } = await admin.from("topic_participants")
    .select("id, participant_type, user_id, agent_id").eq("topic_id", topicId)
    .eq("participant_type", "AGENT").eq("agent_id", agentId).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Could not check existing topic participants." }, { status: 500 });
  if (existingParticipant) return NextResponse.json({ participant: existingParticipant, alreadyAdded: true });

  const { data: participant, error: insertError } = await admin.from("topic_participants").insert({
    topic_id: topicId, participant_type: "AGENT", user_id: null, agent_id: agentId,
  }).select("id, participant_type, user_id, agent_id").single();

  if (insertError || !participant) {
    const { data: winner } = await admin.from("topic_participants").select("id, participant_type, user_id, agent_id")
      .eq("topic_id", topicId).eq("participant_type", "AGENT").eq("agent_id", agentId).maybeSingle();
    if (winner) return NextResponse.json({ participant: winner, alreadyAdded: true });
    return NextResponse.json({ error: insertError?.message || "Could not add the AI specialist." }, { status: 500 });
  }
  return NextResponse.json({ participant, alreadyAdded: false }, { status: 201 });
}
