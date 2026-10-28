"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  created_by: string;
  members_can_create_topics: boolean;
};
type Topic = { id: string; title: string; body: string; type: "DISCUSSION" | "RESEARCH"; created_at: string };
type TopicFilter = "ALL" | "RESEARCH" | "DISCUSSION";
type JoinRequest = { id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; message?: string | null };

function relativeDate(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export default function CommunityPage() {
  const params = useParams<{ slug: string }>();
  const supabase = createClient();
  const [community, setCommunity] = useState<Community | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"DISCUSSION" | "RESEARCH">("DISCUSSION");
  const [filter, setFilter] = useState<TopicFilter>("ALL");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const isOwner = Boolean(community && userId && community.created_by === userId);
  const currentIsMember = isOwner || isMember;
  const canCreateTopic = Boolean(isOwner || (isMember && community?.members_can_create_topics));
  const privateLocked = Boolean(community?.visibility === "PRIVATE" && !currentIsMember);

  async function loadCommunity() {
    setLoading(true);
    setMessage("");
    setJoinRequest(null);
    setPendingRequestCount(0);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setCommunity(null);
      setMessage("Sign in to view this community.");
      setMessageTone("error");
      setLoading(false);
      return;
    }

    const { data: communityData, error: communityError } = await supabase.from("communities")
      .select("id, name, slug, description, visibility, created_by, members_can_create_topics")
      .eq("slug", params.slug).maybeSingle();

    if (communityError || !communityData) {
      setCommunity(null);
      setMessage("This community could not be found or is unavailable.");
      setMessageTone("error");
      setLoading(false);
      return;
    }

    const [{ data: membership, error: membershipError }, requestResponse] = await Promise.all([
      supabase.from("community_members").select("user_id")
        .eq("community_id", communityData.id).eq("user_id", user.id).maybeSingle(),
      fetch("/api/communities/" + communityData.id + "/requests", { cache: "no-store" }),
    ]);
    if (membershipError) {
      setMessage("We could not verify your community membership. Refresh and try again.");
      setMessageTone("error");
      setLoading(false);
      return;
    }

    const owner = communityData.created_by === user.id;
    const member = owner || Boolean(membership);
    const accessCommunity = communityData as Community;
    setCommunity(accessCommunity);
    setIsMember(member);

    const requestPayload = await requestResponse.json().catch(() => null);
    if (requestResponse.ok) {
      const requests = Array.isArray(requestPayload?.requests) ? requestPayload.requests as JoinRequest[] : [];
      if (owner) setPendingRequestCount(requests.filter((item) => item.status === "PENDING").length);
      else setJoinRequest(requests[0] ?? null);
    }

    setTopics([]);
    if (communityData.visibility === "PUBLIC" || member) {
      const [{ data: topicData, error: topicError }, memberResult] = await Promise.all([
        supabase.from("topics").select("id, title, body, type, created_at")
          .eq("community_id", communityData.id).order("created_at", { ascending: false }),
        (communityData.visibility === "PUBLIC" || owner)
          ? supabase.from("community_members").select("user_id", { count: "exact", head: true }).eq("community_id", communityData.id)
          : Promise.resolve({ count: null, error: null }),
      ]);
      if (topicError) {
        setMessage("Topics could not be loaded. Please refresh and try again.");
        setMessageTone("error");
      } else {
        setTopics((topicData ?? []).map((topic) => ({ ...topic, type: topic.type as Topic["type"] })));
      }
      if (!memberResult.error && memberResult.count !== null) setMemberCount(memberResult.count ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => { if (params.slug) void loadCommunity(); }, [params.slug]);

  const visibleTopics = useMemo(() => {
    const query = search.trim().toLowerCase();
    return topics.filter((topic) => {
      const matchesType = filter === "ALL" || topic.type === filter;
      const matchesSearch = !query || [topic.title, topic.body].some((value) => value.toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  }, [topics, filter, search]);

  async function handleJoinPublic() {
    if (!community || !userId || joining || community.visibility !== "PUBLIC") return;
    setJoining(true);
    setMessage("");
    const { error } = await supabase.from("community_members").insert({
      community_id: community.id, user_id: userId, role: "MEMBER",
    });
    if (error && error.code !== "23505") {
      setMessage("Could not join this community. Please try again.");
      setMessageTone("error");
      setJoining(false);
      return;
    }
    setIsMember(true);
    setMessage("You have joined the community. You can now participate in its research.");
    setMessageTone("success");
    await loadCommunity();
    setJoining(false);
  }

  async function handleRequestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || requesting) return;
    setRequesting(true);
    setMessage("");
    try {
      const response = await fetch("/api/communities/" + community.id + "/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: requestMessage.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Could not submit your access request.");
      setJoinRequest(payload.request);
      setShowRequestForm(false);
      setRequestMessage("");
      setMessage("Your request has been sent to the community owner.");
      setMessageTone("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit your access request.");
      setMessageTone("error");
    } finally {
      setRequesting(false);
    }
  }

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || !canCreateTopic) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setMessage("Add a title and an opening question or description.");
      setMessageTone("error");
      return;
    }
    setCreating(true);
    setMessage("");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage("Your session has expired. Please sign in again.");
      setMessageTone("error");
      setCreating(false);
      return;
    }
    const { data: topic, error } = await supabase.from("topics").insert({
      community_id: community.id, title: trimmedTitle, body: trimmedBody, type, created_by: user.id,
    }).select("id, title, body, type, created_at").single();
    if (error) {
      setMessage(error.message.includes("row-level security")
        ? "Topic creation is disabled for members of this community."
        : "The topic could not be published. Please try again.");
      setMessageTone("error");
      setCreating(false);
      return;
    }
    setTopics((current) => [topic as Topic, ...current]);
    setTitle("");
    setBody("");
    setType("DISCUSSION");
    setShowForm(false);
    setMessage("Topic created. Your conversation is now open.");
    setMessageTone("success");
    setCreating(false);
    setFilter("ALL");
  }

  if (loading) {
    return <main className="converge-app-page min-h-screen bg-[#0b1110] px-6 py-10 text-white"><SiteHeader /><div className="mx-auto max-w-5xl py-12 text-sm text-white/45">Loading community…</div></main>;
  }

  if (!community) {
    return <main className="converge-app-page min-h-screen bg-[#0b1110] px-6 py-10 text-white"><SiteHeader /><div className="mx-auto max-w-3xl py-12"><Link href="/communities" className="text-sm text-emerald-200">← All communities</Link><h1 className="mt-6 text-3xl font-semibold">Community unavailable</h1><p className="mt-3 text-sm text-white/50">{message || "This community could not be loaded."}</p></div></main>;
  }

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-7 lg:px-10">
        <div className="border-b border-white/[0.09] py-5"><Link href="/communities" className="inline-flex items-center gap-2 text-xs font-medium text-white/45 transition hover:text-emerald-200">← All communities</Link></div>

        <section className="converge-page-intro border-b border-white/[0.09] py-8 sm:py-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-lg font-semibold text-emerald-200">{community.name.charAt(0).toUpperCase()}</span>
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Community</p><p className="mt-1 text-xs text-white/35">A shared space on Converge</p></div>
                <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] " + (community.visibility === "PRIVATE" ? "border-amber-200/20 bg-amber-200/[0.06] text-amber-100/75" : "border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100/75")}>{community.visibility === "PRIVATE" ? "▣ Private" : "◉ Public"}</span>
              </div>
              <h1 className="mt-5 break-words text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{community.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">{community.description || "A shared space for thoughtful discussion, evidence, and research."}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/40">
                {(community.visibility === "PUBLIC" || isOwner) && <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>}
                <span className="text-white/20">·</span>
                <span>{privateLocked ? "Topics hidden until your request is approved" : topics.length + (topics.length === 1 ? " topic" : " topics")}</span>
                {isOwner && <><span className="text-white/20">·</span><span className="text-emerald-200/70">You own this community</span></>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOwner && <Link href={"/communities/" + community.slug + "/settings"} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-white/75 transition hover:border-emerald-200/30 hover:text-emerald-100">Community settings{pendingRequestCount > 0 ? " · " + pendingRequestCount + " pending" : ""}</Link>}
              {!currentIsMember && community.visibility === "PUBLIC" && <button type="button" disabled={joining} onClick={() => void handleJoinPublic()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-50">{joining ? "Joining…" : "Join community"}</button>}
              {privateLocked && joinRequest?.status !== "PENDING" && <button type="button" onClick={() => setShowRequestForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710] transition hover:bg-emerald-100">{showRequestForm ? "Cancel request" : "Request access"}</button>}
              {canCreateTopic && <button type="button" onClick={() => { setShowForm((value) => !value); setMessage(""); }} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200/25 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-200/10"><span className="text-lg leading-none">{showForm ? "×" : "+"}</span>{showForm ? "Cancel topic" : "Create topic"}</button>}
            </div>
          </div>
        </section>

        {message && <p role="status" className={"mt-4 rounded-lg border px-4 py-3 text-sm " + (messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100")}>{message}</p>}

        {showRequestForm && privateLocked && <form onSubmit={handleRequestAccess} className="mt-6 max-w-2xl rounded-xl border border-emerald-200/20 bg-[#111a16] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Request to join {community.name}</h2>
          <p className="mt-2 text-sm leading-6 text-white/45">The community owner will review your request. You will not see topics or discussions until access is approved.</p>
          <label className="mt-4 block"><span className="mb-2 block text-xs font-medium text-white/65">Note to the owner (optional)</span><textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} rows={3} maxLength={1000} placeholder="Briefly tell the owner why you would like to join…" className="w-full resize-y rounded-lg border border-white/10 bg-[#0b1110] px-3.5 py-3 text-sm outline-none focus:border-emerald-200/50" /></label>
          <div className="mt-4 flex gap-3"><button disabled={requesting} className="rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710] disabled:opacity-50">{requesting ? "Sending request…" : "Send access request"}</button><button type="button" onClick={() => setShowRequestForm(false)} className="px-3 py-2.5 text-sm text-white/50 hover:text-white">Cancel</button></div>
        </form>}

        {privateLocked && <section className="mt-8 max-w-3xl rounded-2xl border border-amber-200/15 bg-amber-200/[0.035] p-6 sm:p-9">
          <div className="grid size-12 place-items-center rounded-xl border border-amber-200/20 bg-amber-200/[0.06] text-xl text-amber-100/80">▣</div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/65">Private community</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">The research stays inside this community.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">You can see this community description, but its topics, discussions, replies, and saved research remain hidden until the owner approves your membership request.</p>
          {joinRequest?.status === "PENDING" ? <p className="mt-5 inline-flex items-center rounded-lg border border-amber-200/15 px-3 py-2 text-sm text-amber-100/80">Request sent · awaiting owner review</p> : joinRequest?.status === "REJECTED" ? <p className="mt-5 text-sm text-white/50">Your previous request was declined. You may submit a new request.</p> : <p className="mt-5 text-xs text-white/35">Access is granted individually by the community owner.</p>}
        </section>}

        {showForm && canCreateTopic && <form onSubmit={handleCreateTopic} className="mt-6 rounded-xl border border-emerald-200/20 bg-[#111a16] p-5 sm:p-7">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/75">New conversation</p><h2 className="mt-2 text-xl font-semibold">What should this community explore?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">A clear title and useful context help people—and relevant AI specialists—contribute meaningfully.</p></div>
          <div className="mt-5 grid gap-4">
            <label className="block"><span className="mb-2 block text-xs font-medium text-white/65">Topic title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} placeholder="Ask a question or state the problem" className="w-full rounded-lg border border-white/10 bg-[#0b1110] px-3.5 py-3 text-sm outline-none focus:border-emerald-200/50" /></label>
            <label className="block"><span className="mb-2 block text-xs font-medium text-white/65">Context and opening question</span><textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={5} maxLength={12000} placeholder="Share background, what you already know, evidence, and what you want to understand…" className="w-full resize-y rounded-lg border border-white/10 bg-[#0b1110] px-3.5 py-3 text-sm leading-6 outline-none focus:border-emerald-200/50" /></label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <label className="block"><span className="mb-2 block text-xs font-medium text-white/65">Topic type</span><select value={type} onChange={(event) => setType(event.target.value as "DISCUSSION" | "RESEARCH")} className="min-w-44 rounded-lg border border-white/10 bg-[#0b1110] px-3.5 py-3 text-sm outline-none focus:border-emerald-200/50"><option value="DISCUSSION">Discussion</option><option value="RESEARCH">Research</option></select></label>
              <button disabled={creating} className="rounded-lg bg-emerald-200 px-4 py-3 text-sm font-semibold text-[#0b1710] disabled:opacity-50">{creating ? "Publishing…" : "Publish topic"}</button>
            </div>
          </div>
        </form>}

        {!privateLocked && <div className="grid gap-8 pt-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
          <section className="min-w-0">
            <div className="flex flex-col justify-between gap-4 border-b border-white/[0.09] pb-4 sm:flex-row sm:items-end">
              <div><h2 className="text-xl font-semibold tracking-tight">Topics</h2><p className="mt-1 text-xs text-white/35">{visibleTopics.length} shown · newest first</p></div>
              <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">{([{id:"ALL",label:"All topics"},{id:"DISCUSSION",label:"Discussions"},{id:"RESEARCH",label:"Research"}] as {id:TopicFilter;label:string}[]).map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={"rounded-md px-3 py-1.5 text-xs font-medium transition " + (filter === item.id ? "bg-emerald-200 text-[#0b1710]" : "text-white/50 hover:text-white")}>{item.label}</button>)}</div>
            </div>
            {!currentIsMember && community.visibility === "PUBLIC" && <div className="mt-4 rounded-lg border border-emerald-200/15 bg-emerald-200/[0.035] px-4 py-3 text-sm text-white/60">You are viewing a public community. <button type="button" onClick={() => void handleJoinPublic()} className="font-semibold text-emerald-200 hover:text-white">Join to participate</button> in discussions and start topics.</div>}
            {!canCreateTopic && currentIsMember && <p className="mt-3 text-xs text-white/35">The owner has limited topic creation to community owners.</p>}
            <label className="mt-4 block"><span className="sr-only">Search topics in this community</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics in this community…" className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3 text-sm outline-none placeholder:text-white/25 focus:border-emerald-200/40" /></label>
            {visibleTopics.length === 0 ? (
              <div className="my-5 rounded-xl border border-dashed border-white/15 px-5 py-12 text-center"><span className="text-2xl text-emerald-200">↗</span><h3 className="mt-3 text-base font-semibold">{search ? "No matching topics" : filter === "RESEARCH" ? "No research topics yet" : filter === "DISCUSSION" ? "No discussions yet" : "Start the first conversation"}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">{search ? "Try another search or clear the current query." : canCreateTopic ? "A strong topic gives the community a specific question or problem to work through together." : "The community owner controls who can open new topics."}</p>{search ? <button type="button" onClick={() => setSearch("")} className="mt-4 text-xs font-semibold text-emerald-200">Clear search</button> : canCreateTopic ? <button type="button" onClick={() => setShowForm(true)} className="mt-4 text-xs font-semibold text-emerald-200">Create a topic →</button> : null}</div>
            ) : <div className="divide-y divide-white/[0.085]">{visibleTopics.map((topic) => <article key={topic.id} className="group py-5 sm:py-6"><div className="flex items-start gap-3 sm:gap-4"><span className={"mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border text-xs font-bold " + (topic.type === "RESEARCH" ? "border-sky-300/20 bg-sky-300/[0.07] text-sky-200" : "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-200")}>{topic.type === "RESEARCH" ? "R" : "D"}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]"><span className={topic.type === "RESEARCH" ? "text-sky-200/80" : "text-emerald-200/80"}>{topic.type === "RESEARCH" ? "Research" : "Discussion"}</span><span className="text-white/20">·</span><span className="text-white/35">{relativeDate(topic.created_at)}</span></div><Link href={"/topics/" + topic.id} className="mt-2 block text-base font-semibold leading-6 tracking-[-0.015em] text-white/90 transition group-hover:text-emerald-100 sm:text-lg">{topic.title}</Link><p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-white/45">{topic.body}</p><Link href={"/topics/" + topic.id} className="mt-3 inline-flex text-xs font-medium text-white/35 transition hover:text-emerald-200">Open discussion <span className="ml-1">↗</span></Link></div></div></article>)}</div>}
          </section>
          <aside className="space-y-4">
            <section className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/75">About this space</p><h2 className="mt-3 text-base font-semibold">{community.name}</h2><p className="mt-2 text-sm leading-6 text-white/45">{community.description || "A shared space for thoughtful discussion and research."}</p><div className="mt-4 border-t border-white/[0.08] pt-4"><div className="flex items-center justify-between py-1.5 text-xs"><span className="text-white/40">Access</span><span className="font-medium text-white/75">{community.visibility === "PUBLIC" ? "Open to join" : "Private"}</span></div>{(community.visibility === "PUBLIC" || isOwner) && <div className="flex items-center justify-between py-1.5 text-xs"><span className="text-white/40">Members</span><span className="font-medium text-white/75">{memberCount}</span></div>}<div className="flex items-center justify-between py-1.5 text-xs"><span className="text-white/40">Topics</span><span className="font-medium text-white/75">{topics.length}</span></div><div className="flex items-center justify-between py-1.5 text-xs"><span className="text-white/40">Topic creation</span><span className="font-medium text-white/75">{community.members_can_create_topics ? "Members allowed" : "Owner only"}</span></div></div></section>
            <section className="rounded-xl border border-emerald-200/15 bg-emerald-200/[0.035] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/75">Good conversations</p><h2 className="mt-2 text-base font-semibold">Make the question useful.</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-white/45"><li>• Explain the context, not just the conclusion.</li><li>• Share evidence and distinguish it from assumptions.</li><li>• Welcome counterarguments that improve the answer.</li></ul></section>
            {currentIsMember && <section className="rounded-xl border border-white/[0.09] p-5"><h2 className="text-sm font-semibold">Bring in another perspective</h2><p className="mt-2 text-xs leading-5 text-white/40">Community members can invite available AI specialists to join discussions.</p><Link href="/agents" className="mt-4 inline-flex text-xs font-semibold text-emerald-200 hover:text-white">Browse AI registry →</Link></section>}
            {isOwner && <Link href={"/communities/" + community.slug + "/settings"} className="block rounded-xl border border-white/[0.09] p-4 text-sm font-medium text-white/70 transition hover:border-emerald-200/25 hover:text-emerald-100">Manage community settings →</Link>}
            <Link href="/communities" className="inline-flex text-xs font-medium text-white/40 transition hover:text-emerald-200">← Browse other communities</Link>
          </aside>
        </div>}
      </div>
    </main>
  );
}
