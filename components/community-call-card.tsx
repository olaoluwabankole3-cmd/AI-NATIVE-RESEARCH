"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CallStatus = { configured: boolean; active: boolean; participants: number };

export function CommunityCallCard({ communityId, slug }: { communityId: string; slug: string }) {
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/communities/" + communityId + "/call", {
        cache: "no-store", signal,
      });
      if (!response.ok) throw new Error("Call status unavailable.");
      const result = await response.json() as CallStatus;
      if (signal?.aborted) return;
      setStatus(result);
      setError(false);
    } catch {
      if (!signal?.aborted) setError(true);
    }
  }, [communityId]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(controller.signal);
    }, 20000);
    const onFocus = () => void refresh(controller.signal);
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <section aria-label="Community group call" className="mt-6 flex flex-col gap-4 rounded-2xl border border-emerald-200/15 bg-[#13241c] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3.5">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-200/10 text-xl text-emerald-100">◉</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-sm font-semibold text-white">Community call</h2>
            {status?.active && <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200"><span className="size-1.5 rounded-full bg-emerald-200" />Live now</span>}
          </div>
          <p aria-live="polite" className="mt-1.5 max-w-xl text-xs leading-5 text-white/55">
            {error ? "Live call status is temporarily unavailable." :
              !status ? "Checking for an active call…" :
              !status.configured ? "Group calls are awaiting media-service configuration." :
              status.active ? status.participants + (status.participants === 1 ? " member is" : " members are") + " in the call. Join the conversation." :
              "Start a voice or video conversation. Every approved community member can join."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => void refresh()} aria-label="Refresh call status" className="min-h-11 rounded-xl border border-white/10 px-3.5 text-xs font-medium text-white/65 hover:text-white">Refresh</button>
        {status?.configured ? <Link href={"/communities/" + encodeURIComponent(slug) + "/call"} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-200 px-5 text-xs font-bold text-[#0b1710] hover:bg-emerald-100">{status.active ? "Join call" : "Start call"}</Link> :
          <span className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-xs text-white/35" aria-disabled="true">Call unavailable</span>}
      </div>
    </section>
  );
}
