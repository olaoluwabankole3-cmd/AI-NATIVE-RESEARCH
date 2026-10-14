"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  organization: string | null;
  website_url: string | null;
  interests: string[] | null;
  profile_visibility: "public" | "members" | "private";
  created_at: string;
};

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

export default function PublicProfilePage() {
  const supabase = createClient();
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "").toLowerCase();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.from("profiles")
        .select("id, username, display_name, headline, bio, avatar_url, location, organization, website_url, interests, profile_visibility, created_at")
        .eq("username", username)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        setNotFound(true);
      } else {
        setProfile(data as PublicProfile);
      }
      setLoading(false);
    }
    if (username) void load();
    else { setNotFound(true); setLoading(false); }
    return () => { active = false; };
  }, [supabase, username]);

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
                  <Link href="/sign-in" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/75 transition hover:border-emerald-200/30 hover:text-emerald-100">Join the conversation <span>↗</span></Link>
                </div>
                <div className="mt-5">
                  <h1 className="break-words text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">{profile.display_name}</h1>
                  <p className="mt-1.5 text-sm text-white/40">@{profile.username}</p>
                  {profile.headline && <p className="mt-4 max-w-3xl text-base leading-7 text-white/80">{profile.headline}</p>}
                  {(profile.organization || profile.location) && <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45"><span>{profile.organization}</span>{profile.organization && profile.location && <span aria-hidden="true">·</span>}<span>{profile.location}</span></p>}
                </div>
              </div>
            </section>

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
                <p className="px-1 text-[11px] leading-5 text-white/35">Converge profiles help people find shared interests, expertise, and research perspectives.</p>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
