import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAgent } from "@/lib/agent-runtime";
import type { Agent } from "@/lib/agents";

export type CommunityAccess = {
  id: string;
  name: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE";
  created_by: string;
  members_can_create_topics: boolean;
};

export async function createCommunityAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getCommunityAccess(
  admin: SupabaseClient,
  communityId: string,
  userId: string,
) {
  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("id, name, slug, visibility, created_by, members_can_create_topics")
    .eq("id", communityId)
    .maybeSingle();
  if (communityError || !community) return { community: null, isOwner: false, isMember: false, canRead: false, canParticipate: false, canCreateTopic: false, error: communityError };

  const { data: membership, error: membershipError } = await admin
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) return { community, isOwner: false, isMember: false, canRead: false, canParticipate: false, canCreateTopic: false, error: membershipError };

  const isOwner = community.created_by === userId;
  const isMember = isOwner || Boolean(membership);
  const canRead = community.visibility === "PUBLIC" || isMember;
  const canParticipate = isMember;
  const canCreateTopic = isOwner || (isMember && community.members_can_create_topics);
  return { community: community as CommunityAccess, isOwner, isMember, canRead, canParticipate, canCreateTopic, error: null };
}

export async function getTopicCommunityAccess(
  admin: SupabaseClient,
  topicId: string,
  userId: string,
) {
  const { data: topic, error } = await admin
    .from("topics")
    .select("id, community_id, title, body, type")
    .eq("id", topicId)
    .maybeSingle();
  if (error || !topic) return { topic: null, ...await getCommunityAccess(admin, "", userId), error };
  const access = await getCommunityAccess(admin, topic.community_id, userId);
  return { topic, ...access };
}

export async function getAgentForTopic(
  admin: SupabaseClient,
  topicId: string,
  agentId: string,
): Promise<Agent | undefined> {
  const { data: topic } = await admin.from("topics").select("community_id").eq("id", topicId).maybeSingle();
  if (!topic) return undefined;

  const { data: custom } = await admin.from("community_agents")
    .select("id, name, handle, role, description, capabilities, specialties, participation, status, is_active, community_id")
    .eq("id", agentId)
    .eq("community_id", topic.community_id)
    .maybeSingle();

  if (custom) {
    if (!custom.is_active || custom.status !== "AVAILABLE") return undefined;
    const { data: prompt } = await admin.from("community_agent_prompts")
      .select("system_prompt")
      .eq("agent_id", custom.id)
      .maybeSingle();
    return {
      id: custom.id,
      name: custom.name,
      handle: custom.handle,
      role: custom.role,
      description: custom.description,
      capabilities: custom.capabilities ?? [],
      specialties: custom.specialties ?? [],
      participation: custom.participation ?? "",
      permissions: ["Read accessible topic context", "Read research artifacts", "Publish specialist responses"],
      status: "AVAILABLE",
      isActive: true,
      systemPrompt: prompt?.system_prompt ?? "",
    };
  }

  return getAgent(agentId);
}
