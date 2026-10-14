"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Visibility = "public" | "members";
type ConnectionStatus = "NONE" | "CONNECTED" | "INCOMING" | "OUTGOING";
type PersonProfile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  organization: string | null;
  location: string | null;
  interests: string[] | null;
  profile_visibility: Visibility;
};
type RequestRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
};
type Relationship = {
  followedByMe: boolean;
  connectionStatus: ConnectionStatus;
  requestId: string | null;
};
type RelationshipMap = Record<string, Relationship>;

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}
function displayHandle(person: PersonProfile) {
  return person.username ? `@${person.username}` : "Converge member";
}

export default function PeopleDirectoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonProfile[]>([]);
  const [relationships, setRelationships] = useState<RelationshipMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [interestFilter, setInterestFilter] = useState("all");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const loadDirectory = useCallback(async (providedViewerId?: string) => {
    const currentViewer = providedViewerId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!currentViewer) {
      router.replace("/sign-in?next=/people");
      return;
    }
    setViewerId(currentViewer);
    const [
      { data: peopleData, error: peopleError },
      { data: followsData, error: followsError },
      { data: requestsData, error: requestsError },
    ] = await Promise.all([
      supabase.from("profiles")
        .select("id, username, display_name, avatar_url, headline, organization, location, interests, profile_visibility")
        .in("profile_visibility", ["public", "members"])
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase.from("follows").select("following_id").eq("follower_id", currentViewer),
      supabase.from("connection_requests")
        .select("id, requester_id, recipient_id, status")
        .or(`requester_id.eq.${currentViewer},recipient_id.eq.${currentViewer}`),
    ]);

    if (peopleError || followsError || requestsError) {
      setMessage((peopleError ?? followsError ?? requestsError)?.message ?? "People could not be loaded. Please try again.");
      setMessageTone("error");
      setLoading(false);
      return;
    }

    const visiblePeople = ((peopleData ?? []) as PersonProfile[]).filter((person) => person.id !== currentViewer);
    const followIds = new Set((followsData ?? []).map((item) => item.following_id as string));
    const requests = (requestsData ?? []) as RequestRow[];
    const nextRelationships: RelationshipMap = {};

    for (const person of visiblePeople) {
      const related = requests
        .filter((request) =>
          (request.requester_id === currentViewer && request.recipient_id === person.id)
          || (request.requester_id === person.id && request.recipient_id === currentViewer))
        .sort((a, b) => {
          const priority = (status: RequestRow["status"]) => status === "ACCEPTED" ? 0 : status === "PENDING" ? 1 : 2;
          return priority(a.status) - priority(b.status);
        });
      const accepted = related.find((request) => request.status === "ACCEPTED");
      const pending = related.find((request) => request.status === "PENDING");
      nextRelationships[person.id] = {
        followedByMe: followIds.has(person.id),
        connectionStatus: accepted
          ? "CONNECTED"
          : pending
            ? pending.requester_id === currentViewer ? "OUTGOING" : "INCOMING"
            : "NONE",
        requestId: pending?.id ?? null,
      };
    }
    setPeople(visiblePeople);
    setRelationships(nextRelationships);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    let active = true;
    async function start() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/sign-in?next=/people");
        return;
      }
      setViewerId(user.id);
      await loadDirectory(user.id);
    }
    void start();
    return () => { active = false; };
  }, [loadDirectory, router, supabase]);

  const interests = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of people) {
      for (const interest of person.interests ?? []) {
        const cleaned = interest.trim();
        if (cleaned) counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
      }
    }
    return [...counts.keys()].sort((a, b) => a.localeCompare(b)).slice(0, 18);
  }, [people]);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people.filter((person) => {
      const matchesInterest = interestFilter === "all"
        || (person.interests ?? []).some((interest) => interest.toLowerCase() === interestFilter.toLowerCase());
      const values = [
        person.display_name,
        person.username ?? "",
        person.headline ?? "",
        person.organization ?? "",
        person.location ?? "",
        ...(person.interests ?? []),
      ];
      return matchesInterest && (!query || values.some((value) => value.toLowerCase().includes(query)));
    });
  }, [people, search, interestFilter]);

  async function handleFollow(person: PersonProfile) {
    if (!viewerId) {
      router.push("/sign-in?next=/people");
      return;
    }
    setBusyAction(`follow:${person.id}`);
    setMessage("");
    const { data, error } = await supabase.rpc("toggle_follow_user", { p_following_id: person.id });
    if (error) {
      setMessage(error.message);
      setMessageTone("error");
    } else {
      await loadDirectory(viewerId);
      setMessage(data ? `You’re now following ${person.display_name}.` : `You unfollowed ${person.display_name}.`);
      setMessageTone("success");
    }
    setBusyAction(null);
  }

  async function handleConnect(person: PersonProfile) {
    if (!viewerId) {
      router.push("/sign-in?next=/people");
      return;
    }
    setBusyAction(`connect:${person.id}`);
    setMessage("");
    const { data, error } = await supabase.rpc("send_connection_request", { p_recipient_id: person.id });
    if (error) {
      setMessage(error.message);
      setMessageTone("error");
    } else {
      await loadDirectory(viewerId);
      setMessage(data === "CONNECTED" ? `You’re connected with ${person.display_name}.` : "Connection request sent.");
      setMessageTone("success");
    }
    setBusyAction(null);
  }

  async function handleMessage(person: PersonProfile) {
    if (!viewerId) {
      router.push("/sign-in?next=/people");
      return;
    }
    setBusyAction(`message:${person.id}`);
    setMessage("");
    const { data, error } = await supabase.rpc("start_direct_conversation", { p_other_user_id: person.id });
    if (error || !data) {
      setMessage(error?.message ?? "Could not open this conversation. Please try again.");
      setMessageTone("error");
      setBusyAction(null);
      return;
    }
    router.push(`/messages/${data}`);
    setBusyAction(null);
  }

  async function handleRespond(person: PersonProfile, action: "accept" | "decline" | "cancel") {
    const relationship = relationships[person.id];
    if (!relationship?.requestId) return;
    setBusyAction(`request:${person.id}`);
    setMessage("");
    const { error } = await supabase.rpc("respond_connection_request", {
      p_request_id: relationship.requestId,
      p_action: action,
    });
    if (error) {
      setMessage(error.message);
      setMessageTone("error");
    } else {
      await loadDirectory(viewerId ?? undefined);
      setMessage(action === "accept" ? `You’re connected with ${person.display_name}.` : action === "decline" ? "Connection request declined." : "Connection request cancelled.");
      setMessageTone("success");
    }
    setBusyAction(null);
  }

  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="border-b border-white/[0.09] py-9 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / People</p>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Find people, not just communities.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">Discover researchers, practitioners, and curious minds across Converge. Follow someone to keep up with their work, or connect to build a mutual relationship.</p>
            </div>
            <Link href="/network" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-emerald-200/25 hover:text-white">Manage my network ↗</Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { label: "People to discover", value: people.length, note: "Visible member profiles" },
              { label: "Research interests", value: interests.length, note: "Areas people care about" },
              { label: "Your profile", value: "↗", note: "Keep your identity current", href: "/profile" },
            ].map((stat) => <div key={stat.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-2xl font-semibold tracking-[-0.05em] text-emerald-100">{loading ? "—" : stat.value}</p>
              <p className="mt-1 text-xs font-semibold text-white/75">{stat.label}</p>
              {stat.href ? <Link href={stat.href} className="mt-1 inline-flex text-[10px] text-emerald-200 hover:text-emerald-100">{stat.note}</Link> : <p className="mt-1 text-[10px] text-white/35">{stat.note}</p>}
            </div>)}
          </div>
        </section>

        {message && <p role={messageTone === "error" ? "alert" : "status"} className={["mt-5 rounded-xl border px-4 py-3 text-sm leading-6", messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100"].join(" ")}>{message}</p>}

        <section className="pt-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Member directory</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">Discover people across Converge</h2></div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search people</span>
                <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35">⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, expertise, organisation…" className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.025] pl-9 pr-3 text-sm outline-none placeholder:text-white/30 focus:border-emerald-200/45" />
              </label>
              <select aria-label="Filter by research interest" value={interestFilter} onChange={(event) => setInterestFilter(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#101815] px-3 text-xs text-white/70 outline-none focus:border-emerald-200/45">
                <option value="all">All interests</option>
                {interests.map((interest) => <option key={interest} value={interest}>{interest}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0,1,2,3,4,5].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />)}</div>
          ) : filteredPeople.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPeople.map((person) => {
                const relation = relationships[person.id] ?? { followedByMe: false, connectionStatus: "NONE" as ConnectionStatus, requestId: null };
                const profileHref = `/u/${person.username || person.id}`;
                const actionBusy = busyAction?.endsWith(person.id) ?? false;
                return (
                  <article key={person.id} className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101815]/80 transition hover:border-emerald-200/20">
                    <div className="h-1 bg-gradient-to-r from-emerald-200/60 via-emerald-200/15 to-transparent" />
                    <div className="p-5">
                      <Link href={profileHref} className="group flex items-start gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                        <div className="grid size-[58px] shrink-0 place-items-center overflow-hidden rounded-[18px] border border-white/10 bg-emerald-200/[0.08] text-base font-bold text-emerald-100">{person.avatar_url ? <img src={person.avatar_url} alt="" className="size-full object-cover" /> : initials(person.display_name)}</div>
                        <div className="min-w-0 flex-1 pt-1">
                          <h3 className="truncate text-base font-semibold tracking-[-0.03em] text-white group-hover:text-emerald-100">{person.display_name}</h3>
                          <p className="mt-1 text-[11px] text-white/35">{displayHandle(person)}</p>
                          {person.headline && <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/65">{person.headline}</p>}
                        </div>
                      </Link>
                      {(person.organization || person.location) && <p className="mt-4 truncate text-[10px] text-white/35">{[person.organization, person.location].filter(Boolean).join(" · ")}</p>}
                      {!!person.interests?.length && <div className="mt-3 flex flex-wrap gap-1.5">{person.interests.slice(0, 3).map((interest) => <span key={interest} className="rounded-full border border-emerald-200/12 bg-emerald-200/[0.04] px-2.5 py-1.5 text-[9px] text-emerald-100/75">{interest}</span>)}</div>}
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                        <button type="button" onClick={() => void handleFollow(person)} disabled={actionBusy} className={["rounded-full border px-3.5 py-2.5 text-[10px] font-semibold transition disabled:opacity-40", relation.followedByMe ? "border-emerald-200/25 bg-emerald-200/[0.07] text-emerald-100" : "border-white/15 text-white/65 hover:border-emerald-200/30 hover:text-emerald-100"].join(" ")}>{busyAction === `follow:${person.id}` ? "…" : relation.followedByMe ? "Following ✓" : "Follow +"}</button>
                        {relation.connectionStatus === "CONNECTED" ? <><Link href="/network" className="inline-flex items-center rounded-full border border-emerald-200/25 bg-emerald-200/[0.07] px-3.5 py-2.5 text-[10px] font-semibold text-emerald-100">Connected ✓</Link><button type="button" onClick={() => void handleMessage(person)} disabled={actionBusy} className="rounded-full bg-emerald-200 px-3.5 py-2.5 text-[10px] font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-40">{busyAction === `message:${person.id}` ? "Opening…" : "Message ↗"}</button></>
                          : relation.connectionStatus === "INCOMING" ? <button type="button" onClick={() => void handleRespond(person, "accept")} disabled={actionBusy} className="rounded-full bg-emerald-200 px-3.5 py-2.5 text-[10px] font-bold text-[#0b1710] disabled:opacity-40">Accept request</button>
                          : relation.connectionStatus === "OUTGOING" ? <button type="button" onClick={() => void handleRespond(person, "cancel")} disabled={actionBusy} className="rounded-full border border-amber-200/20 bg-amber-200/[0.04] px-3.5 py-2.5 text-[10px] font-semibold text-amber-100 disabled:opacity-40">Request sent · Cancel</button>
                          : <button type="button" onClick={() => void handleConnect(person)} disabled={actionBusy} className="rounded-full bg-emerald-200 px-3.5 py-2.5 text-[10px] font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-40">{busyAction === `connect:${person.id}` ? "Sending…" : "Connect ↗"}</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-white/[0.12] px-6 py-14 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-xl text-emerald-100">◎</div>
              <h3 className="mt-4 text-lg font-semibold">{people.length ? "No people match that search." : "Be one of the first faces people discover."}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">{people.length ? "Try another name, organisation, location, or research interest." : "Members with public or members-only profiles appear here. Complete your own profile and invite collaborators to join Converge."}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {people.length > 0 && <button type="button" onClick={() => { setSearch(""); setInterestFilter("all"); }} className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/65 hover:text-white">Clear filters</button>}
                <Link href="/profile" className="rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Edit your profile ↗</Link>
              </div>
            </div>
          )}
        </section>
        <p className="mt-8 text-[10px] leading-5 text-white/30">Only profiles set to Public or Members are listed. Private profiles are not discoverable here.</p>
      </div>
    </main>
  );
}
