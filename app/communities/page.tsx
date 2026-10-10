"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  community_id: string;
};
type TopicWithCommunity = Topic & { community: Community | undefined };
type FeedFilter = "LATEST" | "ACTIVE" | "RESEARCH" | "DISCUSSION";

function relativeDate(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export default function CommunitiesPage() {
  const supabase = createClient();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [topics, setTopics] = useState<TopicWithCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FeedFilter>("LATEST");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  async function loadWorkspace() {
    setLoading(true);
    const [{ data: communityData, error: communityError }, { data: topicData, error: topicError }] = await Promise.all([
      supabase.from("communities").select("id, name, slug, description").order("created_at", { ascending: false }),
      supabase.from("topics").select("id, title, body, type, created_at, community_id").order("created_at", { ascending: false }).limit(40),
    ]);
    if (communityError) {
      setMessage(communityError.message);
      setMessageTone("error");
    } else {
      const communityList = communityData ?? [];
      setCommunities(communityList);
      if (topicError) {
        setMessage(topicError.message);
        setMessageTone("error");
        setTopics([]);
      } else {
        const communityMap = new Map(communityList.map((community) => [community.id, community]));
        setTopics((topicData ?? []).map((topic) => ({ ...topic, type: topic.type as Topic["type"], community: communityMap.get(topic.community_id) })));
      }
    }
    setLoading(false);
  }

  useEffect(() => { void loadWorkspace(); }, []);

  const filteredCommunities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return communities.filter((community) => !query || [community.name, community.description ?? ""].some((value) => value.toLowerCase().includes(query)));
  }, [communities, search]);

  const filteredTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    return topics.filter((topic) => {
      const matchesFilter = filter === "LATEST" || (filter === "RESEARCH" ? topic.type === "RESEARCH" : filter === "DISCUSSION" ? topic.type === "DISCUSSION" : true);
      const matchesSearch = !query || [topic.title, topic.body, topic.community?.name ?? ""].some((value) => value.toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [topics, search, filter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setMessage("Community name is required."); setMessageTone("error"); setCreating(false); return;
    }
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug) {
      setMessage("Choose a community name containing letters or numbers."); setMessageTone("error"); setCreating(false); return;
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage("Your session has expired. Please sign in again."); setMessageTone("error"); setCreating(false); return;
    }
    const { data: community, error: communityError } = await supabase.from("communities")
      .insert({ name: trimmedName, slug, description: trimmedDescription || null, created_by: user.id })
      .select("id, name, slug, description").single();
    if (communityError) {
      setMessage(communityError.message); setMessageTone("error"); setCreating(false); return;
    }
    const { error: membershipError } = await supabase.from("community_members").insert({ community_id: community.id, user_id: user.id, role: "OWNER" });
    if (membershipError) {
      setMessage(membershipError.message); setMessageTone("error"); setCreating(false); return;
    }
    setCommunities((current) => [community, ...current]);
    setName(""); setDescription(""); setShowForm(false);
    setMessage("Community created. Start a topic to open the conversation."); setMessageTone("success"); setCreating(false);
  }

  const filters: { id: FeedFilter; label: string }[] = [
    { id: "LATEST", label: "Latest" }, { id: "RESEARCH", label: "Research" }, { id: "DISCUSSION", label: "Discussions" },
  ];

  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-7 lg:px-10">
        <div className="flex flex-col gap-2 border-b border-white/[0.09] py-7 sm:py-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Community</p>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">The conversation space</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Questions, research, and ideas in progress — shaped by people and specialist AI perspectives.</p>
            </div>
            <button type="button" onClick={() => { setShowForm((value) => !value); setMessage(""); }} className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710] transition hover:bg-emerald-100">
              <span className="text-lg leading-none">{showForm ? "×" : "+"}</span>{showForm ? "Close form" : "New community"}
            </button>
          </div>
        </div>

        {showForm && <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-emerald-200/20 bg-[#111a16] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Create a community</h2>
          <p className="mt-1 text-sm text-white/45">Define a shared area of interest, inquiry, or work.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-xs font-medium text-white/65">Community name</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} placeholder="e.g. AI Safety Research" className="w-full rounded-lg border border-white/10 bg-[#0b1110] px-3.5 py-3 text-sm outline-none focus:border-emerald-200/50" /></label>
            <label className="block"><span className="mb-2 block text-xs font-medium text-white/65">Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} placeholder="What should people explore here?" className="w-full resize-y rounded-lg border border-white/10 bg-[#0b1110] px-3.5 py-3 text-sm outline-none focus:border-emerald-200/50" /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3"><button disabled={creating} className="rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710] disabled:opacity-50">{creating ? "Creating…" : "Create community"}</button><button type="button" onClick={() => setShowForm(false)} className="px-3 py-2.5 text-sm text-white/50 hover:text-white">Cancel</button></div>
        </form>}

        {message && <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100"}`}>{message}</p>}

        <div className="grid gap-7 pt-6 lg:grid-cols-[220px_minmax(0,1fr)_270px] lg:gap-8">
          <aside className="space-y-6">
            <section className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4">
              <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">Your spaces</h2><span className="text-xs tabular-nums text-white/35">{communities.length}</span></div>
              <label className="mt-4 block"><span className="sr-only">Search communities and topics</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search everything…" className="w-full rounded-lg border border-white/10 bg-black/15 px-3 py-2.5 text-xs outline-none placeholder:text-white/25 focus:border-emerald-200/40" /></label>
              <div className="mt-3 space-y-1">
                {loading ? <p className="px-2 py-3 text-xs text-white/35">Loading spaces…</p> : filteredCommunities.slice(0, 8).map((community) => <Link key={community.id} href={`/communities/${community.slug}`} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white/65 transition hover:bg-white/[0.045] hover:text-emerald-100"><span className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-200/10 text-[10px] font-semibold text-emerald-200">{community.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1 truncate">{community.name}</span></Link>)}
                {!loading && filteredCommunities.length === 0 && <p className="px-2 py-3 text-xs text-white/35">{search ? "No spaces match this search." : "No communities yet."}</p>}
                {communities.length > 8 && <Link href="#communities-directory" className="mt-1 block px-2 py-2 text-xs font-medium text-emerald-200 hover:text-white">Browse all communities →</Link>}
              </div>
            </section>
            <section className="rounded-xl border border-white/[0.09] p-4">
              <p className="text-xs font-semibold text-white/70">Built for shared inquiry</p>
              <p className="mt-2 text-xs leading-5 text-white/40">Keep discussions open, make evidence visible, and challenge ideas constructively.</p>
              <Link href="/agents" className="mt-4 inline-flex text-xs font-semibold text-emerald-200 hover:text-white">Meet the AI specialists →</Link>
            </section>
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.09] pb-4">
              <div><h2 className="text-lg font-semibold tracking-tight">Topics</h2><p className="mt-1 text-xs text-white/35">{loading ? "Loading activity…" : `${filteredTopics.length} topics shown`}</p></div>
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">{filters.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${filter === item.id ? "bg-emerald-200 text-[#0b1710]" : "text-white/50 hover:text-white"}`}>{item.label}</button>)}</div>
            </div>

            {loading ? <div className="divide-y divide-white/[0.07]">{[0,1,2,3].map((item) => <div key={item} className="animate-pulse py-6"><div className="h-4 w-2/3 rounded bg-white/[0.06]" /><div className="mt-3 h-3 w-full rounded bg-white/[0.035]" /><div className="mt-2 h-3 w-1/3 rounded bg-white/[0.035]" /></div>)}</div>
            : filteredTopics.length === 0 ? <div className="my-5 rounded-xl border border-dashed border-white/15 px-5 py-12 text-center"><span className="text-2xl text-emerald-200">↗</span><h3 className="mt-3 text-base font-semibold">{search ? "No matching topics" : filter === "RESEARCH" ? "No research topics yet" : filter === "DISCUSSION" ? "No discussions yet" : "The next good question starts here"}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">{search ? "Try another search term or clear your search." : "Open a community and start a topic. A clear question gives others something useful to build on."}</p>{search ? <button onClick={() => setSearch("")} className="mt-4 text-xs font-semibold text-emerald-200">Clear search</button> : <Link href={communities[0] ? `/communities/${communities[0].slug}` : "#communities-directory"} className="mt-4 inline-block text-xs font-semibold text-emerald-200 hover:text-white">{communities[0] ? "Start a topic in a community →" : "Create a community above →"}</Link>}</div>
            : <div className="divide-y divide-white/[0.085]">{filteredTopics.map((topic) => <article key={topic.id} className="group py-5 sm:py-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border text-xs font-bold ${topic.type === "RESEARCH" ? "border-sky-300/20 bg-sky-300/[0.07] text-sky-200" : "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-200"}`}>{topic.type === "RESEARCH" ? "R" : "D"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]"><span className={topic.type === "RESEARCH" ? "text-sky-200/80" : "text-emerald-200/80"}>{topic.type === "RESEARCH" ? "Research" : "Discussion"}</span>{topic.community && <><span className="text-white/20">/</span><Link href={`/communities/${topic.community.slug}`} className="max-w-[200px] truncate text-white/45 hover:text-emerald-100">{topic.community.name}</Link></>}<span className="text-white/25">· {relativeDate(topic.created_at)}</span></div>
                  <Link href={`/topics/${topic.id}`} className="mt-2 block text-base font-semibold leading-6 tracking-[-0.015em] text-white/90 transition group-hover:text-emerald-100 sm:text-lg">{topic.title}</Link>
                  <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm leading-6 text-white/45">{topic.body}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-white/30"><span>Open topic</span><span>·</span><span>Join the conversation <span className="text-emerald-200/70">↗</span></span></div>
                </div>
              </div>
            </article>)}</div>}
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border border-emerald-200/15 bg-emerald-200/[0.035] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-200/75">How Converge works</p>
              <h2 className="mt-3 text-lg font-semibold leading-snug">Better thinking is a team sport.</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">Bring a question, share what you know, and invite specialist AI perspectives when they add value.</p>
              <Link href="/agents" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 hover:text-white">Explore AI registry <span>→</span></Link>
            </section>
            <section className="rounded-xl border border-white/[0.09] p-5">
              <h2 className="text-sm font-semibold">Start with a question</h2>
              <ol className="mt-4 space-y-3 text-xs leading-5 text-white/45"><li className="flex gap-3"><span className="text-emerald-200">01</span><span>Find a community working on a related idea.</span></li><li className="flex gap-3"><span className="text-emerald-200">02</span><span>Open a discussion or frame a research question.</span></li><li className="flex gap-3"><span className="text-emerald-200">03</span><span>Compare perspectives and keep useful evidence in view.</span></li></ol>
            </section>
            <div className="rounded-xl border border-white/[0.07] p-4"><p className="text-xs leading-5 text-white/35">Activity is drawn from topics currently available to your account. New conversations appear here as communities grow.</p></div>
          </aside>
        </div>

        <section id="communities-directory" className="mt-12 border-t border-white/[0.09] pt-7">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/70">Explore</p><h2 className="mt-2 text-xl font-semibold">Community directory</h2></div><span className="text-xs text-white/35">{filteredCommunities.length} spaces</span></div>
          {filteredCommunities.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredCommunities.map((community) => <Link key={community.id} href={`/communities/${community.slug}`} className="rounded-lg border border-white/[0.09] bg-white/[0.015] p-4 transition hover:border-emerald-200/25 hover:bg-white/[0.03]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-emerald-200/10 text-xs font-semibold text-emerald-200">{community.name.charAt(0).toUpperCase()}</span><h3 className="text-sm font-semibold">{community.name}</h3></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-white/40">{community.description || "A shared space for discussion and research."}</p><p className="mt-3 text-[10px] font-semibold text-emerald-200/70">Open community →</p></Link>)}</div> : <p className="mt-4 text-sm text-white/40">No communities found.</p>}
        </section>
      </div>
    </main>
  );
}
