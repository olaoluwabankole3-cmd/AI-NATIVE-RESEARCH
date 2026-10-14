"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type PublicProfile = {
  id: string; username: string | null; display_name: string;
  headline: string | null; bio: string | null; avatar_url: string | null;
  location: string | null; organization: string | null; website_url: string | null;
  interests: string[] | null; profile_visibility: "public" | "members" | "private"; created_at: string;
};
type ConnectionStatus = "NONE" | "SELF" | "CONNECTED" | "INCOMING" | "OUTGOING";
type SocialSummary = {
  follower_count: number; following_count: number; connection_count: number;
  followed_by_me: boolean; connection_status: ConnectionStatus; connection_request_id: string | null;
};
const emptySocial: SocialSummary = {
  follower_count: 0, following_count: 0, connection_count: 0, followed_by_me: false,
  connection_status: "NONE", connection_request_id: null,
};

function parseSocialSummary(value: unknown): SocialSummary {
  const row = (value ?? {}) as Partial<SocialSummary>;
  return {
    follower_count: Number(row.follower_count ?? 0),
    following_count: Number(row.following_count ?? 0),
    connection_count: Number(row.connection_count ?? 0),
    followed_by_me: Boolean(row.followed_by_me),
    connection_status: (row.connection_status ?? "NONE") as ConnectionStatus,
    connection_request_id: row.connection_request_id ?? null,
  };
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

export default function PublicProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "").toLowerCase();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialSummary>(emptySocial);
  const [loading, setLoading] = useState(true);
  const [socialBusy, setSocialBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [socialMessage, setSocialMessage] = useState("");
  const [socialMessageTone, setSocialMessageTone] = useState<"success" | "error">("success");

  async function refreshSocial(profileId: string) {
    const { data, error } = await supabase.rpc("get_profile_social_summary", { p_profile_id: profileId }).maybeSingle();
    if (error) return;
    if (data) setSocial(parseSocialSummary(data));
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: authData }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("profiles")
          .select("id, username, display_name, headline, bio, avatar_url, location, organization, website_url, interests, profile_visibility, created_at")
          .eq("username", username)
          .maybeSingle(),
      ]);
      if (!active) return;
      setViewerId(authData.user?.id ?? null);
      if (error || !data) {
        setNotFound(true);
      } else {
        setProfile(data as PublicProfile);
        const { data: summaryData } = await supabase.rpc("get_profile_social_summary", { p_profile_id: data.id }).maybeSingle();
        if (active && summaryData) setSocial(parseSocialSummary(summaryData));
      }
      setLoading(false);
    }
    if (username) void load();
    else { setNotFound(true); setLoading(false); }
    return () => { active = false; };
  }, [supabase, username]);

  async function handleFollow() {
    if (!profile) return;
    if (!viewerId) { router.push(`/sign-in?next=${encodeURIComponent(`/u/${username}`)}`); return; }
    setSocialBusy(true); setSocialMessage("");
    const { data, error } = await supabase.rpc("toggle_follow_user", { p_following_id: profile.id });
    if (error) {
      setSocialMessage(error.message); setSocialMessageTone("error");
    } else {
      await refreshSocial(profile.id);
      setSocial((current) => ({ ...current, followed_by_me: Boolean(data) }));
      setSocialMessage(data ? `You’re now following ${profile.display_name}.` : `You unfollowed ${profile.display_name}.`);
      setSocialMessageTone("success");
    }
    setSocialBusy(false);
  }

  async function handleConnect() {
    if (!profile) return;
    if (!viewerId) { router.push(`/sign-in?next=${encodeURIComponent(`/u/${username}`)}`); return; }
    setSocialBusy(true); setSocialMessage("");
    const { data, error } = await supabase.rpc("send_connection_request", { p_recipient_id: profile.id });
    if (error) {
      setSocialMessage(error.message); setSocialMessageTone("error");
    } else {
      await refreshSocial(profile.id);
      setSocialMessage(data === "CONNECTED" ? `You’re connected with ${profile.display_name}.` : "Connection request sent.");
      setSocialMessageTone("success");
    }
    setSocialBusy(false);
  }

  async function handleRequestResponse(action: "accept" | "decline" | "cancel") {
    if (!profile || !social.connection_request_id) return;
    setSocialBusy(true); setSocialMessage("");
    const { error } = await supabase.rpc("respond_connection_request", {
      p_request_id: social.connection_request_id, p_action: action,
    });
    if (error) {
      setSocialMessage(error.message); setSocialMessageTone("error");
    } else {
      await refreshSocial(profile.id);
      setSocialMessage(action === "accept" ? `You’re connected with ${profile.display_name}.` : action === "decline" ? "Connection request declined." : "Connection request cancelled.");
      setSocialMessageTone("success");
    }
    setSocialBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1000px] px-4 pb-16 pt-8 sm:px-7 sm:pt-12">
        {loading ? (
          <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />
        ) : notFound || !profile ? (
          <section className="rounded-3xl border border-white/[0.09] bg-[#101815] px-6 py-14 text-center sm:px-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/70">Converge / People</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">This profile isn’t available.</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/45">The username may be incorrect, or this member may have limited their profile visibility.</p>
            <Link href="/communities" className="mt-6 inline-flex rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100">Explore communities ↗</Link>
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-3xl border border-white/[0.1] bg-[#101815]">
              <div className="relative h-32 bg-[radial-gradient(ellipse_at_22%_0%,rgba(164,237,193,0.22),transparent_57%),radial-gradient(ellipse_at_92%_50%,rgba(246,198,157,0.1),transparent_43%),linear-gradient(110deg,#192b20,#101815)] sm:h-44">
                <div className="absolute left-5 top-5 text-[9px] font-bold uppercase tracking-[0.19em] text-emerald-100/50 sm:left-8 sm:top-7">Converge / People</div>
              </div>
              <div className="px-5 pb-7 sm:px-8 sm:pb-9">
                <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                  <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-[27px] border-[5px] border-[#101815] bg-emerald-200/[0.12] text-2xl font-bold text-emerald-100 sm:size-28">
                    {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name} className="size-full object-cover" /> : initials(profile.display_name)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {social.connection_status === "SELF" || viewerId === profile.id ? (
                      <Link href="/profile" className="inline-flex items-center gap-2 rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] hover:bg-emerald-100">Edit your profile ↗</Link>
                    ) : (
                      <>
                        <button type="button" onClick={() => void handleFollow()} disabled={socialBusy} className={["inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50", social.followed_by_me ? "border-emerald-200/30 bg-emerald-200/[0.08] text-emerald-100 hover:border-red-200/25 hover:text-red-100" : "border-white/15 text-white/75 hover:border-emerald-200/30 hover:text-emerald-100"].join(" ")}>{social.followed_by_me ? "Following" : "Follow"} <span aria-hidden="true">{social.followed_by_me ? "✓" : "+"}</span></button>
                        {social.connection_status === "CONNECTED" ? <Link href="/network" className="inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-emerald-200/[0.08] px-4 py-2.5 text-xs font-semibold text-emerald-100">Connected ✓</Link>
                          : social.connection_status === "INCOMING" ? <><button type="button" onClick={() => void handleRequestResponse("accept")} disabled={socialBusy} className="rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] disabled:opacity-50">Accept request</button><button type="button" onClick={() => void handleRequestResponse("decline")} disabled={socialBusy} className="rounded-full border border-white/15 px-3 py-2.5 text-xs font-semibold text-white/55 disabled:opacity-50">Decline</button></>
                          : social.connection_status === "OUTGOING" ? <button type="button" onClick={() => void handleRequestResponse("cancel")} disabled={socialBusy} className="rounded-full border border-amber-200/20 bg-amber-200/[0.05] px-4 py-2.5 text-xs font-semibold text-amber-100 disabled:opacity-50">Request sent · Cancel</button>
                          : <button type="button" onClick={() => void handleConnect()} disabled={socialBusy} className="inline-flex items-center gap-2 rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-50">{socialBusy ? "Please wait…" : "Connect"} <span aria-hidden="true">↗</span></button>}
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-5">
                  <h1 className="break-words text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">{profile.display_name}</h1>
                  <p className="mt-1.5 text-sm text-white/40">@{profile.username}</p>
                  {profile.headline && <p className="mt-4 max-w-3xl text-base leading-7 text-white/80">{profile.headline}</p>}
                  {(profile.organization || profile.location) && <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45"><span>{profile.organization}</span>{profile.organization && profile.location && <span aria-hidden="true">·</span>}<span>{profile.location}</span></p>}
                </div>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.08] pt-5">
                  <Link href="/network?view=connections" className="text-xs text-white/55 transition hover:text-emerald-100"><strong className="mr-1 text-white">{social.connection_count}</strong> connections</Link>
                  <span className="text-xs text-white/55"><strong className="mr-1 text-white">{social.follower_count}</strong> followers</span>
                  <span className="text-xs text-white/55"><strong className="mr-1 text-white">{social.following_count}</strong> following</span>
                </div>
              </div>
            </section>

            {socialMessage && <p role={socialMessageTone === "error" ? "alert" : "status"} className={["mt-4 rounded-xl border px-4 py-3 text-xs leading-5", socialMessageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100"].join(" ")}>{socialMessage}</p>}

            <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_290px]">
              <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/80 p-5 sm:p-7">
                <h2 className="text-sm font-semibold">About</h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/65">{profile.bio || "This member hasn’t added an introduction yet."}</p>
                {!!profile.interests?.length && <div className="mt-7"><h3 className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/40">Interests and research areas</h3><div className="mt-3 flex flex-wrap gap-2">{profile.interests.map((interest, index) => <span key={`${interest}-${index}`} className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.05] px-3 py-2 text-xs text-emerald-100/80">{interest}</span>)}</div></div>}
              </section>
              <aside className="space-y-4">
                <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/80 p-5">
                  <h2 className="text-sm font-semibold">Details</h2>
                  {profile.organization && <div className="mt-4"><p className="text-[10px] uppercase tracking-[0.13em] text-white/35">Affiliation</p><p className="mt-1.5 text-sm text-white/75">{profile.organization}</p></div>}
                  {profile.location && <div className="mt-4"><p className="text-[10px] uppercase tracking-[0.13em] text-white/35">Location</p><p className="mt-1.5 text-sm text-white/75">{profile.location}</p></div>}
                  {profile.website_url && <div className="mt-4"><p className="text-[10px] uppercase tracking-[0.13em] text-white/35">Website</p><a href={profile.website_url} target="_blank" rel="noreferrer noopener" className="mt-1.5 inline-flex max-w-full items-center gap-2 break-all text-sm text-emerald-200 hover:text-emerald-100">{profile.website_url.replace(/^https?:\/\//i, "").replace(/\/$/, "")} <span aria-hidden="true">↗</span></a></div>}
                  <div className="mt-5 border-t border-white/[0.08] pt-4 text-[10px] text-white/35">Member since {new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(profile.created_at))}</div>
                </section>
                <p className="px-1 text-[11px] leading-5 text-white/35">Build your network around shared interests, expertise, and research perspectives.</p>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
