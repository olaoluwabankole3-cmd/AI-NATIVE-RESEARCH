"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type Topic = {
  id: string;
  title: string;
  body: string;
  type: "DISCUSSION" | "RESEARCH";
  created_at: string;
};

export default function CommunityPage() {
  const params = useParams<{ slug: string }>();
  const supabase = createClient();

  const [community, setCommunity] = useState<Community | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"DISCUSSION" | "RESEARCH">("DISCUSSION");
  const [message, setMessage] = useState("");

  async function loadCommunity() {
    setLoading(true);
    setMessage("");

    const { data: communityData, error: communityError } = await supabase
      .from("communities")
      .select("id, name, slug, description")
      .eq("slug", params.slug)
      .single();

    if (communityError || !communityData) {
      setMessage(communityError?.message ?? "Community not found.");
      setLoading(false);
      return;
    }

    setCommunity(communityData);

    const [{ data: topicData, error: topicError }, { count, error: memberError }] =
      await Promise.all([
        supabase
          .from("topics")
          .select("id, title, body, type, created_at")
          .eq("community_id", communityData.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("community_members")
          .select("id", { count: "exact", head: true })
          .eq("community_id", communityData.id),
      ]);

    if (topicError) {
      setMessage(topicError.message);
    } else {
      setTopics(topicData ?? []);
    }

    if (!memberError) {
      setMemberCount(count ?? 0);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (params.slug) {
      void loadCommunity();
    }
  }, [params.slug]);

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!community) return;

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setMessage("Topic title is required.");
      return;
    }

    if (!trimmedBody) {
      setMessage("Add an opening question or description for the topic.");
      return;
    }

    setCreating(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Your session has expired. Please sign in again.");
      setCreating(false);
      return;
    }

    const { data: topic, error } = await supabase
      .from("topics")
      .insert({
        community_id: community.id,
        title: trimmedTitle,
        body: trimmedBody,
        type,
        created_by: user.id,
      })
      .select("id, title, body, type, created_at")
      .single();

    if (error) {
      setMessage(error.message);
      setCreating(false);
      return;
    }

    setTopics((current) => [topic, ...current]);
    setTitle("");
    setBody("");
    setType("DISCUSSION");
    setShowForm(false);
    setMessage("Topic created.");
    setCreating(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07110f] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-white/50">Loading community…</p>
        </div>
      </main>
    );
  }

  if (!community) {
    return (
      <main className="min-h-screen bg-[#07110f] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/communities" className="text-sm text-emerald-300 hover:text-emerald-200">
            ← Back to communities
          </Link>
          <div className="mt-10 rounded-2xl border border-red-300/15 bg-red-300/[0.04] p-8">
            <h1 className="text-2xl font-semibold">Community not found</h1>
            <p className="mt-2 text-white/50">{message}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <SiteHeader />

        <section className="border-b border-white/10 py-10 sm:py-12">
          <Link href="/communities" className="text-sm text-emerald-300 hover:text-emerald-200">
            ← Communities
          </Link>
          <div className="mt-7 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="grid size-14 place-items-center rounded-2xl bg-emerald-300/10 text-2xl font-semibold text-emerald-300">
                {community.name.charAt(0).toUpperCase()}
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">{community.name}</h1>
              <p className="mt-4 max-w-2xl leading-7 text-white/55">
                {community.description ?? "A Converge community for thoughtful discussion and research."}
              </p>
              <div className="mt-5 flex gap-5 text-sm text-white/40">
                <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                <span>{topics.length} {topics.length === 1 ? "topic" : "topics"}</span>
              </div>
            </div>
            <button
              onClick={() => { setShowForm((value) => !value); setMessage(""); }}
              className="w-full rounded-xl bg-emerald-300 px-5 py-3 sm:w-auto text-sm font-semibold text-[#07110f] hover:bg-emerald-200"
            >
              {showForm ? "Cancel" : "Create topic"}
            </button>
          </div>
        </section>

        {showForm && (
          <form onSubmit={handleCreateTopic} className="mt-8 rounded-2xl border border-emerald-300/15 bg-white/[0.025] p-6">
            <h2 className="text-xl font-semibold">Start a topic</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Give the discussion enough context for humans and future AI participants to understand the question.
            </p>
            <div className="mt-5 grid gap-4">
              <label>
                <span className="mb-2 block text-sm text-white/70">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  placeholder="What do you want the community to discuss?"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-emerald-300/60"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm text-white/70">Opening question or description</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                  rows={5}
                  placeholder="Explain the question, context, or problem you want the community to explore."
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 leading-6 outline-none focus:border-emerald-300/60"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm text-white/70">Topic type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as "DISCUSSION" | "RESEARCH")}
                  className="rounded-xl border border-white/10 bg-[#0b1714] px-4 py-3 outline-none focus:border-emerald-300/60"
                >
                  <option value="DISCUSSION">Discussion</option>
                  <option value="RESEARCH">Research</option>
                </select>
              </label>
              {message && <p className="text-sm text-red-200">{message}</p>}
              <button
                disabled={creating}
                className="w-fit rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-[#07110f] disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create topic"}
              </button>
            </div>
          </form>
        )}

        {message && !showForm && <p className="mt-6 text-sm text-emerald-200">{message}</p>}

        <section className="py-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Community discussion</p>
              <h2 className="mt-2 text-2xl font-semibold">Topics</h2>
            </div>
          </div>

          {topics.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <h3 className="text-xl font-semibold">No topics yet</h3>
              <p className="mt-2 text-white/45">Start the first discussion or research question.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.id}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/25 hover:bg-white/[0.04] hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">{topic.title}</h3>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/45">
                      {topic.type === "RESEARCH" ? "Research" : "Discussion"}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/45">{topic.body}</p>
                  <p className="mt-3 text-sm text-white/35">
                    {new Date(topic.created_at).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
