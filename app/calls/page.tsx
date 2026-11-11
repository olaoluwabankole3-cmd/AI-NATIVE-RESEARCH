"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type RecentCall = {
  id: string;
  caller_id: string;
  callee_id: string;
  conversation_id: string;
  status: "ringing" | "active" | "ended" | "declined" | "missed" | "failed";
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  ring_expires_at: string;
};

const label = (call: RecentCall, viewerId: string) => {
  if (call.status === "ringing" && new Date(call.ring_expires_at).getTime() < Date.now()) return "Missed";
  if (call.status === "missed") return "Missed";
  if (call.status === "declined") return "Declined";
  if (call.status === "failed") return "Interrupted";
  if (call.status === "active") return "In progress";
  if (call.status === "ringing") return call.caller_id === viewerId ? "Calling" : "Incoming";
  return call.caller_id === viewerId ? "Outgoing" : "Incoming";
};

export default function CallsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCalls = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase.from("voice_calls")
        .select("id,caller_id,callee_id,conversation_id,status,created_at,answered_at,ended_at,ring_expires_at")
        .or("caller_id.eq." + id + ",callee_id.eq." + id)
        .order("created_at", { ascending: false }).limit(60);
      if (fetchError) throw fetchError;
      const rows = (data ?? []) as RecentCall[];
      setCalls(rows);
      const ids = Array.from(new Set(rows.map((call) =>
        call.caller_id === id ? call.callee_id : call.caller_id)));
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles")
          .select("id,display_name").in("id", ids);
        setNames(Object.fromEntries((profiles ?? []).map((profile) =>
          [profile.id, profile.display_name || "Converge member"])));
      }
      setError("");
    } catch {
      setError("Could not load voice call history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) router.replace("/sign-in?next=%2Fcalls");
      else setViewerId(data.user.id);
    }).catch(() => setError("Please sign in to see your calls."));
    return () => { active = false; };
  }, [supabase, router]);

  useEffect(() => {
    if (viewerId) void loadCalls(viewerId);
  }, [viewerId, loadCalls]);

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-7 sm:pt-12">
        <nav aria-label="Messaging navigation" className="flex flex-wrap gap-2">
          <Link href="/messages" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-xs font-semibold text-white/65 hover:text-white">Messages</Link>
          <span aria-current="page" className="inline-flex min-h-11 items-center rounded-full bg-emerald-200 px-5 text-xs font-bold text-[#0e2419]">Calls</span>
        </nav>
        <h1 className="mt-7 text-3xl font-semibold tracking-tight sm:text-4xl">Voice calls</h1>
        <p className="mt-3 text-sm leading-7 text-white/50">Private internet audio between Converge members. Calls are available once a message request is accepted.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/messages" className="inline-flex min-h-11 items-center rounded-full bg-emerald-200 px-5 text-xs font-bold text-[#0e2419]">Choose a conversation ↗</Link>
          <button type="button" onClick={() => viewerId && void loadCalls(viewerId)} disabled={loading || !viewerId}
            className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-xs font-semibold text-white/70 disabled:opacity-40">
            {loading ? "Loading…" : "Refresh history"}
          </button>
        </div>
        {error && <div role="alert" className="mt-6 rounded-2xl border border-red-300/20 p-4 text-sm text-red-100">{error}</div>}
        <section aria-label="Recent voice calls" className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#101815]">
          {loading ? <p role="status" className="p-7 text-sm text-white/45">Loading calls…</p> :
            calls.length === 0 ? <div className="p-9 text-center">
              <p className="text-lg font-semibold">No calls yet</p>
              <p className="mt-2 text-sm leading-6 text-white/45">Open an accepted conversation and tap Voice call to begin.</p>
            </div> :
            <div className="divide-y divide-white/[.07]">
              {calls.map((call) => {
                const other = call.caller_id === viewerId ? call.callee_id : call.caller_id;
                const status = label(call, viewerId ?? "");
                return <article key={call.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
                  <div className="grid size-11 shrink-0 place-items-center rounded-full border border-emerald-200/15 bg-emerald-200/[.07] text-lg text-emerald-100" aria-hidden="true">☎</div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">{names[other] || "Converge member"}</h2>
                    <p className="mt-1 text-xs text-white/50">{status} · {new Date(call.created_at).toLocaleString()}</p>
                  </div>
                  {call.status === "ringing" && Date.parse(call.ring_expires_at) > Date.now()
                    ? <Link href={"/calls/" + call.id} className="inline-flex min-h-11 items-center rounded-full bg-emerald-200 px-4 text-xs font-bold text-[#11221c]">Open call</Link>
                    : <Link href={"/messages/" + call.conversation_id} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-xs font-semibold text-white/65 hover:text-emerald-100">Message ↗</Link>}
                </article>;
              })}
            </div>}
        </section>
        <p className="mt-5 text-xs leading-6 text-white/40">Calls use your internet connection, not your mobile carrier minutes. No call audio is recorded. An open browser tab is currently required to receive an incoming call alert.</p>
      </div>
    </main>
  );
}
