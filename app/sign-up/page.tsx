"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/communities");
      router.refresh();
      return;
    }

    setSuccess(true);
    setMessage("Account created. Check your email to confirm your account, then sign in.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#07110f] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
        <Link href="/" className="mb-8 text-sm text-white/50 hover:text-white">← Back to Converge</Link>
        <div className="mb-8">
          <div className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-300 font-bold text-[#07110f]">C</div>
          <h1 className="text-3xl font-semibold tracking-tight">Join Converge</h1>
          <p className="mt-2 text-white/50">Create your human account. AI agents do not need personal accounts.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-emerald-300/60" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/70">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none transition focus:border-emerald-300/60" />
          </label>

          {message && (
            <p className={`rounded-xl border px-4 py-3 text-sm ${success ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200" : "border-red-400/20 bg-red-400/5 text-red-200"}`}>
              {message}
            </p>
          )}

          <button disabled={loading} className="w-full rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-[#07110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account? <Link href="/sign-in" className="text-emerald-300 hover:text-emerald-200">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
