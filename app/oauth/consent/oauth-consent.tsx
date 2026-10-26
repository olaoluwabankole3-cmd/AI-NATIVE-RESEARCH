"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthorizationDetails = {
  authorization_id?: string;
  redirect_url?: string;
  scope?: string;
  client?: { name?: string };
};

export default function OAuthConsent({ authorizationId }: { authorizationId: string }) {
  const [supabase] = useState(() => createClient());
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAuthorization() {
      if (!authorizationId) {
        setError("This sign-in request is missing its authorization reference. Please return to the app and try again.");
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        const redirect = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        window.location.replace(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;

      if (detailsError || !data) {
        setError(detailsError?.message ?? "We could not validate this sign-in request. Please start again from Medical Intelligence.");
        setLoading(false);
        return;
      }

      const payload = data as unknown as AuthorizationDetails;
      if (payload.redirect_url && !payload.authorization_id) {
        window.location.replace(payload.redirect_url);
        return;
      }

      if (!payload.authorization_id || !payload.client) {
        setError("This authorization request is incomplete or has expired. Please start again from Medical Intelligence.");
        setLoading(false);
        return;
      }

      setDetails(payload);
      setLoading(false);
    }

    void loadAuthorization();
    return () => { cancelled = true; };
  }, [authorizationId, supabase]);

  async function decide(approved: boolean) {
    if (!authorizationId || busy) return;
    setBusy(true);
    setError("");

    const result = approved
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);

    if (result.error || !result.data?.redirect_url) {
      setError(result.error?.message ?? "We could not complete this authorization. Please try again.");
      setBusy(false);
      return;
    }

    window.location.assign(result.data.redirect_url);
  }

  const scopes = (details?.scope ?? "").split(" ").filter(Boolean);

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1110] px-5 py-12 text-[#f4f8f5]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_18%,rgba(43,112,75,0.22),transparent_42%),linear-gradient(115deg,rgba(7,14,11,0.18),rgba(7,14,11,0.72))]" />
      <section className="relative z-10 w-full max-w-[520px] rounded-[28px] border border-white/[0.11] bg-[#101815]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-9">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-[12px] font-semibold text-white/50 transition hover:text-white/85">
          <ArrowLeft size={15} /> Back to Converge
        </Link>

        <div className="mb-6 grid size-12 place-items-center rounded-[16px] border border-emerald-200/20 bg-emerald-200/[0.08] text-[#a4edc1]">
          <ShieldCheck size={22} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a4edc1]">Converge identity</p>
        <h1 className="mt-3 text-[32px] font-bold leading-tight tracking-[-0.065em]">Continue to another workspace</h1>
        <p className="mt-3 text-[13px] leading-6 text-white/55">
          Converge will confirm your identity so you can use the same account across connected workspaces.
        </p>

        {loading ? (
          <p className="mt-7 rounded-[14px] border border-white/10 bg-white/[0.03] p-4 text-[13px] text-white/60">Checking this sign-in request…</p>
        ) : details ? (
          <div className="mt-7 rounded-[18px] border border-white/[0.1] bg-white/[0.03] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Requesting workspace</p>
            <h2 className="mt-2 text-[19px] font-bold tracking-[-0.03em]">{details.client?.name ?? "Connected workspace"}</h2>
            <p className="mt-2 text-[12px] leading-5 text-white/55">
              This request shares your verified identity details only. It does not grant access to your Converge research, conversations, or community data.
            </p>
            {scopes.length > 0 && (
              <div className="mt-5 border-t border-white/[0.08] pt-4">
                <p className="text-[11px] font-semibold text-white/65">Requested identity information</p>
                <ul className="mt-2 space-y-2">
                  {scopes.map((scope) => (
                    <li key={scope} className="flex items-center gap-2 text-[12px] text-white/55">
                      <span className="size-1.5 rounded-full bg-[#a4edc1]" />
                      {scope === "openid" ? "Confirm your Converge identity" : scope === "email" ? "Email address" : scope === "profile" ? "Basic profile information" : scope}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {error && <p role="alert" className="mt-5 rounded-[12px] border border-red-300/20 bg-red-300/[0.06] px-4 py-3 text-[12px] leading-5 text-red-200">{error}</p>}

        {details && !loading && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={busy} onClick={() => void decide(true)} className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-[#a4edc1] px-5 text-[12px] font-extrabold text-[#102219] transition hover:bg-[#c1f7d3] disabled:opacity-60">
              {busy ? "Please wait…" : "Continue"} {!busy && <ArrowRight size={16} />}
            </button>
            <button type="button" disabled={busy} onClick={() => void decide(false)} className="h-[50px] rounded-full border border-white/15 px-5 text-[12px] font-bold text-white/70 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-60">
              Decline
            </button>
          </div>
        )}

        <p className="mt-6 text-[10px] leading-5 text-white/35">
          You stay in control. Medical Intelligence applies its own patient, hospital-membership, and workspace permissions after sign-in.
        </p>
      </section>
    </main>
  );
}
