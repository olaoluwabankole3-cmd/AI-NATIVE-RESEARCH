"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Community = { id: string; name: string; slug: string; created_by: string };
type Role = "OWNER" | "MODERATOR" | "MEMBER";
type MemberRow = { user_id: string; role: Role; joined_at: string };
type Profile = { id: string; display_name: string | null; username: string | null; avatar_url: string | null; headline: string | null };
type BanRow = { user_id: string; banned_by: string; reason: string | null; created_at: string };

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

export default function CommunityMembersPage() {
  const params = useParams<{ slug: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [community, setCommunity] = useState<Community | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<Role | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);

  const isOwner = Boolean(community && viewerId && community.created_by === viewerId);

  async function loadMembers() {
    setLoading(true);
    setNotice("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setViewerId(null);
      setLoading(false);
      return;
    }
    setViewerId(user.id);

    const { data: communityData, error: communityError } = await supabase
      .from("communities").select("id, name, slug, created_by").eq("slug", params.slug).maybeSingle();
    if (communityError || !communityData) {
      setNotice(communityError?.message || "This community could not be found.");
      setNoticeError(true);
      setLoading(false);
      return;
    }
    const currentCommunity = communityData as Community;
    setCommunity(currentCommunity);

    const { data: membership, error: membershipError } = await supabase
      .from("community_members").select("user_id, role").eq("community_id", currentCommunity.id).eq("user_id", user.id).maybeSingle();
    const role = currentCommunity.created_by === user.id ? "OWNER" : (membership?.role as Role | undefined) ?? null;
    setViewerRole(role);
    if (membershipError || (role !== "OWNER" && role !== "MODERATOR")) {
      setNotice("Only this community’s owner or moderators can manage members.");
      setNoticeError(true);
      setLoading(false);
      return;
    }

    const [{ data: memberData, error: memberError }, { data: banData, error: banError }] = await Promise.all([
      supabase.from("community_members").select("user_id, role, joined_at").eq("community_id", currentCommunity.id).order("joined_at", { ascending: true }),
      supabase.from("community_bans").select("user_id, banned_by, reason, created_at").eq("community_id", currentCommunity.id).order("created_at", { ascending: false }),
    ]);
    if (memberError || banError) {
      setNotice(memberError?.message || banError?.message || "Member list could not be loaded.");
      setNoticeError(true);
      setLoading(false);
      return;
    }

    const memberRows = (memberData ?? []) as MemberRow[];
    const banRows = (banData ?? []) as BanRow[];
    setMembers(memberRows);
    setBans(banRows);
    const ids = [...new Set([...memberRows.map((row) => row.user_id), ...banRows.map((row) => row.user_id)])];
    if (ids.length) {
      const { data: profileData } = await supabase.from("profiles").select("id, display_name, username, avatar_url, headline").in("id", ids);
      const map: Record<string, Profile> = {};
      for (const profile of (profileData ?? []) as Profile[]) map[profile.id] = profile;
      setProfiles(map);
    } else setProfiles({});
    setLoading(false);
  }

  useEffect(() => { if (params.slug) void loadMembers(); }, [params.slug]);

  async function moderate(targetId: string, action: "REMOVE" | "BLOCK" | "UNBLOCK") {
    if (!community || !viewerId || busyKey) return;
    const profile = profiles[targetId];
    const name = profile?.display_name || profile?.username || "this member";
    const prompt = action === "REMOVE"
      ? `Remove ${name} from ${community.name}? They may rejoin if the community is public.`
      : action === "BLOCK"
        ? `Block ${name} from ${community.name}? This removes their membership and prevents them from rejoining or requesting access until the owner lifts the block.`
        : `Lift the community block for ${name}? They will be able to request or join again, subject to community settings.`;
    if (!window.confirm(prompt)) return;
    setBusyKey(targetId + action);
    setNotice("");
    setNoticeError(false);
    const { error } = await supabase.rpc("moderate_community_member", {
      p_community_id: community.id,
      p_user_id: targetId,
      p_action: action,
      p_reason: action === "BLOCK" ? "Blocked by community moderation" : null,
    });
    if (error) {
      setNotice(error.message);
      setNoticeError(true);
    } else {
      setNotice(action === "REMOVE" ? "Member removed." : action === "BLOCK" ? "Member blocked from this community." : "Community block lifted.");
      await loadMembers();
    }
    setBusyKey(null);
  }

  if (!viewerId && !loading) {
    return <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]"><SiteHeader /><div className="mx-auto max-w-3xl px-5 py-14"><h1 className="text-2xl font-semibold">Sign in to manage members.</h1><Link href="/sign-in" className="mt-5 inline-flex text-sm font-semibold text-emerald-200">Sign in ↗</Link></div></main>;
  }

  const canModerate = viewerRole === "OWNER" || viewerRole === "MODERATOR";
  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1080px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="border-b border-white/[0.09] py-9 sm:py-12">
          <Link href={`/communities/${params.slug}`} className="text-xs font-medium text-white/40 hover:text-emerald-100">← Back to community</Link>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Community workspace / Moderation</p>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><h1 className="text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Manage members</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">Remove members who no longer belong here, or block repeat issues so they cannot rejoin this community.</p></div>
            {isOwner && <Link href={`/communities/${params.slug}/settings`} className="inline-flex w-fit rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/65 hover:border-emerald-200/25 hover:text-emerald-100">Community settings ↗</Link>}
          </div>
        </section>

        {notice && <p role={noticeError ? "alert" : "status"} className={["mt-5 rounded-xl border px-4 py-3 text-sm leading-6", noticeError ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100"].join(" ")}>{notice}</p>}

        <section className="mt-7 rounded-2xl border border-white/[0.09] bg-[#101815]/70 p-4 sm:p-6">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/70">01 / Current members</p><h2 className="mt-2 text-xl font-semibold">{community?.name ?? "Community"} · {members.length}</h2></div><button type="button" onClick={() => void loadMembers()} className="rounded-full border border-white/15 px-3.5 py-2 text-[10px] font-semibold text-white/65 hover:text-white">Refresh</button></div>
          {loading ? <div className="mt-5 h-24 animate-pulse rounded-xl bg-white/[0.035]" /> : members.length ? <div className="mt-4 divide-y divide-white/[0.08]">
            {members.map((row) => {
              const profile = profiles[row.user_id];
              const name = profile?.display_name || profile?.username || "Converge member";
              const isSelf = row.user_id === viewerId;
              const cannotTouch = isSelf || row.role === "OWNER" || (viewerRole === "MODERATOR" && row.role !== "MEMBER");
              return <article key={row.user_id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-emerald-200/15 bg-emerald-200/[0.07] text-xs font-bold text-emerald-100">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : initials(name)}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{name}{isSelf ? " · You" : ""}</p><p className="mt-1 truncate text-[11px] text-white/35">{profile?.username ? "@" + profile.username + " · " : ""}{profile?.headline || "Community member"}</p><p className="mt-1 text-[10px] text-white/30">Joined {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(row.joined_at))}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={["rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em]", row.role === "OWNER" ? "bg-emerald-200/10 text-emerald-100" : row.role === "MODERATOR" ? "bg-sky-200/10 text-sky-100" : "bg-white/[0.05] text-white/45"].join(" ")}>{row.role}</span>
                  {!cannotTouch && canModerate && <><button type="button" disabled={Boolean(busyKey)} onClick={() => void moderate(row.user_id, "REMOVE")} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-semibold text-white/65 transition hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-40">{busyKey === row.user_id + "REMOVE" ? "…" : "Remove"}</button><button type="button" disabled={Boolean(busyKey)} onClick={() => void moderate(row.user_id, "BLOCK")} className="rounded-full border border-red-300/20 px-3 py-2 text-[10px] font-semibold text-red-100/80 transition hover:bg-red-300/[0.06] disabled:opacity-40">{busyKey === row.user_id + "BLOCK" ? "…" : "Block"}</button></>}
                </div>
              </article>;
            })}
          </div> : <p className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-7 text-sm text-white/40">No membership records yet. The community owner is managed separately.</p>}
          {viewerRole === "MODERATOR" && <p className="mt-4 text-[10px] leading-5 text-white/35">Moderators can remove or block regular members. Only the community owner can remove other moderators or lift a block.</p>}
        </section>

        <section className="mt-6 rounded-2xl border border-red-300/15 bg-red-300/[0.025] p-4 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-100/70">02 / Community blocks</p>
          <h2 className="mt-2 text-xl font-semibold">Blocked from this community</h2>
          <p className="mt-2 text-xs leading-5 text-white/40">Blocked people are removed immediately and cannot rejoin or submit a new access request. This is a community-specific restriction; it does not block them across all of Converge.</p>
          {bans.length ? <div className="mt-4 divide-y divide-white/[0.08]">
            {bans.map((ban) => {
              const profile = profiles[ban.user_id];
              const name = profile?.display_name || profile?.username || "Converge member";
              return <article key={ban.user_id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl border border-red-200/15 bg-red-200/[0.05] text-xs font-bold text-red-100">{initials(name)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{name}</p><p className="mt-1 text-[10px] text-white/35">Blocked {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(ban.created_at))}{ban.reason ? " · " + ban.reason : ""}</p></div></div>{isOwner && <button type="button" disabled={Boolean(busyKey)} onClick={() => void moderate(ban.user_id, "UNBLOCK")} className="rounded-full border border-emerald-200/20 px-3.5 py-2 text-[10px] font-semibold text-emerald-100 disabled:opacity-40">{busyKey === ban.user_id + "UNBLOCK" ? "…" : "Lift block"}</button>}</article>;
            })}
          </div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/35">No one is currently blocked from this community.</p>}
        </section>
      </div>
    </main>
  );
}
