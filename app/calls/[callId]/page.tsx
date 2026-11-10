"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type CallStatus = "ringing" | "active" | "ended" | "declined" | "missed" | "failed";
type Call = {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  ring_expires_at: string;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  caller_seen_at: string;
  callee_seen_at: string | null;
  offer_sdp: string | null;
  answer_sdp: string | null;
};

function secondsLabel(total: number) {
  return Math.floor(total / 60).toString().padStart(2, "0") +
    ":" + (total % 60).toString().padStart(2, "0");
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(() => finish(new Error("Network negotiation timed out. Please end this call and try again.")), 15000);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      if (error) reject(error); else resolve();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    onChange();
  });
}

export default function VoiceCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [remoteName, setRemoteName] = useState("Converge member");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mediaState, setMediaState] = useState<"idle" | "starting" | "connecting" | "connected" | "ended">("idle");
  const [muted, setMuted] = useState(false);
  const [requiresPlayback, setRequiresPlayback] = useState(false);
  const [relayWarning, setRelayWarning] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [localMediaReady, setLocalMediaReady] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerPromiseRef = useRef<Promise<RTCPeerConnection> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const offerStarted = useRef(false);
  const answerStarted = useRef(false);
  const remoteApplied = useRef(false);
  const hasEndedRef = useRef(false);

  const closeMedia = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    peerPromiseRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setMediaState("ended");
  }, []);

  const loadCall = useCallback(async () => {
    try {
      const { data, error: loadError } = await supabase.from("voice_calls")
        .select("id,conversation_id,caller_id,callee_id,status,ring_expires_at,created_at,answered_at,ended_at,caller_seen_at,callee_seen_at,offer_sdp,answer_sdp")
        .eq("id", callId).maybeSingle();
      if (loadError) throw loadError;
      if (!data) throw new Error("This call does not exist or is private.");
      setCall(data as Call);
      // Don't erase microphone or WebRTC errors on the next status poll.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this call.");
    } finally {
      setLoading(false);
    }
  }, [callId, supabase]);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data.user) {
        router.replace("/sign-in?next=" + encodeURIComponent("/calls/" + callId));
      } else setViewerId(data.user.id);
    }).catch(() => setError("Please sign in and reopen this call."));
    return () => { alive = false; };
  }, [callId, router, supabase]);

  useEffect(() => {
    if (!viewerId || !callId) return;
    void loadCall();
    const channel = supabase.channel("voice-call-state-" + callId)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "voice_calls",
        filter: "id=eq." + callId,
      }, () => { void loadCall(); })
      .subscribe();
    const interval = window.setInterval(() => { void loadCall(); }, 2500);
    return () => { window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [viewerId, callId, loadCall, supabase]);

  useEffect(() => {
    if (!viewerId || !call) return;
    const other = call.caller_id === viewerId ? call.callee_id : call.caller_id;
    let live = true;
    void supabase.from("profiles").select("display_name").eq("id", other).maybeSingle()
      .then(({ data }) => { if (live) setRemoteName(data?.display_name || "Converge member"); });
    return () => { live = false; };
  }, [viewerId, call?.id, supabase]);

  useEffect(() => {
    if (!call || !viewerId || !["ringing", "active"].includes(call.status)) return;
    const interval = window.setInterval(() => {
      if (call.answered_at) setElapsed(Math.floor((Date.now() - Date.parse(call.answered_at)) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [call?.id, call?.answered_at, call?.status, viewerId]);

  const ensurePeer = useCallback((): Promise<RTCPeerConnection> => {
    if (peerPromiseRef.current) return peerPromiseRef.current;
    setMediaState("starting");
    peerPromiseRef.current = (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
        throw new Error("Voice calling requires a supported browser over HTTPS.");
      }
      const response = await fetch("/api/calls/ice?callId=" + encodeURIComponent(callId), { cache: "no-store" });
      const config = await response.json().catch(() => null) as {
        iceServers?: RTCIceServer[]; warning?: string; error?: string;
      } | null;
      if (!response.ok || !config?.iceServers) {
        throw new Error(config?.error || "Could not load secure call connectivity settings.");
      }
      if (config.warning) setRelayWarning(config.warning);

      // Browser microphone access is consent-based. Never record or store audio.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      setLocalMediaReady(true);
      const peer = new RTCPeerConnection({ iceServers: config.iceServers, iceTransportPolicy: "all" });
      pcRef.current = peer;
      for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);

      peer.ontrack = (event) => {
        const audio = remoteAudioRef.current;
        if (!audio) return;
        audio.srcObject = event.streams[0] || new MediaStream([event.track]);
        void audio.play().then(() => setRequiresPlayback(false)).catch(() => setRequiresPlayback(true));
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setMediaState("connected");
          setError("");
        } else if (peer.connectionState === "failed") {
          setError("Audio connection failed. End this call and try again.");
        } else if (peer.connectionState === "disconnected") {
          setMediaState("connecting");
        }
      };
      setMediaState("connecting");
      return peer;
    })().catch((caught) => {
      closeMedia();
      throw caught;
    });
    return peerPromiseRef.current;
  }, [callId, closeMedia]);

  useEffect(() => {
    if (!call || !viewerId) return;
    if (call.status !== "active") {
      if (call.status !== "ringing" && !hasEndedRef.current) {
        hasEndedRef.current = true;
        closeMedia();
      }
      return;
    }
    if (viewerId === call.caller_id && !call.offer_sdp && !offerStarted.current) {
      offerStarted.current = true;
      void (async () => {
        try {
          const peer = await ensurePeer();
          await peer.setLocalDescription(await peer.createOffer({ offerToReceiveAudio: true }));
          await waitForIceGathering(peer);
          const offer = peer.localDescription?.sdp;
          if (!offer) throw new Error("Could not prepare the audio offer.");
          const { error: saveError } = await supabase.rpc("publish_voice_call_sdp", {
            p_call_id: call.id, p_type: "offer", p_sdp: offer,
          });
          if (saveError) throw saveError;
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not start audio negotiation.");
        }
      })();
    }
    if (viewerId === call.callee_id && call.offer_sdp && !call.answer_sdp && !answerStarted.current) {
      answerStarted.current = true;
      void (async () => {
        try {
          const peer = await ensurePeer();
          await peer.setRemoteDescription({ type: "offer", sdp: call.offer_sdp! });
          await peer.setLocalDescription(await peer.createAnswer());
          await waitForIceGathering(peer);
          const answer = peer.localDescription?.sdp;
          if (!answer) throw new Error("Could not prepare the audio answer.");
          const { error: saveError } = await supabase.rpc("publish_voice_call_sdp", {
            p_call_id: call.id, p_type: "answer", p_sdp: answer,
          });
          if (saveError) throw saveError;
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not answer the audio stream.");
        }
      })();
    }
    if (viewerId === call.caller_id && call.answer_sdp && !remoteApplied.current) {
      remoteApplied.current = true;
      void (async () => {
        try {
          const peer = await ensurePeer();
          await peer.setRemoteDescription({ type: "answer", sdp: call.answer_sdp! });
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not establish remote audio.");
        }
      })();
    }
  }, [call, viewerId, ensurePeer, supabase, closeMedia]);

  useEffect(() => {
    if (!call || !viewerId || !["ringing", "active"].includes(call.status)) return;
    const ping = async () => {
      await supabase.rpc("heartbeat_voice_call", { p_call_id: call.id });
    };
    void ping();
    const interval = window.setInterval(() => { void ping(); }, 15000);
    return () => window.clearInterval(interval);
  }, [call?.id, call?.status, viewerId, supabase]);

  useEffect(() => {
    if (!call || !viewerId) return;
    if (call.status === "ringing" && viewerId === call.caller_id &&
      Date.parse(call.ring_expires_at) < Date.now()) {
      void supabase.rpc("finish_voice_call", { p_call_id: call.id, p_reason: "missed" }).then(() => loadCall());
    }
    if (call.status === "active" && call.answered_at) {
      const peerSeen = viewerId === call.caller_id ? call.callee_seen_at : call.caller_seen_at;
      if (peerSeen && Date.now() - Date.parse(peerSeen) > 60000) {
        void supabase.rpc("finish_voice_call", { p_call_id: call.id, p_reason: "failed" }).then(() => loadCall());
      }
    }
  }, [call, viewerId, loadCall, supabase]);

  useEffect(() => () => {
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function finish(reason: "ended" | "declined" | "missed" | "failed" = "ended") {
    if (!call || busy) return;
    setBusy(true);
    try {
      const { error: finishError } = await supabase.rpc("finish_voice_call", {
        p_call_id: call.id, p_reason: reason,
      });
      if (finishError) throw finishError;
      hasEndedRef.current = true;
      closeMedia();
      router.replace("/messages/" + call.conversation_id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not end this call.");
    } finally {
      setBusy(false);
    }
  }

  async function answer() {
    if (!call || busy) return;
    setBusy(true);
    try {
      const { error: answerError } = await supabase.rpc("answer_voice_call", { p_call_id: call.id });
      if (answerError) throw answerError;
      await loadCall();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not answer the call.");
    } finally {
      setBusy(false);
    }
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  const isCaller = !!call && viewerId === call.caller_id;
  const isCallee = !!call && viewerId === call.callee_id;
  const ended = !!call && !["ringing", "active"].includes(call.status);

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[720px] px-4 pb-24 pt-8 sm:px-6 sm:pt-14">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/messages" className="text-sm font-semibold text-white/55 hover:text-emerald-100">← Messages</Link>
          <span className="rounded-full border border-emerald-200/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-100/80">Converge Voice</span>
        </div>
        <section aria-label="Voice call" className="rounded-[2rem] border border-emerald-200/15 bg-[#101b17] p-6 text-center shadow-2xl sm:p-10">
          <div className="mx-auto grid size-24 place-items-center rounded-full border border-emerald-200/30 bg-emerald-200/[.08] text-4xl text-emerald-100" aria-hidden="true">♫</div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100/75">Private internet call</p>
          <h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">{remoteName}</h1>
          <p role="status" aria-live="polite" className="mt-3 text-sm text-white/60">
            {loading ? "Loading call…" :
              !call ? "Call not found" :
              ended ? ({ ended: "Call ended", declined: "Call declined", missed: "No answer", failed: "Call interrupted" }[call.status as "ended"|"declined"|"missed"|"failed"] || "Call ended") :
              call.status === "ringing" ? isCaller ? "Ringing…" : "Incoming voice call…" :
              mediaState === "connected" ? "Connected · " + secondsLabel(Math.max(0, elapsed)) :
              mediaState === "starting" ? "Requesting microphone permission…" :
              mediaState === "connecting" ? "Connecting encrypted audio…" : "Preparing secure audio…"}
          </p>
          {relayWarning && <p className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/[.05] px-3 py-2 text-xs leading-5 text-amber-100">{relayWarning}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-300/25 bg-red-300/[.06] px-3 py-2 text-sm leading-6 text-red-100">{error}</p>}

          <audio ref={remoteAudioRef} autoPlay playsInline aria-label="Remote call audio" />
          {requiresPlayback && <button type="button" onClick={() => {
            void remoteAudioRef.current?.play().then(() => setRequiresPlayback(false)).catch(() => setError("Tap again to enable speaker audio."));
          }} className="mt-4 min-h-12 rounded-xl border border-emerald-200/25 px-4 text-sm font-semibold text-emerald-100">Tap to hear audio</button>}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {call?.status === "ringing" && isCallee && (
              <button type="button" disabled={busy} onClick={() => void answer()}
                className="min-h-12 rounded-full bg-emerald-200 px-6 text-sm font-bold text-[#11221c] disabled:opacity-50">Answer</button>
            )}
            {call?.status === "active" && (
              <button type="button" disabled={!localMediaReady || ended} onClick={toggleMute}
                aria-pressed={muted}
                className="min-h-12 min-w-28 rounded-full border border-white/20 bg-white/[.04] px-5 text-sm font-semibold text-white disabled:opacity-40">{muted ? "Unmute" : "Mute"}</button>
            )}
            {call && !ended && (
              <button type="button" onClick={() => void finish("ended")} disabled={busy}
                className="min-h-12 min-w-32 rounded-full bg-red-400 px-6 text-sm font-bold text-[#23100e] disabled:opacity-40">{busy ? "Ending…" : isCaller && call.status === "ringing" ? "Cancel call" : "End call"}</button>
            )}
            {ended && (
              <Link href={"/messages/" + call.conversation_id} className="inline-flex min-h-12 items-center rounded-full bg-emerald-200 px-6 text-sm font-bold text-[#11221c]">Return to messages</Link>
            )}
          </div>
          <p className="mt-6 text-xs leading-6 text-white/35">Microphone access is required. Converge does not record audio. Leave the call using End call.</p>
        </section>
      </div>
    </main>
  );
}
