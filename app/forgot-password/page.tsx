"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { WordParticles } from "@/components/word-particles";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [badLink, setBadLink] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBadLink(new URLSearchParams(window.location.search).has("auth_error"));
  }, []);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("idle");

    try {
      const callback = window.location.origin + "/auth/callback?next=%2Freset-password";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: callback });
      setStatus(error ? "error" : "success");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate min-h-screen bg-[#0b1110] text-[#f4f8f5]">
      <WordParticles />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_70%_20%,rgba(43,112,75,0.2),transparent_50%)]" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[980px] flex-col px-5 sm:px-8">
        <header className="flex h-[82px] items-center justify-between border-b border-white/[0.08]">
          <Link href="/" className="text-[19px] font-bold tracking-[-0.06em]">converge<span className="text-[#a4edc1]">.</span></Link>
          <Link href="/sign-in" className="text-[12px] font-semibold text-[#a4edc1] hover:text-white">Back to sign in ↗</Link>
        </header>
        <div className="flex flex-1 items-center justify-center py-12">
          <section className="w-full max-w-[480px] rounded-[28px] border border-white/[0.11] bg-[#101815]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.36)] sm:p-9">
            <span className="mb-5 grid size-12 place-items-center rounded-[16px] bg-emerald-200/[0.08] text-2xl text-[#a4edc1]" aria-hidden="true">✳</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a4edc1]">Account recovery</p>
            <h1 className="mt-3 text-[35px] font-bold tracking-[-0.065em]">Reset your password.</h1>
            <p className="mt-3 text-[13px] leading-6 text-white/55">
              Enter your Converge account email and we&apos;ll send you instructions to choose a new password.
            </p>
            {badLink && (
              <p role="alert" className="mt-5 rounded-xl border border-amber-200/20 bg-amber-200/[0.06] p-4 text-[12px] leading-6 text-amber-100">
                The previous recovery link could not be used. Request a fresh email below.
              </p>
            )}
            <form onSubmit={requestRecovery} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-[12px] font-semibold text-white/75">Email address</span>
                <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-[52px] w-full rounded-[13px] border border-white/[0.11] bg-[#0b1110] px-4 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#a4edc1]/65"
                />
              </label>
              {status === "success" && (
                <p role="status" className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.06] p-4 text-[12px] leading-6 text-[#b9f2cd]">
                  If an account exists for this address, you&apos;ll receive a reset email. Check your inbox and spam folder.
                </p>
              )}
              {status === "error" && (
                <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[0.06] p-4 text-[12px] leading-6 text-red-200">
                  We couldn&apos;t request a reset link right now. Please try again later.
                </p>
              )}
              <button type="submit" disabled={busy}
                className="flex h-[53px] w-full items-center justify-center rounded-full bg-[#a4edc1] px-5 text-[13px] font-extrabold text-[#102219] hover:bg-[#c1f7d3] disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? "Sending instructions…" : "Email me a reset link"}
              </button>
            </form>
            <p className="mt-6 text-center text-[12px] text-white/45">
              Remember your password? <Link href="/sign-in" className="font-bold text-[#a4edc1] hover:text-white">Sign in</Link>
            </p>
          </section>
        </div>
        <footer className="border-t border-white/[0.07] py-5 text-[10px] text-white/35">© {new Date().getFullYear()} Converge</footer>
      </div>
    </main>
  );
}
