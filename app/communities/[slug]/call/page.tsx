"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/client";

type Community = { id: string; slug: string; name: string; created_by: string };
type RoomView = { community: Community; canModerate: boolean; authToken: string };

type RtkClient = { init: (config: {
  authToken: string;
  defaults?: { audio: boolean; video: boolean };
}) => Promise<RtkMeetingInstance> };
type RtkMeetingInstance = {
  leave?: () => Promise<void>;
};
type RtkWindow = Window & { RealtimeKitClient?: RtkClient };

const CORE_SCRIPT = "https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@2.0.4/dist/browser.js";
const UI_SCRIPT = "/cloudflare-realtimekit-loader.js";

function loadScript(src: string, isModule = false, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Room navigation cancelled."));
    const existing = Array.from(document.querySelectorAll("script")).find((s) => s.src === new URL(src, location.href).href);
    if (existing?.dataset.rtkReady === "true") return resolve();
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = src;
      if (isModule) script.type = "module";
      else script.async = true;
    }
    const success = () => {
      script.dataset.rtkReady = "true";
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      if (script.isConnected) script.remove();
      reject(new Error("Could not load Cloudflare's meeting controls. Check your connection."));
    };
    const aborted = () => { cleanup(); reject(new Error("Room navigation cancelled.")); };
    const cleanup = () => {
      script.removeEventListener("load", success);
      script.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
    };
    script.addEventListener("load", success);
    script.addEventListener("error", failed);
    signal?.addEventListener("abort", aborted, { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

function CloudflareGroupRoom({ authToken, onLeave }: { authToken: string; onLeave: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const meetingRef = useRef<RtkMeetingInstance | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let initialized = false;
    async function initialize() {
      try {
        await Promise.all([
          loadScript(CORE_SCRIPT, false, controller.signal),
          loadScript(UI_SCRIPT, true, controller.signal),
        ]);
        await customElements.whenDefined("rtk-meeting");
        if (controller.signal.aborted) return;
        const client = (window as RtkWindow).RealtimeKitClient;
        if (!client) throw new Error("Cloudflare meeting SDK is not available.");

        const meeting = await client.init({
          authToken,
          defaults: { audio: false, video: false },
        });
        if (controller.signal.aborted) {
          await meeting.leave?.().catch(() => undefined);
          return;
        }
        meetingRef.current = meeting;
        const element = document.createElement("rtk-meeting") as HTMLElement & {
          meeting?: RtkMeetingInstance;
        };
        element.setAttribute("show-setup-screen", "true");
        element.setAttribute("mode", "fill");
        element.style.cssText = "display:block;width:100%;height:100%;min-height:450px";
        element.meeting = meeting;
        container.current?.replaceChildren(element);
        initialized = true;
        setConnecting(false);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setConnecting(false);
          setError(cause instanceof Error ? cause.message : "Unable to connect to the media service.");
        }
      }
    }
    void initialize();
    return () => {
      controller.abort();
      if (initialized && meetingRef.current?.leave) {
        void meetingRef.current.leave().catch(() => undefined);
      }
      meetingRef.current = null;
      container.current?.replaceChildren();
    };
  }, [authToken]);

  return (
    <section aria-label="Cloudflare community group call" className="mt-5 min-h-[450px] overflow-hidden rounded-2xl border border-emerald-200/15 bg-[#14221b] sm:min-h-[600px]">
      {connecting && <div role="status" className="grid min-h-64 place-items-center p-8 text-center text-sm text-white/60">Connecting securely to Cloudflare group calling…</div>}
      {error && <div className="p-7 text-sm text-red-200" role="alert">{error} <button type="button" onClick={onLeave} className="ml-2 underline">Return to community</button></div>}
      <div ref={container} className="h-[min(72dvh,820px)] min-h-[450px] w-full sm:h-[min(76dvh,920px)] sm:min-h-[600px]" />
    </section>
  );
}

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
  const leave = useCallback(() => router.push(backLink), [backLink, router]);

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
        if (communityError || !community) throw new Error("This community is unavailable.");

        const { data: membership, error: membershipError } = await supabase.from("community_members")
          .select("role").eq("community_id", community.id).eq("user_id", user.id).maybeSingle();
        if (membershipError) throw new Error("We could not confirm community access.");

        const response = await fetch("/api/communities/" + community.id + "/call", {
          method: "POST", cache: "no-store", signal: abortController.signal,
        });
        const payload = await response.json().catch(() => ({})) as { authToken?: string; error?: string };
        if (!response.ok || typeof payload.authToken !== "string") {
          throw new Error(payload.error || "Could not join the community call.");
        }
        if (!cancelled) setView({
          community,
          canModerate: community.created_by === user.id ||
            membership?.role === "OWNER" || membership?.role === "MODERATOR",
          authToken: payload.authToken,
        });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not join the call.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void join();
    return () => { cancelled = true; abortController.abort(); };
  }, [slug, router, supabase]);

  useEffect(() => {
    if (!view) return;
    let cancelled = false;
    const controller = new AbortController();
    const check = async () => {
      try {
        const result = await fetch("/api/communities/" + view.community.id + "/call", {
          cache: "no-store", signal: controller.signal,
        });
        if (!result.ok) return;
        const status = await result.json() as { expired?: boolean };
        if (status.expired && !cancelled) {
          setError("This call reached the 30-minute limit and was ended.");
          setView(null);
        }
      } catch { /* Presence refresh is best effort. */ }
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 20000);
    return () => { cancelled = true; controller.abort(); window.clearInterval(timer); };
  }, [view]);

  async function endForEveryone() {
    if (!view || ending || !window.confirm("End this group call for everyone? All participants will disconnect.")) return;
    setEnding(true);
    setError("");
    try {
      const response = await fetch("/api/communities/" + view.community.id + "/call", {
        method: "DELETE", cache: "no-store",
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not end the call.");
      setView(null);
      leave();
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
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-100/60">Cloudflare RealtimeKit · Converge</p>
            <h1 className="mt-1.5 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{view ? view.community.name : "Community group call"}</h1>
            <p className="mt-2 text-xs leading-5 text-white/50">Only approved community members can join. Keep researching while others speak.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view?.canModerate && <button type="button" onClick={() => void endForEveryone()} disabled={ending}
              className="inline-flex min-h-11 items-center rounded-xl border border-red-300/25 px-4 text-xs font-semibold text-red-200 hover:bg-red-200/10 disabled:opacity-50">
              {ending ? "Ending…" : "End for everyone"}
            </button>}
            <button type="button" onClick={leave} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-xs font-semibold text-white/80 hover:bg-white/10">Leave call</button>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</p>}
        {loading && <div role="status" className="mt-7 grid min-h-60 place-items-center rounded-2xl border border-white/10 bg-[#14221b] p-8 text-center text-sm text-white/60">Checking membership and preparing your Cloudflare call…</div>}
        {!loading && view && <CloudflareGroupRoom authToken={view.authToken} onLeave={leave} />}
        {!loading && !view && <div className="mt-7 rounded-2xl border border-white/10 bg-[#14221b] p-7 sm:p-10">
          <h2 className="text-lg font-semibold">Unable to open the community call</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">Group calling requires an approved community membership and configured Cloudflare RealtimeKit access.</p>
          <Link href={backLink} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-200 px-5 text-xs font-bold text-[#0b1710]">Back to community</Link>
        </div>}
        <p className="mt-4 text-xs leading-5 text-white/40">Microphone and camera are off until you choose to enable them. Calls are not recorded or transcribed by Converge. One community room allows up to 10 participants for 30 minutes during testing.</p>
      </div>
    </main>
  );
}
