"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Community = {
  id: string; name: string; slug: string; description: string | null;
  visibility: "PUBLIC" | "PRIVATE"; created_by: string; members_can_create_topics: boolean;
};
type JoinRequest = { id: string; community_id: string; user_id: string; message: string | null; created_at: string; status: string; profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null };
type CommunityAgent = {
  id: string; community_id: string; name: string; handle: string; role: string; description: string;
  capabilities: string[]; specialties: string[]; participation: string; status: "AVAILABLE" | "PAUSED";
  is_active: boolean; systemPrompt: string;
};
type AgentDraft = {
  name: string; handle: string; role: string; description: string; capabilities: string;
  specialties: string; participation: string; systemPrompt: string; status: "AVAILABLE" | "PAUSED"; isActive: boolean;
};
const emptyAgent: AgentDraft = { name: "", handle: "", role: "", description: "", capabilities: "", specialties: "", participation: "", systemPrompt: "", status: "AVAILABLE", isActive: true };
function toDraft(agent: CommunityAgent): AgentDraft {
  return {
    name: agent.name, handle: agent.handle, role: agent.role, description: agent.description,
    capabilities: agent.capabilities.join("\n"), specialties: agent.specialties.join("\n"),
    participation: agent.participation, systemPrompt: agent.systemPrompt || "",
    status: agent.status, isActive: agent.is_active,
  };
}
function lineList(value: string) { return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean); }

export default function CommunitySettingsPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [community, setCommunity] = useState<Community | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [membersCanCreateTopics, setMembersCanCreateTopics] = useState(true);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [agents, setAgents] = useState<CommunityAgent[]>([]);
  const [draft, setDraft] = useState<AgentDraft>(emptyAgent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentFormOpen, setAgentFormOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingCommunity, setDeletingCommunity] = useState(false);

  async function loadSettings() {
    setLoading(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) { setLoading(false); return; }
    const { data, error: communityError } = await supabase.from("communities")
      .select("id, name, slug, description, visibility, created_by, members_can_create_topics")
      .eq("slug", params.slug).maybeSingle();
    if (communityError || !data) {
      setMessage("Community not found.");
      setError(true);
      setLoading(false);
      return;
    }
    setCommunity(data as Community);
    setVisibility(data.visibility as "PUBLIC" | "PRIVATE");
    setMembersCanCreateTopics(Boolean(data.members_can_create_topics));
    if (data.created_by !== user.id) { setLoading(false); return; }

    const [requestResponse, agentResponse] = await Promise.all([
      fetch("/api/communities/" + data.id + "/requests", { cache: "no-store" }),
      fetch("/api/communities/" + data.id + "/agents?manage=1", { cache: "no-store" }),
    ]);
    const requestPayload = await requestResponse.json().catch(() => null);
    const agentPayload = await agentResponse.json().catch(() => null);
    if (requestResponse.ok) setRequests(Array.isArray(requestPayload?.requests) ? requestPayload.requests : []);
    else { setMessage(requestPayload?.error || "Could not load access requests."); setError(true); }
    if (agentResponse.ok) setAgents(Array.isArray(agentPayload?.agents) ? agentPayload.agents : []);
    else { setMessage(agentPayload?.error || "Could not load community agents."); setError(true); }
    setLoading(false);
  }

  useEffect(() => { if (params.slug) void loadSettings(); }, [params.slug]);

  async function saveCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || community.created_by !== userId) return;
    setSaving(true); setMessage(""); setError(false);
    const { error: saveError } = await supabase.from("communities").update({
      visibility, members_can_create_topics: membersCanCreateTopics, updated_at: new Date().toISOString(),
    }).eq("id", community.id).eq("created_by", userId);
    if (saveError) { setMessage("Community settings could not be saved. Please retry."); setError(true); }
    else {
      setCommunity({ ...community, visibility, members_can_create_topics: membersCanCreateTopics });
      setMessage("Community settings saved.");
    }
    setSaving(false);
  }

  async function reviewRequest(requestId: string, decision: "APPROVED" | "REJECTED") {
    if (!community || reviewingId) return;
    setReviewingId(requestId); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/communities/" + community.id + "/requests/" + requestId, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Could not review request.");
      setRequests((current) => current.filter((item) => item.id !== requestId));
      setMessage(decision === "APPROVED" ? "Member approved and added to the community." : "Access request declined.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not review request.");
      setError(true);
    } finally { setReviewingId(null); }
  }

  function startCreateAgent() { setEditingId(null); setDraft(emptyAgent); setAgentFormOpen(true); }
  function startEditAgent(agent: CommunityAgent) { setEditingId(agent.id); setDraft(toDraft(agent)); setAgentFormOpen(true); }

  async function saveAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || community.created_by !== userId || savingAgent) return;
    setSavingAgent(true); setMessage(""); setError(false);
    const payload = {
      name: draft.name, handle: draft.handle, role: draft.role, description: draft.description,
      capabilities: lineList(draft.capabilities), specialties: lineList(draft.specialties),
      participation: draft.participation, systemPrompt: draft.systemPrompt,
      status: draft.status, isActive: draft.isActive,
    };
    try {
      const response = await fetch(editingId
        ? "/api/communities/" + community.id + "/agents/" + editingId
        : "/api/communities/" + community.id + "/agents", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not save the agent.");
      const row = result.agent as CommunityAgent;
      setAgents((current) => editingId ? current.map((item) => item.id === editingId ? row : item) : [row, ...current]);
      setMessage(editingId ? "Community agent updated." : "Community AI agent created.");
      setAgentFormOpen(false); setEditingId(null); setDraft(emptyAgent);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save the agent.");
      setError(true);
    } finally { setSavingAgent(false); }
  }

  async function pauseAgent(agent: CommunityAgent) {
    if (!community) return;
    const response = await fetch("/api/communities/" + community.id + "/agents/" + agent.id, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setMessage(payload?.error || "Could not pause the agent."); setError(true); return; }
    setAgents((current) => current.map((item) => item.id === agent.id ? { ...item, status: "PAUSED", is_active: false } : item));
    setMessage("Agent paused. Existing discussion history remains intact.");
    setError(false);
  }

  async function handleDeleteCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!community || !userId || deletingCommunity || deleteConfirmation.trim() !== community.name) return;

    setDeletingCommunity(true);
    setMessage("");
    setError(false);
    const { error: deleteError, count } = await supabase
      .from("communities")
      .delete({ count: "exact" })
      .eq("id", community.id)
      .eq("created_by", userId);

    if (deleteError || !count) {
      setMessage(deleteError?.message || "The community could not be deleted. Confirm that you are its owner and try again.");
      setError(true);
      setDeletingCommunity(false);
      return;
    }

    router.replace("/communities");
    router.refresh();
  }

  const isOwner = Boolean(community && userId && community.created_by === userId);

  if (loading) return <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]"><SiteHeader /><div className="mx-auto max-w-5xl px-5 py-14 text-sm text-white/45">Loading community settings…</div></main>;
  if (!community) return <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]"><SiteHeader /><div className="mx-auto max-w-3xl px-5 py-14"><h1 className="text-2xl font-semibold">Community unavailable</h1><p className="mt-3 text-sm text-white/45">{message || "This community could not be found."}</p><Link href="/communities" className="mt-5 inline-block text-sm text-emerald-200">Back to communities</Link></div></main>;
  if (!isOwner) return <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]"><SiteHeader /><div className="mx-auto max-w-3xl px-5 py-14"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/70">Owner-only settings</p><h1 className="mt-3 text-3xl font-semibold">These controls are private.</h1><p className="mt-3 text-sm leading-6 text-white/45">Only the owner of {community.name} can manage membership requests, access settings, and community AI prompts.</p><Link href={"/communities/" + community.slug} className="mt-6 inline-block text-sm font-semibold text-emerald-200">Back to community →</Link></div></main>;

  const inputClass = "w-full rounded-lg border border-white/10 bg-[#0b1110] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-200/40";
  const labelClass = "mb-2 block text-xs font-medium text-white/65";

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-7">
        <div className="border-b border-white/[0.09] py-5"><Link href={"/communities/" + community.slug} className="text-xs font-medium text-white/45 transition hover:text-emerald-200">← Back to {community.name}</Link></div>
        <section className="border-b border-white/[0.09] py-8 sm:py-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/75">Community owner workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{community.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">Manage who can enter this space, who can open research topics, and how this community's AI agents think and contribute.</p>
        </section>

        {message && <p role="status" className={"mt-5 rounded-lg border px-4 py-3 text-sm " + (error ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100")}>{message}</p>}

        <section className="mt-7 rounded-xl border border-white/[0.09] bg-white/[0.015] p-5 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/75">01 · Access and permissions</p>
          <h2 className="mt-2 text-xl font-semibold">Decide who gets in and who can start a discussion.</h2>
          <form onSubmit={saveCommunity} className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={labelClass}>Community visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")} className={inputClass}><option value="PUBLIC">Public — anyone can join</option><option value="PRIVATE">Private — owner approval required</option></select><span className="mt-2 block text-xs leading-5 text-white/35">{visibility === "PUBLIC" ? "Anyone signed into Converge can discover topics and join immediately." : "Only approved members can see topics, replies, AI discussions, and saved research."}</span></label>
              <label className="block"><span className={labelClass}>Who can create topics?</span><select value={membersCanCreateTopics ? "MEMBERS" : "OWNER"} onChange={(event) => setMembersCanCreateTopics(event.target.value === "MEMBERS")} className={inputClass}><option value="MEMBERS">Owner and community members</option><option value="OWNER">Only the community owner</option></select><span className="mt-2 block text-xs leading-5 text-white/35">This controls new topics. Existing discussions and replies are not removed.</span></label>
            </div>
            <button disabled={saving} className="rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710] disabled:opacity-50">{saving ? "Saving settings…" : "Save community settings"}</button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-white/[0.09] bg-white/[0.015] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/75">02 · Membership requests</p><h2 className="mt-2 text-xl font-semibold">Review who wants to join.</h2><p className="mt-2 text-sm text-white/40">{requests.length} pending {requests.length === 1 ? "request" : "requests"}</p></div><button type="button" onClick={() => void loadSettings()} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 hover:text-white">Refresh requests</button></div>
          {requests.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/35">No pending requests. New requests to this community will appear here.</div> : <div className="mt-5 divide-y divide-white/[0.08]">{requests.map((request) => <article key={request.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-sm font-semibold">{request.profile?.display_name || request.profile?.username || "Converge member"}</p><p className="mt-1 text-xs text-white/35">{request.profile?.username ? "@" + request.profile.username + " · " : ""}{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(request.created_at))}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/55">{request.message || "No note was added to this request."}</p></div><div className="flex shrink-0 gap-2"><button type="button" disabled={reviewingId === request.id} onClick={() => void reviewRequest(request.id, "REJECTED")} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:border-red-300/20 hover:text-red-100 disabled:opacity-50">Decline</button><button type="button" disabled={reviewingId === request.id} onClick={() => void reviewRequest(request.id, "APPROVED")} className="rounded-lg bg-emerald-200 px-3 py-2 text-xs font-semibold text-[#0b1710] disabled:opacity-50">{reviewingId === request.id ? "Reviewing…" : "Approve access"}</button></div></article>)}</div>}
        </section>

        <section className="mt-6 rounded-xl border border-white/[0.09] bg-white/[0.015] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/75">03 · Community AI agents</p><h2 className="mt-2 text-xl font-semibold">Create your own specialist.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">Shape an agent's role, specialties, participation guidance, and system prompt. Only you can see or edit its private prompt.</p></div><button type="button" onClick={startCreateAgent} className="rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710]">+ Create AI agent</button></div>

          {agentFormOpen && <form onSubmit={saveAgent} className="mt-6 rounded-xl border border-emerald-200/15 bg-[#0c1511] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-200/70">{editingId ? "Edit agent" : "New community agent"}</p><h3 className="mt-2 text-lg font-semibold">{editingId ? "Fine-tune this specialist" : "Define a specialist for your community"}</h3></div><button type="button" onClick={() => { setAgentFormOpen(false); setEditingId(null); setDraft(emptyAgent); }} className="text-sm text-white/40 hover:text-white">Close</button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Agent name</span><input required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Evidence Challenger" className={inputClass} /></label>
              <label><span className={labelClass}>Handle</span><input required maxLength={100} value={draft.handle} onChange={(event) => setDraft({ ...draft, handle: event.target.value })} placeholder="@evidence-challenger" className={inputClass} /></label>
              <label><span className={labelClass}>Role</span><input required maxLength={180} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} placeholder="What is this specialist responsible for?" className={inputClass} /></label>
              <label><span className={labelClass}>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as "AVAILABLE" | "PAUSED", isActive: event.target.value === "AVAILABLE" })} className={inputClass}><option value="AVAILABLE">Available to use</option><option value="PAUSED">Paused</option></select></label>
              <label className="sm:col-span-2"><span className={labelClass}>Description</span><textarea required maxLength={1500} rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Explain the agent's expertise and contribution." className={inputClass} /></label>
              <label><span className={labelClass}>Capabilities · one per line</span><textarea rows={3} value={draft.capabilities} onChange={(event) => setDraft({ ...draft, capabilities: event.target.value })} placeholder={"Evidence review\nSource comparison"} className={inputClass} /></label>
              <label><span className={labelClass}>Research specialties · one per line</span><textarea rows={3} value={draft.specialties} onChange={(event) => setDraft({ ...draft, specialties: event.target.value })} placeholder={"Literature analysis\nCounterarguments"} className={inputClass} /></label>
              <label className="sm:col-span-2"><span className={labelClass}>Participation guidance</span><textarea rows={3} maxLength={1000} value={draft.participation} onChange={(event) => setDraft({ ...draft, participation: event.target.value })} placeholder="Describe when and how this agent should contribute." className={inputClass} /></label>
              <label className="sm:col-span-2"><span className={labelClass}>System prompt · private to you</span><textarea rows={10} maxLength={15000} value={draft.systemPrompt} onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })} placeholder="You are a specialist in this community. Your job is to…\n\nExplain the reasoning style, boundaries, sources to prefer, output structure, when to challenge assumptions, and what to avoid." className={inputClass + " font-mono text-[12px] leading-6"} /><span className="mt-2 block text-xs leading-5 text-white/35">Your instructions shape subsequent replies. Converge's platform safety and evidence rules still apply.</span></label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3"><button disabled={savingAgent} className="rounded-lg bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1710] disabled:opacity-50">{savingAgent ? "Saving agent…" : editingId ? "Save agent changes" : "Create agent"}</button><button type="button" onClick={() => { setAgentFormOpen(false); setEditingId(null); setDraft(emptyAgent); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60 hover:text-white">Cancel</button></div>
          </form>}

          {agents.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-white/10 px-4 py-7 text-sm text-white/35">No community-specific agents yet. Create one to give this community its own AI specialist.</div> : <div className="mt-5 divide-y divide-white/[0.08]">{agents.map((agent) => <article key={agent.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{agent.name}</h3><span className="text-xs text-white/35">{agent.handle}</span><span className={"rounded-full px-2 py-1 text-[10px] " + (agent.is_active && agent.status === "AVAILABLE" ? "bg-emerald-200/10 text-emerald-100" : "bg-white/5 text-white/40")}>{agent.is_active && agent.status === "AVAILABLE" ? "Available" : "Paused"}</span></div><p className="mt-2 text-sm text-white/50">{agent.role}</p><p className="mt-1 text-xs leading-5 text-white/35">{agent.description}</p><p className="mt-2 text-xs text-white/35">{agent.specialties.join(" · ")}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => startEditAgent(agent)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 hover:text-white">Edit prompt / profile</button>{agent.is_active && <button type="button" onClick={() => void pauseAgent(agent)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/45 hover:border-amber-200/20 hover:text-amber-100">Pause</button>}</div></article>)}</div>}
        </section>

        <section id="delete-community" className="mt-7 rounded-xl border border-red-300/20 bg-red-300/[0.025] p-5 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/75">04 · Danger zone</p>
          <h2 className="mt-2 text-xl font-semibold text-white/90">Delete this community</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">This permanently deletes the community, all its topics, replies, AI participation history, saved research artifacts, custom AI agents, memberships and join requests. Standalone activity posts associated with this space may remain but will be unlinked from it. This cannot be undone.</p>
          <form onSubmit={handleDeleteCommunity} className="mt-5 max-w-xl border-t border-red-200/10 pt-5">
            <label className="block"><span className="mb-2 block text-xs font-medium text-white/65">Type <strong className="text-white">{community.name}</strong> to confirm</span><input required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" spellCheck={false} placeholder={community.name} className="w-full rounded-lg border border-red-200/15 bg-[#0b1110] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-red-200/40" /></label>
            <button type="submit" disabled={deletingCommunity || deleteConfirmation.trim() !== community.name} className="mt-4 rounded-lg bg-red-300 px-4 py-2.5 text-xs font-bold text-[#230f0d] transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-40">{deletingCommunity ? "Deleting community…" : "Permanently delete community"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
