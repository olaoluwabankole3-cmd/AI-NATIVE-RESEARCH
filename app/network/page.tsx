"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Tab = "connections" | "requests" | "following";
type Status = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
type RequestRow = { id: string; requester_id: string; recipient_id: string; status: Status; created_at: string };
type FollowRow = { following_id: string; created_at: string };
type ProfileSummary = { id: string; username: string | null; display_name: string; avatar_url: string | null; headline: string | null; organization: string | null; location: string | null };
const tabs: { value: Tab; label: string }[] = [
  { value: "connections", label: "Connections" }, { value: "requests", label: "Requests" }, { value: "following", label: "Following" },
];

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}
function fallbackName(id: string) { return `Converge member · ${id.slice(0, 6)}`; }
function dateLabel(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function NetworkPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("connections");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const loadNetwork = useCallback(async (providedUserId?: string) => {
    const viewerId = providedUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!viewerId) {
      router.replace("/sign-in?next=/network");
      return;
    }
    setUserId(viewerId);
    const [{ data: requestData, error: requestError }, { data: followData, error: followError }] = await Promise.all([
      supabase.from("connection_requests").select("id, requester_id, recipient_id, status, created_at")
        .or(`requester_id.eq.${viewerId},recipient_id.eq.${viewerId}`).order("updated_at", { ascending: false }),
      supabase.from("follows").select("following_id, created_at").eq("follower_id", viewerId).order("created_at", { ascending: false }),
    ]);
    if (requestError || followError) {
      setMessage((requestError ?? followError)?.message ?? "Your network could not be loaded.");
      setMessageTone("error");
    } else {
      const requestRows = (requestData ?? []) as RequestRow[];
      const followRows = (followData ?? []) as FollowRow[];
      setRequests(requestRows);
      setFollows(followRows);
      const otherIds = [...new Set([
        ...requestRows.map((row) => row.requester_id === viewerId ? row.recipient_id : row.requester_id),
        ...followRows.map((row) => row.following_id),
      ].filter((id) => id !== viewerId))];
      if (otherIds.length) {
        const { data: profileData } = await supabase.from("profiles")
          .select("id, username, display_name, avatar_url, headline, organization, location")
          .in("id", otherIds);
        const profileMap: Record<string, ProfileSummary> = {};
        for (const profile of (profileData ?? []) as ProfileSummary[]) profileMap[profile.id] = profile;
        setProfiles(profileMap);
      } else {
        setProfiles({});
      }
    }
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    let active = true;
    async function start() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/sign-in?next=/network"); return; }
      await loadNetwork(user.id);
    }
    void start();
    return () => { active = false; };
  }, [loadNetwork, router, supabase]);

  const connections = requests.filter((request) => request.status === "ACCEPTED");
  const incoming = requests.filter((request) => request.status === "PENDING" && request.recipient_id === userId);
  const outgoing = requests.filter((request) => request.status === "PENDING" && request.requester_id === userId);
  const visibleRequestsCount = incoming.length;

  function otherId(request: RequestRow) {
    return request.requester_id === userId ? request.recipient_id : request.requester_id;
  }
  function profileFor(id: string) {
    return profiles[id] ?? { id, username: null, display_name: fallbackName(id), avatar_url: null, headline: null, organization: null, location: null };
  }

  async function connectionAction(requestId: string, action: "accept" | "decline" | "cancel") {
    setBusyAction(`${requestId}:${action}`); setMessage("");
    const { error } = await supabase.rpc("respond_connection_request", { p_request_id: requestId, p_action: action });
    if (error) {
      setMessage(error.message); setMessageTone("error");
    } else {
      await loadNetwork(userId ?? undefined);
      setMessage(action === "accept" ? "Connection accepted." : action === "decline" ? "Request declined." : "Request cancelled.");
      setMessageTone("success");
    }
    setBusyAction(null);
  }

  async function removeConnection(id: string) {
    setBusyAction(`remove:${id}`); setMessage("");
    const { error } = await supabase.rpc("remove_connection", { p_other_user_id: id });
    if (error) {
      setMessage(error.message); setMessageTone("error");
    } else {
      await loadNetwork(userId ?? undefined);
      setMessage("Connection removed."); setMessageTone("success");
    }
    setBusyAction(null);
  }

  async function unfollow(id: string) {
    setBusyAction(`unfollow:${id}`); setMessage("");
    const { data, error } = await supabase.rpc("toggle_follow_user", { p_following_id: id });
    if (error) {
      setMessage(error.message); setMessageTone("error");
    } else {
      await loadNetwork(userId ?? undefined);
      setMessage(data ? "You’re following this member." : "Member unfollowed.");
      setMessageTone("success");
    }
    setBusyAction(null);
  }

  function PersonCard({ id, footer }: { id: string; footer?: React.ReactNode }) {
    const profile = profileFor(id);
    const card = <div className="flex items-center gap-3">
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[15px] border border-white/10 bg-emerald-200/[0.08] text-sm font-bold text-emerald-100">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : initials(profile.display_name)}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white/85">{profile.display_name}</p>{profile.headline && <p className="mt-1 truncate text-[11px] text-white/40">{profile.headline}</p>}{(profile.organization || profile.location) && <p className="mt-1 truncate text-[10px] text-white/30">{[profile.organization, profile.location].filter(Boolean).join(" · ")}</p>}</div>
    </div>;
    return <article className="rounded-2xl border border-white/[0.09] bg-[#101815]/75 p-4 transition hover:border-white/[0.16]">
      <Link href={`/u/${profile.username || profile.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">{card}</Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
        <Link href={`/u/${profile.username || profile.id}`} className="text-[10px] font-semibold text-emerald-200 hover:text-emerald-100">View profile ↗</Link>
        {footer}
      </div>
    </article>;
  }

  const incomingSection = incoming.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{incoming.map((request) => <PersonCard key={request.id} id={request.requester_id} footer={<div className="flex gap-2"><button type="button" disabled={!!busyAction} onClick={() => void connectionAction(request.id, "accept")} className="rounded-full bg-emerald-200 px-3 py-2 text-[10px] font-bold text-[#0b1710] disabled:opacity-40">{busyAction === `${request.id}:accept` ? "…" : "Accept"}</button><button type="button" disabled={!!busyAction} onClick={() => void connectionAction(request.id, "decline")} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-semibold text-white/55 disabled:opacity-40">Decline</button></div>} />)}</div> : <EmptyState title="No incoming requests" description="Connection requests from other members will appear here." />;
  const outgoingSection = outgoing.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{outgoing.map((request) => <PersonCard key={request.id} id={request.recipient_id} footer={<button type="button" disabled={!!busyAction} onClick={() => void connectionAction(request.id, "cancel")} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-semibold text-white/55 disabled:opacity-40">{busyAction === `${request.id}:cancel` ? "…" : "Cancel request"}</button>} />)}</div> : <EmptyState title="No outgoing requests" description="Connection requests you send will appear here until they are answered." />;

  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="border-b border-white/[0.09] py-9 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Your network</p>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">People who move ideas forward.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">Follow people whose work you value, build mutual connections, and manage requests in one place.</p></div><Link href="/people" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/65 hover:border-emerald-200/25 hover:text-white">Discover people ↗</Link></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[{ label: "Connections", count: connections.length, note: "Mutual relationships" }, { label: "Requests to review", count: visibleRequestsCount, note: "Waiting for your response" }, { label: "Following", count: follows.length, note: "People you keep up with" }].map((item) => <div key={item.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><p className="text-2xl font-semibold tracking-[-0.05em] text-emerald-100">{loading ? "—" : String(item.count).padStart(2, "0")}</p><p className="mt-1 text-xs font-semibold text-white/75">{item.label}</p><p className="mt-1 text-[10px] text-white/35">{item.note}</p></div>)}
          </div>
        </section>

        {message && <p role={messageTone === "error" ? "alert" : "status"} className={["mt-5 rounded-xl border px-4 py-3 text-sm leading-6", messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100"].join(" ")}>{message}</p>}

        <div className="mt-7 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4">
          {tabs.map((item) => <button key={item.value} type="button" onClick={() => setTab(item.value)} className={["rounded-full px-4 py-2.5 text-xs font-semibold transition", tab === item.value ? "bg-emerald-200 text-[#0b1710]" : "border border-white/10 text-white/55 hover:border-white/20 hover:text-white"].join(" ")}>{item.label}{item.value === "requests" && incoming.length > 0 ? ` · ${incoming.length}` : ""}</button>)}
        </div>

        {loading ? <div className="mt-6 grid gap-3 md:grid-cols-2">{[0,1,2,3].map((key) => <div key={key} className="h-24 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />)}</div> :
          tab === "connections" ? <section className="pt-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Your network</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Connections <span className="text-white/30">{connections.length}</span></h2></div>{connections.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{connections.map((request) => <PersonCard key={request.id} id={otherId(request)} footer={<button type="button" disabled={!!busyAction} onClick={() => void removeConnection(otherId(request))} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-semibold text-white/45 hover:border-red-200/25 hover:text-red-100 disabled:opacity-40">{busyAction === `remove:${otherId(request)}` ? "…" : "Remove"}</button>} />)}</div> : <EmptyState title="Your network starts with a conversation" description="Visit a member’s profile and choose Connect to send a request, or Follow to keep up with their work." action={<Link href="/people" className="rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Find people ↗</Link>} />}</section>
          : tab === "requests" ? <section className="space-y-9 pt-6"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Incoming</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Requests to review <span className="text-white/30">{incoming.length}</span></h2>{incomingSection}</div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Outgoing</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Requests you sent <span className="text-white/30">{outgoing.length}</span></h2>{outgoingSection}</div></section>
          : <section className="pt-6"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">One-way follows</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">People you follow <span className="text-white/30">{follows.length}</span></h2>{follows.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{follows.map((follow) => <PersonCard key={follow.following_id} id={follow.following_id} footer={<button type="button" disabled={!!busyAction} onClick={() => void unfollow(follow.following_id)} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-semibold text-white/45 hover:border-red-200/25 hover:text-red-100 disabled:opacity-40">{busyAction === `unfollow:${follow.following_id}` ? "…" : "Unfollow"}</button>} />)}</div> : <EmptyState title="Follow people whose work matters to you" description="Follow is one-way and doesn’t require approval. Visit a member’s profile to get started." action={<Link href="/communities" className="rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Explore Converge ↗</Link>} />}</section>}
      </div>
    </main>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-dashed border-white/[0.12] px-6 py-12 text-center"><div className="mx-auto grid size-11 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-lg text-emerald-100">◎</div><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
