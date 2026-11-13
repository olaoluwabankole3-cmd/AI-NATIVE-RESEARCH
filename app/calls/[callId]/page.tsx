"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { voiceCallsEnabled } from "@/lib/voice-calls-config";

type CallStatus = "ringing" | "active" | "ended" | "declined" | "missed" | "failed";
type Call = {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  call_type: "audio" | "video";
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

function VoiceCallPageEnabled() {
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
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [requiresPlayback, setRequiresPlayback] = useState(false);
  const [relayWarning, setRelayWarning] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [localMediaReady, setLocalMediaReady] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerPromiseRef = useRef<Promise<RTCPeerConnection> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
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
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setLocalMediaReady(false);
    setMediaState("ended");
  }, []);

  const loadCall = useCallback(async () => {
    try {
      const { data, error: loadError } = await supabase.from("voice_calls")
        .select("id,conversation_id,caller_id,callee_id,status,call_type,ring_expires_at,created_at,answered_at,ended_at,caller_seen_at,callee_seen_at,offer_sdp,answer_sdp")
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
        throw new Error("Calling requires a supported browser over HTTPS.");
      }
      const response = await fetch("/api/calls/ice?callId=" + encodeURIComponent(callId), { cache: "no-store" });
      const config = await response.json().catch(() => null) as {
        iceServers?: RTCIceServer[]; warning?: string; error?: string;
      } | null;
      if (!response.ok || !config?.iceServers) {
        throw new Error(config?.error || "Could not load secure call connectivity settings.");
      }
      if (config.warning) setRelayWarning(config.warning);

      // Media permission is requested only after the call is answered. Calls
      // never record, upload or store camera frames or microphone audio.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: call?.call_type === "video"
          ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } }
          : false,
      });
      if (call?.call_type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        void localVideoRef.current.play().catch(() => {});
      }
      localStreamRef.current = stream;
      setLocalMediaReady(true);
      const peer = new RTCPeerConnection({ iceServers: config.iceServers, iceTransportPolicy: "all" });
      pcRef.current = peer;
      for (const track of stream.getTracks()) peer.addTrack(track, stream);

      peer.ontrack = (event) => {
        const media = call?.call_type === "video" ? remoteVideoRef.current : remoteAudioRef.current;
        if (!media) return;
        const currentStream = media.srcObject instanceof MediaStream ? media.srcObject : null;
        const stream = event.streams[0] || currentStream || new MediaStream();
        if (!event.streams[0] && !stream.getTracks().includes(event.track)) stream.addTrack(event.track);
        media.srcObject = stream;
        void media.play().then(() => setRequiresPlayback(false)).catch(() => setRequiresPlayback(true));
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setMediaState("connected");
          setError("");
        } else if (peer.connectionState === "failed") {
          setError("Call connection failed. End this call and try again.");
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
  }, [callId, call?.call_type, closeMedia]);

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

  function toggleCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraEnabled(track.enabled);
  }

  async function switchCamera() {
    const peer = pcRef.current;
    const stream = localStreamRef.current;
    const currentTrack = stream?.getVideoTracks()[0];
    if (!peer || !stream || !currentTrack || switchingCamera) return;
    const sender = peer.getSenders().find((item) => item.track === currentTrack);
    if (!sender) return;
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    setSwitchingCamera(true);
    let fresh: MediaStream | null = null;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newTrack = fresh.getVideoTracks()[0];
      if (!newTrack) throw new Error("This camera is unavailable.");
      newTrack.enabled = cameraEnabled;
      await sender.replaceTrack(newTrack);
      stream.removeTrack(currentTrack);
      stream.addTrack(newTrack);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        void localVideoRef.current.play().catch(() => {});
      }
      currentTrack.stop();
      setCameraFacing(nextFacing);
    } catch (caught) {
      fresh?.getTracks().forEach((track) => track.stop());
      setError(caught instanceof Error ? caught.message : "Could not switch cameras.");
    } finally {
      setSwitchingCamera(false);
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
  const isVideoCall = call?.call_type === "video";

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[720px] px-4 pb-24 pt-8 sm:px-6 sm:pt-14">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/messages" className="text-sm font-semibold text-white/55 hover:text-emerald-100">← Messages</Link>
          <span className="rounded-full border border-emerald-200/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-100/80">Converge {isVideoCall ? "Video" : "Voice"}</span>
        </div>
        <section aria-label={isVideoCall ? "Video call" : "Voice call"} className="rounded-[1.5rem] border border-emerald-200/15 bg-[#101b17] p-4 text-center shadow-2xl sm:p-7">
          {isVideoCall ? (
            <div className="relative mx-auto aspect-[9/12] max-h-[min(56dvh,490px)] w-full overflow-hidden rounded-2xl bg-[#07100c] sm:aspect-video">
              <video ref={remoteVideoRef} autoPlay playsInline aria-label="Remote video and call audio" className="size-full object-contain" />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white">
                {mediaState === "connected" ? remoteName : "Waiting for video…"}
              </div>
              <div className="absolute right-3 top-3 w-[28%] min-w-[90px] max-w-[155px] overflow-hidden rounded-xl border border-white/25 bg-[#1c2a20] shadow-lg">
                <video ref={localVideoRef} autoPlay muted playsInline aria-label="Your camera preview" className="aspect-[3/4] w-full object-cover -scale-x-100 sm:aspect-video" />
                {!cameraEnabled && <span className="absolute inset-0 flex items-center justify-center bg-[#17251c]/90 text-xs text-white/85">Camera off</span>}
              </div>
            </div>
          ) : (
            <div className="mx-auto grid size-24 place-items-center rounded-full border border-emerald-200/30 bg-emerald-200/[.08] text-4xl text-emerald-100" aria-hidden="true">♫</div>
          )}
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100/75">Private internet call</p>
          <h1 className="mt-2 break-words text-2xl font-semibold sm:text-3xl">{remoteName}</h1>
          <p role="status" aria-live="polite" className="mt-3 text-sm text-white/60">
            {loading ? "Loading call…" :
              !call ? "Call not found" :
              ended ? ({ ended: "Call ended", declined: "Call declined", missed: "No answer", failed: "Call interrupted" }[call.status as "ended"|"declined"|"missed"|"failed"] || "Call ended") :
              call.status === "ringing" ? isCaller ? "Ringing…" : isVideoCall ? "Incoming video call…" : "Incoming voice call…" :
              mediaState === "connected" ? "Connected · " + secondsLabel(Math.max(0, elapsed)) :
              mediaState === "starting" ? isVideoCall ? "Requesting camera and microphone permission…" : "Requesting microphone permission…" :
              mediaState === "connecting" ? "Connecting encrypted media…" : "Preparing secure call…"}
          </p>
          {relayWarning && <p className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/[.05] px-3 py-2 text-xs leading-5 text-amber-100">{relayWarning}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-300/25 bg-red-300/[.06] px-3 py-2 text-sm leading-6 text-red-100">{error}</p>}

          <audio ref={remoteAudioRef} autoPlay playsInline aria-label="Remote call audio" />
          {requiresPlayback && <button type="button" onClick={() => {
            const media = isVideoCall ? remoteVideoRef.current : remoteAudioRef.current;
            void media?.play().then(() => setRequiresPlayback(false)).catch(() => setError("Tap again to enable playback."));
          }} className="mt-4 min-h-12 rounded-xl border border-emerald-200/25 px-4 text-sm font-semibold text-emerald-100">
            Tap to hear {isVideoCall ? "and see" : ""} the other person
          </button>}

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
            {isVideoCall && call?.status === "active" && (
              <>
                <button type="button" disabled={!localMediaReady || ended} onClick={toggleCamera}
                  aria-pressed={!cameraEnabled} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                  className="min-h-12 rounded-full border border-white/20 bg-white/[.04] px-5 text-sm font-semibold text-white disabled:opacity-40">
                  {cameraEnabled ? "Camera off" : "Camera on"}
                </button>
                <button type="button" disabled={!localMediaReady || ended || switchingCamera} onClick={() => void switchCamera()}
                  aria-label="Switch front and rear camera"
                  className="min-h-12 rounded-full border border-white/20 bg-white/[.04] px-5 text-sm font-semibold text-white disabled:opacity-40">
                  {switchingCamera ? "Switching…" : "Flip camera"}
                </button>
              </>
            )}
            {call && !ended && (
              <button type="button" onClick={() => void finish("ended")} disabled={busy}
                className="min-h-12 min-w-32 rounded-full bg-red-400 px-6 text-sm font-bold text-[#23100e] disabled:opacity-40">{busy ? "Ending…" : isCaller && call.status === "ringing" ? "Cancel call" : "End call"}</button>
            )}
            {ended && (
              <Link href={"/messages/" + call.conversation_id} className="inline-flex min-h-12 items-center rounded-full bg-emerald-200 px-6 text-sm font-bold text-[#11221c]">Return to messages</Link>
            )}
          </div>
          <p className="mt-6 text-xs leading-6 text-white/35">Allow camera and microphone access for video calls. Converge does not record or upload call media. Select End call to disconnect.</p>
        </section>
      </div>
    </main>
  );
}

export default function VoiceCallPage() {
  if (voiceCallsEnabled) return <VoiceCallPageEnabled />;
  return <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
    <SiteHeader />
    <section className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/messages" className="text-sm text-emerald-200">← Messages</Link>
      <h1 className="mt-7 text-3xl font-semibold">Voice calls are not enabled</h1>
      <p className="mt-3 text-sm text-white/60">Call testing requires the voice database migration and working relay.</p>
    </section>
  </main>;
}
