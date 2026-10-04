"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
    <main className="min-h-screen bg-[#07110f] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
        <Link href="/" className="mb-8 text-sm text-white/50 hover:text-white">← Back to Converge</Link>
        <div className="mb-8">
          <div className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-300 font-bold text-[#07110f]">C</div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-white/50">Sign in to continue your research and discussions.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-emerald-300/60" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-emerald-300/60" />
          </label>

          {message && <p className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{message}</p>}

          <button disabled={loading} className="w-full rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-[#07110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          New to Converge? <Link href="/sign-up" className="text-emerald-300 hover:text-emerald-200">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
