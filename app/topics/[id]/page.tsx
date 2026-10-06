"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { agents, type Agent } from "@/lib/agents";

type Topic = {
  id: string;
  title: string;
  body: string;
  type: "DISCUSSION" | "RESEARCH";
  created_at: string;
  created_by: string;
  community_id: string;
};

type Community = {
  id: string;
  name: string;
  slug: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type TopicParticipant = {
  id: string;
  participant_type: "HUMAN" | "AGENT";
  user_id: string | null;
  agent_id: string | null;
};

type Post = {
  id: string;
  topic_id: string;
  participant_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type PostView = Post & {
  participant: TopicParticipant | undefined;
  profile: Profile | undefined;
  agent: Agent | undefined;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initials(profile?: Profile) {
  const value = profile?.display_name || profile?.username || "U";
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TopicPage() {
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [addingAgentId, setAddingAgentId] = useState<string | null>(null);
  const [topicParticipants, setTopicParticipants] = useState<TopicParticipant[]>([]);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  async function loadTopic() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Your session has expired. Please sign in again.");
      setLoading(false);
      return;
    }

    const { data: topicData, error: topicError } = await supabase
      .from("topics")
      .select("id, title, body, type, created_at, created_by, community_id")
      .eq("id", params.id)
      .single();

    if (topicError || !topicData) {
      setMessage(topicError?.message ?? "Topic not found.");
      setLoading(false);
      return;
    }

    setTopic(topicData);

    const [
      { data: communityData, error: communityError },
      { data: postData, error: postError },
      { data: participantData, error: participantError },
    ] = await Promise.all([
      supabase
        .from("communities")
        .select("id, name, slug")
        .eq("id", topicData.community_id)
        .single(),
      supabase
        .from("posts")
        .select("id, topic_id, participant_id, body, created_at, updated_at")
        .eq("topic_id", topicData.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("topic_participants")
        .select("id, participant_type, user_id, agent_id")
        .eq("topic_id", topicData.id),
    ]);

    if (communityError || !communityData) {
      setMessage(communityError?.message ?? "Community could not be loaded.");
      setLoading(false);
      return;
    }

    if (postError) {
      setMessage(postError.message);
      setLoading(false);
      return;
    }

    if (participantError) {
      setMessage(participantError.message);
      setLoading(false);
      return;
    }

    setCommunity(communityData);

    let participants = participantData ?? [];
    let ownParticipant = participants.find(
      (participant) =>
        participant.participant_type === "HUMAN" && participant.user_id === user.id,
    );

    if (!ownParticipant) {
      const { data: createdParticipant, error: createParticipantError } = await supabase
        .from("topic_participants")
        .insert({
          topic_id: topicData.id,
          participant_type: "HUMAN",
          user_id: user.id,
          agent_id: null,
        })
        .select("id, participant_type, user_id, agent_id")
        .single();

      if (createParticipantError || !createdParticipant) {
        setMessage(createParticipantError?.message ?? "Could not join this topic.");
        setLoading(false);
        return;
      }

      ownParticipant = createdParticipant;
      participants = [...participants, createdParticipant];
    }

    setCurrentParticipantId(ownParticipant.id);
    setTopicParticipants(participants);

    const userIds = Array.from(
      new Set(
        participants
          .filter((participant) => participant.participant_type === "HUMAN" && participant.user_id)
          .map((participant) => participant.user_id as string),
      ),
    );

    let profileMap = new Map<string, Profile>();

    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      profileMap = new Map((profileData ?? []).map((profile) => [profile.id, profile]));
    }

    const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

    setPosts(
      (postData ?? []).map((post) => {
        const participant = participantMap.get(post.participant_id);

        return {
          ...post,
          participant,
          profile: participant?.user_id ? profileMap.get(participant.user_id) : undefined,
          agent: participant?.agent_id ? agentMap.get(participant.agent_id) : undefined,
        };
      }),
    );

    setLoading(false);
  }

  useEffect(() => {
    if (params.id) {
      void loadTopic();
    }
  }, [params.id]);

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReply = reply.trim();

    if (!trimmedReply) {
      setMessage("Write a reply before posting.");
      return;
    }

    if (!currentParticipantId || !topic) {
      setMessage("Your topic participation is not ready yet.");
      return;
    }

    setPosting(true);
    setMessage("");

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        topic_id: topic.id,
        participant_id: currentParticipantId,
        body: trimmedReply,
      })
      .select("id, topic_id, participant_id, body, created_at, updated_at")
      .single();

    if (error || !post) {
      setMessage(error?.message ?? "Could not publish your reply.");
      setPosting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", user.id)
          .single()
      : { data: undefined };

    setPosts((current) => [
      ...current,
      {
        ...post,
        participant: {
          id: currentParticipantId,
          participant_type: "HUMAN",
          user_id: user?.id ?? null,
          agent_id: null,
        },
        profile: profile ?? undefined,
        agent: undefined,
      },
    ]);

    setReply("");
    setPosting(false);
  }

  async function handleAddAgent(agent: Agent) {
    if (!topic || addingAgentId) return;

    setAddingAgentId(agent.id);
    setMessage("");

    const alreadyAdded = topicParticipants.some(
      (post) =>
        post.participant?.participant_type === "AGENT" &&
        post.participant.agent_id === agent.id,
    );

    if (alreadyAdded) {
      setMessage(`${agent.name} is already participating in this topic.`);
      setAddingAgentId(null);
      return;
    }

    const { error } = await supabase.from("topic_participants").insert({
      topic_id: topic.id,
      participant_type: "AGENT",
      user_id: null,
      agent_id: agent.id,
    });

    if (error) {
      setMessage(error.message);
      setAddingAgentId(null);
      return;
    }

    setShowAgentPicker(false);
    setAddingAgentId(null);
    await loadTopic();
  }

  async function handleRunAgent(agent: Agent) {
    if (!topic || runningAgentId) return;

    setRunningAgentId(agent.id);
    setMessage("");

    try {
      const response = await fetch(`/api/topics/${topic.id}/agents/${agent.id}/run`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || "Agent execution failed.");
        return;
      }

      setShowAgentPicker(false);
      await loadTopic();
      setMessage(`${agent.name} responded using ${payload.provider}.`);
    } catch {
      setMessage("The agent runtime could not be reached.");
    } finally {
      setRunningAgentId(null);
    }
  }

  const participantCount = useMemo(() => {
    return new Set(topicParticipants.map((participant) => participant.id)).size;
  }, [topicParticipants]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07110f] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-white/50">Loading topic…</p>
        </div>
      </main>
    );
  }

  if (!topic || !community) {
    return (
      <main className="min-h-screen bg-[#07110f] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <Link href="/communities" className="text-sm text-emerald-300 hover:text-emerald-200">
            ← Back to communities
          </Link>
          <div className="mt-10 rounded-2xl border border-red-300/15 bg-red-300/[0.04] p-8">
            <h1 className="text-2xl font-semibold">Topic unavailable</h1>
            <p className="mt-2 text-white/50">{message || "We could not load this topic."}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6 lg:px-10">

        <div className="py-7">
          <Link
            href={`/communities/${community.slug}`}
            className="text-sm text-emerald-300 hover:text-emerald-200"
          >
            ← {community.name}
          </Link>

          <article className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
                {topic.type === "RESEARCH" ? "Research" : "Discussion"}
              </span>
              <span className="text-xs text-white/35">
                {formatDate(topic.created_at)}
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              {topic.title}
            </h1>

            <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-white/70">
              {topic.body}
            </div>

            <div className="mt-7 flex flex-wrap gap-5 border-t border-white/10 pt-5 text-sm text-white/40">
              <span>{posts.length} {posts.length === 1 ? "reply" : "replies"}</span>
              <span>{participantCount} {participantCount === 1 ? "participant" : "participants"}</span>
            </div>
          </article>

          <section className="mt-12">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                  Conversation
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Human discussion</h2>
                <p className="mt-2 text-sm text-white/40">
                  Humans can discuss the question now. Specialized AI participants will join this same conversation next.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAgentPicker((open) => !open)}
                className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.04] px-4 py-2.5 text-sm font-medium text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
              >
                + Add agent
              </button>
            </div>

            {showAgentPicker && (
              <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.025] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Add a specialist</h3>
                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Add a platform-level AI participant to this topic. This does not create a human account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAgentPicker(false)}
                    className="text-sm text-white/35 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {agents.map((agent) => {
                    const participating = topicParticipants.some(
                      (participant) =>
                        participant.participant_type === "AGENT" &&
                        participant.agent_id === agent.id,
                    );

                    return (
                      <button
                        key={agent.id}
                        type="button"
                        disabled={participating || addingAgentId !== null}
                        onClick={() => void handleAddAgent(agent)}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-emerald-300/25 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-sm font-semibold text-emerald-300">
                            {agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-xs text-white/35">{agent.handle}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/45">{agent.role}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <span className="text-xs text-emerald-200/70">
                            {participating ? "Participating" : addingAgentId === agent.id ? "Adding…" : "Add to topic"}
                          </span>
                          {participating && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRunAgent(agent);
                              }}
                              disabled={runningAgentId !== null}
                              className="rounded-lg border border-emerald-300/20 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-40"
                            >
                              {runningAgentId === agent.id ? "Running…" : "Ask agent"}
                            </button>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
                  <div className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-300/10 text-emerald-300">
                    1
                  </div>
                  <h3 className="mt-4 font-semibold">Be the first to reply</h3>
                  <p className="mt-2 text-sm leading-6 text-white/40">
                    Start the conversation. Your reply becomes the first discussion artifact attached to this topic.
                  </p>
                </div>
              ) : (
                posts.map((post, index) => (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:p-6"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-300/10 text-sm font-semibold text-emerald-200">
                        {post.profile?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.profile.avatar_url}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          initials(post.profile)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">
                            {post.agent?.name ||
                              post.profile?.display_name ||
                              post.profile?.username ||
                              "Converge member"}
                          </span>
                          <span className="text-xs text-white/30">
                            {post.participant?.participant_type === "AGENT" ? "AI agent" : "Human"}
                          </span>
                          <span className="text-xs text-white/30">·</span>
                          <span className="text-xs text-white/35">
                            {formatDate(post.created_at)}
                          </span>
                          {index === 0 && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/35">
                              First reply
                            </span>
                          )}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/65">
                          {post.body}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <form
              onSubmit={handleReply}
              className="mt-8 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.025] p-5 sm:p-6"
            >
              <div>
                <h3 className="font-semibold">Add to the discussion</h3>
                <p className="mt-1 text-sm text-white/40">
                  Your reply will be posted under your human profile.
                </p>
              </div>

              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                rows={5}
                placeholder="Share your perspective, evidence, question, or counterargument…"
                className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-[#07110f] px-4 py-3 text-sm leading-7 outline-none placeholder:text-white/25 focus:border-emerald-300/50"
              />

              {message && (
                <p className="mt-3 text-sm text-red-200">{message}</p>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={posting || !reply.trim()}
                  className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-[#07110f] hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {posting ? "Posting…" : "Post reply"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
