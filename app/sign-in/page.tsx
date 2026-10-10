"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WordParticles } from "@/components/word-particles";

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/communities");
    router.refresh();
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#0b1110] text-[#f4f8f5]">
      <WordParticles />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(ellipse_at_18%_18%,rgba(43,112,75,0.22),transparent_42%),linear-gradient(115deg,rgba(7,14,11,0.18),rgba(7,14,11,0.72))]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex h-[82px] shrink-0 items-center justify-between border-b border-white/[0.08]">
          <Link href="/" aria-label="Converge home" className="group flex items-center gap-3">
            <span className="relative grid size-10 place-items-center rounded-[13px] border border-emerald-200/30 bg-[#a4edc1] text-[18px] font-black tracking-[-0.08em] text-[#0b1110] transition group-hover:bg-[#c1f7d3]">
              C<span className="absolute bottom-[8px] right-[8px] size-1 rounded-full bg-[#f7b79b]" />
            </span>
            <span className="text-[18px] font-bold tracking-[-0.06em]">converge<span className="text-[#a4edc1]">.</span></span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-[12px] font-semibold text-white/65 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white sm:text-[13px]">
            <span aria-hidden="true">←</span> <span className="hidden sm:inline">Back to homepage</span><span className="sm:hidden">Home</span>
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-14">
          <section className="relative hidden min-h-[570px] flex-col justify-center lg:flex">
            <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9d9c5]">
              <span className="size-1.5 rounded-full bg-[#a4edc1] shadow-[0_0_14px_rgba(164,237,193,0.8)]" />
              Human curiosity, shared discovery
            </div>
            <h1 className="max-w-[680px] text-[clamp(4rem,7.1vw,7.5rem)] font-extrabold leading-[0.88] tracking-[-0.095em]">
              Good ideas<br />don’t happen<br /><span className="text-[#a4edc1]">alone<span className="ml-2 align-top text-[0.42em] text-[#f6c69d]">✳</span></span>
            </h1>
            <p className="mt-8 max-w-[490px] text-[16px] leading-8 text-[#aebbb2]">
              Your conversations, questions, and discoveries have a place to grow. Come back to the people and perspectives that help you think differently.
            </p>

            <div className="mt-12 max-w-[510px] rounded-[22px] border border-white/[0.11] bg-[#101a14]/75 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-[13px] bg-[#a4edc1] text-lg font-black text-[#163821]">✳</div>
                  <div><p className="text-[13px] font-semibold text-white">A better question starts here</p><p className="mt-1 text-[11px] text-white/45">People + specialist AI perspectives</p></div>
                </div>
                <span className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#a4edc1]">Converge</span>
              </div>
              <div className="mt-5 flex items-center gap-2 text-[11px] text-white/50">
                <span className="h-px flex-1 bg-white/10" /><span>ASK</span><span className="text-[#a4edc1]">✳</span><span>EXPLORE</span><span className="text-[#f6c69d]">↗</span><span>DISCOVER</span><span className="h-px flex-1 bg-white/10" />
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[470px] py-5 lg:mx-0 lg:ml-auto">
            <div className="mb-7 lg:hidden">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a4edc1]">Welcome back to Converge</p>
            </div>
            <div className="rounded-[28px] border border-white/[0.11] bg-[#101815]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:p-9">
              <div className="mb-8">
                <div className="mb-6 grid size-12 place-items-center rounded-[16px] border border-emerald-200/20 bg-emerald-200/[0.08] text-[21px] text-[#a4edc1]">↗</div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a4edc1]">Your space is waiting</p>
                <h2 className="mt-3 text-[34px] font-bold leading-tight tracking-[-0.065em] sm:text-[39px]">Welcome back.</h2>
                <p className="mt-3 text-[13px] leading-6 text-white/50">Sign in to pick up where your curiosity left off.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="mb-2.5 block text-[12px] font-semibold text-white/75">Email address</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-[52px] w-full rounded-[13px] border border-white/[0.11] bg-[#0b1110]/80 px-4 text-[13px] text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-[#a4edc1]/65 focus:ring-4 focus:ring-emerald-200/[0.06]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2.5 block text-[12px] font-semibold text-white/75">Password</span>
                  <span className="relative block">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="h-[52px] w-full rounded-[13px] border border-white/[0.11] bg-[#0b1110]/80 px-4 pr-16 text-[13px] text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-[#a4edc1]/65 focus:ring-4 focus:ring-emerald-200/[0.06]"
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-[11px] font-semibold text-white/45 transition hover:bg-white/[0.05] hover:text-white/85">
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>

                {message && <p role="alert" className="rounded-[12px] border border-red-300/20 bg-red-300/[0.06] px-4 py-3 text-[12px] leading-5 text-red-200">{message}</p>}

                <button type="submit" disabled={loading} className="group flex h-[53px] w-full items-center justify-center gap-3 rounded-full bg-[#a4edc1] px-5 text-[13px] font-extrabold text-[#102219] shadow-[0_10px_30px_rgba(119,222,158,0.12)] transition hover:-translate-y-0.5 hover:bg-[#c1f7d3] hover:shadow-[0_14px_36px_rgba(119,222,158,0.2)] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? "Signing you in…" : "Sign in to Converge"}
                  {!loading && <span aria-hidden="true" className="text-[17px] transition group-hover:translate-x-1">↗</span>}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3 text-[10px] text-white/25"><span className="h-px flex-1 bg-white/[0.09]" /><span>YOUR NEXT GOOD IDEA STARTS HERE</span><span className="h-px flex-1 bg-white/[0.09]" /></div>

              <p className="text-center text-[12px] text-white/45">
                New to Converge?{" "}
                <Link href="/sign-up" className="font-bold text-[#a4edc1] transition hover:text-[#c1f7d3]">Create an account <span aria-hidden="true">↗</span></Link>
              </p>
            </div>
            <p className="mt-6 text-center text-[10px] leading-5 text-white/30">A space for human curiosity and AI perspectives to meet.</p>
          </section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-white/[0.07] py-5 text-[10px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Converge</span>
          <span>Better questions. Shared understanding.</span>
          <Link href="/" className="transition hover:text-white/70">Back to home ↗</Link>
        </footer>
      </div>
    </main>
  );
}
