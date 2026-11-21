"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/client";

type Community = { id: string; slug: string; name: string; created_by: string };
type RoomView = { community: Community; canModerate: boolean; joinUrl: string };

export default function CommunityCallPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<RoomView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const slug = params.slug;
  const backLink = "/communities/" + encodeURIComponent(slug || "");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const abortController = new AbortController();

    async function join() {
      setLoading(true);
      setError("");
      setView(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          router.replace("/sign-in?next=" + encodeURIComponent("/communities/" + slug + "/call"));
          return;
        }

        const { data: community, error: communityError } = await supabase.from("communities")
          .select("id,name,slug,created_by").eq("slug", slug).maybeSingle();
        if (communityError || !community) throw new Error("This community is not available.");

        const { data: membership, error: membershipError } = await supabase.from("community_members")
          .select("role").eq("community_id", community.id).eq("user_id", user.id).maybeSingle();
        if (membershipError) throw new Error("We could not confirm community access.");

        const response = await fetch("/api/communities/" + community.id + "/call", {
          method: "POST",
          cache: "no-store",
          signal: abortController.signal,
        });
        const payload = await response.json().catch(() => ({})) as { joinUrl?: string; error?: string };
        if (!response.ok || typeof payload.joinUrl !== "string") {
          throw new Error(payload.error || "Could not join the community call.");
        }

        // The server checks active membership and bans. This local role is
        // presentation-only; moderator actions are checked on the server again.
        if (!cancelled) {
          setView({
            community,
            canModerate: community.created_by === user.id ||
              membership?.role === "OWNER" || membership?.role === "MODERATOR",
            joinUrl: payload.joinUrl,
          });
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not join the call.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void join();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [slug, router, supabase]);

  async function endForEveryone() {
    if (!view || ending || !window.confirm("End this community call for everyone? All participants will be disconnected.")) return;
    setEnding(true);
    setError("");
    try {
      const response = await fetch("/api/communities/" + view.community.id + "/call", {
        method: "DELETE",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not end the call.");
      setView(null);
      router.push(backLink);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not end the call.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] pb-24 text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-7 lg:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="min-w-0">
            <Link href={backLink} className="text-xs font-semibold text-emerald-200/80 hover:text-emerald-100">← Back to community</Link>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-100/60">Live conversations · Converge</p>
            <h1 className="mt-1.5 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{view ? view.community.name : "Community group call"}</h1>
            <p className="mt-2 text-xs leading-5 text-white/50">Video and voice for approved community members. Your discussions stay in the community.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view?.canModerate && <button type="button" onClick={() => void endForEveryone()} disabled={ending}
              className="inline-flex min-h-11 items-center rounded-xl border border-red-300/25 px-4 text-xs font-semibold text-red-200 hover:bg-red-200/10 disabled:opacity-50">
              {ending ? "Ending…" : "End for everyone"}
            </button>}
            <Link href={backLink} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-xs font-semibold text-white/80 hover:bg-white/10">Leave call</Link>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</p>}
        {loading && <div role="status" className="mt-7 flex min-h-60 items-center justify-center rounded-2xl border border-white/10 bg-[#14221b] p-8 text-center text-sm text-white/60">Checking your community membership and connecting to the room…</div>}
        {!loading && view && <section aria-label="Live community group call" className="mt-5 overflow-hidden rounded-2xl border border-emerald-200/15 bg-[#14221b]">
          <iframe
            title={"Group call for " + view.community.name}
            src={view.joinUrl}
            allow="microphone; camera; autoplay; fullscreen; display-capture"
            referrerPolicy="no-referrer"
            className="block h-[min(72dvh,820px)] min-h-[440px] w-full border-0 sm:h-[min(76dvh,920px)] sm:min-h-[600px]"
          />
        </section>}
        {!loading && !view && <div className="mt-7 rounded-2xl border border-white/10 bg-[#14221b] p-7 sm:p-10">
          <h2 className="text-lg font-semibold">Unable to open the community call</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">Only approved members can join. If calling has not been configured yet, the community discussion is still available.</p>
          <Link href={backLink} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-200 px-5 text-xs font-bold text-[#0b1710]">Back to community</Link>
        </div>}
        <p className="mt-4 text-xs leading-5 text-white/40">Your browser may request microphone and camera permission. You choose when to turn them on. Calls use encrypted transport; they are not recorded by Converge. Leaving closes this call window but does not end the room for others.</p>
      </div>
    </main>
  );
}
