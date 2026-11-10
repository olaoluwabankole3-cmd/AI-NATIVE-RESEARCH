"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { WordParticles } from "@/components/word-particles";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [checking, setChecking] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [signOutIssue, setSignOutIssue] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      setSessionReady(!authError && Boolean(data.user));
      setChecking(false);
    }).catch(() => {
      if (active) { setSessionReady(false); setChecking(false); }
    });
    return () => { active = false; };
  }, [supabase]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !sessionReady) return;
    if (password.length < 8) {
      setError("Please use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setPassword("");
      setConfirmation("");
      setSuccess(true);
      // A new login with the updated password is required after recovery.
      // Supabase signOut may return an error without throwing.
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) setSignOutIssue(true);
      } catch {
        setSignOutIssue(true);
      }
    } catch {
      setError("We could not update your password. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate min-h-screen bg-[#0b1110] text-[#f4f8f5]">
      <WordParticles />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_70%_20%,rgba(43,112,75,0.2),transparent_50%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[980px] flex-col px-5 sm:px-8">
        <header className="flex h-[82px] items-center justify-between border-b border-white/[0.08]">
          <Link href="/" className="text-[19px] font-bold tracking-[-0.06em]">converge<span className="text-[#a4edc1]">.</span></Link>
          <Link href="/sign-in" className="text-[12px] font-semibold text-[#a4edc1] hover:text-white">Sign in ↗</Link>
        </header>
        <div className="flex flex-1 items-center justify-center py-12">
          <section className="w-full max-w-[480px] rounded-[28px] border border-white/[0.11] bg-[#101815]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.36)] sm:p-9">
            <span className="mb-5 grid size-12 place-items-center rounded-[16px] bg-emerald-200/[0.08] text-2xl text-[#a4edc1]" aria-hidden="true">✳</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a4edc1]">Account recovery</p>
            <h1 className="mt-3 text-[35px] font-bold tracking-[-0.065em]">Choose a new password.</h1>
            {checking ? (
              <p role="status" className="mt-6 text-[13px] leading-6 text-white/55">Checking your recovery session…</p>
            ) : success ? (
              <div className="mt-6 space-y-5">
                <p role="status" className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.06] p-4 text-[13px] leading-6 text-[#b9f2cd]">
                  Your password was updated. Sign in again with your new password.
                </p>
                {signOutIssue && <p role="alert" className="rounded-xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-[12px] leading-6 text-amber-100">Your password changed, but we could not end this session automatically. Please use the account menu to sign out before signing in again.</p>}
                <Link href="/sign-in" className="flex h-[52px] items-center justify-center rounded-full bg-[#a4edc1] text-[13px] font-extrabold text-[#102219]">Return to sign in ↗</Link>
              </div>
            ) : !sessionReady ? (
              <div className="mt-6 space-y-4">
                <p role="alert" className="text-[13px] leading-6 text-red-200">
                  This recovery link is invalid, expired, or has already been used. Request a new one.
                </p>
                <Link href="/forgot-password" className="inline-block text-[13px] font-bold text-[#a4edc1] hover:text-white">Request a new link ↗</Link>
              </div>
            ) : (
              <form onSubmit={changePassword} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-[12px] font-semibold text-white/75">New password</span>
                  <input type="password" minLength={8} required autoComplete="new-password" value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-[52px] w-full rounded-[13px] border border-white/[0.11] bg-[#0b1110] px-4 text-[13px] text-white outline-none focus:border-[#a4edc1]/65"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-semibold text-white/75">Confirm new password</span>
                  <input type="password" minLength={8} required autoComplete="new-password" value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className="h-[52px] w-full rounded-[13px] border border-white/[0.11] bg-[#0b1110] px-4 text-[13px] text-white outline-none focus:border-[#a4edc1]/65"
                  />
                </label>
                {error && <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-[12px] text-red-200">{error}</p>}
                <button type="submit" disabled={busy} className="flex h-[53px] w-full items-center justify-center rounded-full bg-[#a4edc1] text-[13px] font-extrabold text-[#102219] hover:bg-[#c1f7d3] disabled:opacity-60">
                  {busy ? "Updating password…" : "Update password"}
                </button>
              </form>
            )}
          </section>
        </div>
        <footer className="border-t border-white/[0.07] py-5 text-[10px] text-white/35">© {new Date().getFullYear()} Converge</footer>
      </div>
    </main>
  );
}
