"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { agents, type Agent } from "@/lib/agents";
import { ResearchRoom } from "@/components/research-room";

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
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");

  function showMessage(value: string, tone: "success" | "error" | "info" = "info") {
    setMessage(value);
    setMessageTone(tone);
  }
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [addingAgentId, setAddingAgentId] = useState<string | null>(null);
  const [topicParticipants, setTopicParticipants] = useState<TopicParticipant[]>([]);

  async function loadTopic(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setLoading(true);
      setMessage("");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      showMessage("Your session has expired. Please sign in again.", "error");
      setLoading(false);
      return;
    }

    const { data: topicData, error: topicError } = await supabase
      .from("topics")
      .select("id, title, body, type, created_at, created_by, community_id")
      .eq("id", params.id)
      .single();

    if (topicError || !topicData) {
      showMessage(topicError?.message ?? "Topic not found.", "error");
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
      showMessage(communityError?.message ?? "Community could not be loaded.", "error");
      setLoading(false);
      return;
    }

    if (postError) {
      showMessage(postError.message, "error");
      setLoading(false);
      return;
    }

    if (participantError) {
      showMessage(participantError.message, "error");
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
        showMessage(createParticipantError?.message ?? "Could not join this topic.", "error");
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
        showMessage(profileError.message, "error");
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

  useEffect(() => {
    if (!params.id) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`topic-posts-${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `topic_id=eq.${params.id}`,
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            void loadTopic({ silent: true });
          }, 250);
        },
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [params.id]);

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReply = reply.trim();

    if (!trimmedReply) {
      showMessage("Write a reply before posting.", "error");
      return;
    }

    if (!currentParticipantId || !topic) {
      showMessage("Your topic participation is not ready yet.", "error");
      return;
    }

    setPosting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/topics/${topic.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmedReply }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.humanPost) {
        showMessage(payload.error || "Could not publish your reply.", "error");
        return;
      }

      const participantMap = new Map(
        topicParticipants.map((participant) => [participant.id, participant]),
      );

      const incomingPosts: PostView[] = [
        {
          ...payload.humanPost,
          participant: participantMap.get(payload.humanPost.participant_id),
          profile: undefined,
          agent: undefined,
        },
        ...(payload.agentPosts ?? []).map(
          (entry: { agent: Agent; post: Post }) => ({
            ...entry.post,
            participant: participantMap.get(entry.post.participant_id),
            profile: undefined,
            agent: entry.agent,
          }),
        ),
      ];

      setPosts((current) => {
        const existingIds = new Set(current.map((post) => post.id));
        return [...current, ...incomingPosts.filter((post) => !existingIds.has(post.id))]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      setReply("");

      const failures = payload.failures ?? [];
      const warnings = payload.warnings ?? [];
      const agentCount = payload.agentPosts?.length ?? 0;
      let statusMessage: string;

      if (failures.length > 0) {
        statusMessage = agentCount
          ? `Your reply is live and the relevant AI specialists responded. Some were unavailable: ${failures.join(", ")}.`
          : `Your reply is live, but the AI specialists could not respond: ${failures.join(", ")}.`;
      } else if (agentCount > 0) {
        statusMessage = agentCount === 1
          ? `${payload.agentPosts[0].agent.name} responded automatically.`
          : `${agentCount} AI specialists responded automatically.`;
      } else if (warnings.length > 0) {
        statusMessage = "Your reply is live, but automatic AI replies could not be confirmed.";
      } else {
        statusMessage = "Your reply is live. No attached AI specialist was selected for this message.";
      }

      if (warnings.length > 0) {
        statusMessage += ` Note: ${warnings.join(" ")}`;
      }
      const statusTone = failures.length > 0 && agentCount === 0
        ? "error"
        : agentCount > 0 && failures.length === 0 && warnings.length === 0
          ? "success"
          : "info";
      showMessage(statusMessage, statusTone);
    } catch {
      showMessage("The request did not finish. Your post may already be live; refresh the topic before retrying.", "info");
    } finally {
      setPosting(false);
    }
  }

  async function handleAddAgent(agent: Agent) {
    if (!topic || addingAgentId) return;

    setAddingAgentId(agent.id);
    setMessage("");

    const alreadyAdded = topicParticipants.some(
      (participant) =>
        participant.participant_type === "AGENT" &&
        participant.agent_id === agent.id,
    );

    if (alreadyAdded) {
      showMessage(`${agent.name} is already participating in this topic.`, "info");
      setAddingAgentId(null);
      return;
    }

    const { data: createdParticipant, error } = await supabase
      .from("topic_participants")
      .insert({
        topic_id: topic.id,
        participant_type: "AGENT",
        user_id: null,
        agent_id: agent.id,
      })
      .select("id, participant_type, user_id, agent_id")
      .single();

    if (error || !createdParticipant) {
      showMessage(error?.message ?? "Could not add the AI participant.", "error");
      setAddingAgentId(null);
      return;
    }

    setTopicParticipants((current) => [...current, createdParticipant]);
    setShowAgentPicker(false);
    setAddingAgentId(null);
    try {
      const response = await fetch(`/api/topics/${topic.id}/agents/${agent.id}/run`, { method: "POST" });
      const payload = await response.json();
      if (response.ok && payload.post) {
        setPosts((current) =>
          current.some((post) => post.id === payload.post.id)
            ? current
            : [
                ...current,
                {
                  ...payload.post,
                  participant: createdParticipant,
                  profile: undefined,
                  agent,
                },
              ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        );
        showMessage(`${agent.name} joined the topic and responded automatically.`, "success");
      } else {
        showMessage(`${agent.name} joined the topic, but could not respond yet.`, "info");
      }
    } catch {
      showMessage(`${agent.name} joined the topic, but its automatic response could not be reached.`, "info");
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

          {topic.type === "RESEARCH" && currentParticipantId && (
            <ResearchRoom topicId={topic.id} participantId={currentParticipantId} />
          )}

          <section className="mt-12">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                  Conversation
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Human discussion</h2>
                <p className="mt-2 text-sm text-white/40">
                  Attached AI participants respond automatically when the discussion changes. Once they are added, their replies are published directly.
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
                      <div
                        key={agent.id}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-emerald-300/25 hover:bg-white/[0.04]"
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
                          {!participating && (
                            <button
                              type="button"
                              disabled={addingAgentId !== null}
                              onClick={() => void handleAddAgent(agent)}
                              className="rounded-lg border border-emerald-300/20 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-40"
                            >
                              {addingAgentId === agent.id ? "Adding…" : "Add to topic"}
                            </button>
                          )}
                          {participating && (
                            <span className="text-xs text-emerald-200/70">Participating</span>
                          )}
                          {participating && (
                            <span className="text-xs text-emerald-200/70">
                              Automatic replies on
                            </span>
                          )}
                        </div>
                      </div>
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
                <p className={`mt-3 text-sm ${messageTone === "error" ? "text-red-200" : messageTone === "success" ? "text-emerald-200" : "text-white/60"}`}>{message}</p>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={posting || !reply.trim()}
                  className="rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-[#07110f] hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {posting ? "Posting & getting AI replies…" : "Post reply"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
