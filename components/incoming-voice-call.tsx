"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type IncomingCall = {
  id: string;
  caller_id: string;
  callee_id: string;
  status: string;
  call_type: "audio" | "video";
  ring_expires_at: string;
};

export function IncomingVoiceCall() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [callerName, setCallerName] = useState("Converge member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const checkIncoming = useCallback(async (userId: string) => {
    try {
      const { data, error: loadError } = await supabase.from("voice_calls")
        .select("id,caller_id,callee_id,status,call_type,ring_expires_at")
        .eq("callee_id", userId).eq("status", "ringing")
        .gt("ring_expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1);
      if (loadError) return; // Feature may not have been migrated yet.
      setIncoming((data?.[0] as IncomingCall | undefined) ?? null);
    } catch {
      // Calls are optional; never interrupt unrelated Converge pages.
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setViewerId(data.user?.id ?? null);
    }).catch(() => {});
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setViewerId(session?.user.id ?? null);
    });
    return () => { active = false; auth.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (!viewerId) return;
    void checkIncoming(viewerId);
    const channel = supabase.channel("incoming-voice-calls-" + viewerId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "voice_calls",
        filter: "callee_id=eq." + viewerId,
      }, () => { void checkIncoming(viewerId); })
      .subscribe();
    const interval = window.setInterval(() => { void checkIncoming(viewerId); }, 8000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
      setIncoming(null);
    };
  }, [viewerId, checkIncoming, supabase]);

  useEffect(() => {
    if (!incoming) return;
    let active = true;
    void supabase.from("profiles").select("display_name")
      .eq("id", incoming.caller_id).maybeSingle().then(({ data }) => {
        if (active) setCallerName(data?.display_name || "Converge member");
      });
    return () => { active = false; };
  }, [incoming, supabase]);

  async function respond(action: "answer" | "decline") {
    if (!incoming || busy) return;
    setBusy(true);
    setError("");
    try {
      const callId = incoming.id;
      const { error: actionError } = action === "answer"
        ? await supabase.rpc("answer_voice_call", { p_call_id: callId })
        : await supabase.rpc("finish_voice_call", { p_call_id: callId, p_reason: "declined" });
      if (actionError) throw actionError;
      setIncoming(null);
      if (action === "answer") router.push("/calls/" + callId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not respond to the call.");
      if (viewerId) void checkIncoming(viewerId);
    } finally {
      setBusy(false);
    }
  }

  if (!viewerId || !incoming || Date.parse(incoming.ring_expires_at) <= Date.now()) return null;

  return (
    <aside role="alertdialog" aria-label={incoming.call_type === "video" ? "Incoming video call" : "Incoming voice call"} aria-live="assertive"
      className="fixed bottom-[max(95px,env(safe-area-inset-bottom))] right-4 z-[220] w-[min(calc(100vw-2rem),365px)] rounded-2xl border border-emerald-200/35 bg-[#11221c] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,.65)] sm:bottom-6">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-200">Incoming Converge {incoming.call_type === "video" ? "video" : "voice"} call</p>
      <h2 className="mt-2 break-words text-lg font-semibold">{callerName}</h2>
      <p className="mt-1 text-xs leading-5 text-white/60">{incoming.call_type === "video" ? "Camera and microphone permission requested after you answer." : "Private audio call"} · Internet required</p>
      {error && <p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => void respond("decline")} disabled={busy}
          className="min-h-12 rounded-xl border border-red-300/30 bg-red-300/[.06] px-4 text-sm font-semibold text-red-100 disabled:opacity-50">Decline</button>
        <button type="button" onClick={() => void respond("answer")} disabled={busy}
          className="min-h-12 rounded-xl bg-emerald-200 px-4 text-sm font-bold text-[#11221c] disabled:opacity-50">{busy ? "Working…" : "Answer"}</button>
      </div>
    </aside>
  );
}
