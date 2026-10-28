"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/client";

const currentSettings = [
  { title: "Profile and identity", description: "Edit your name, username, profile picture, bio, and visibility.", href: "/profile", action: "Manage profile" },
  { title: "Notifications", description: "Review activity notifications and use the notification controls that are currently available.", href: "/notifications", action: "Open notifications" },
  { title: "Community settings", description: "Manage access, participation, and agents inside communities you own.", href: "/communities", action: "Open research spaces" },
];

const plannedSettings = [
  { title: "Preferences and accessibility", description: "Appearance, reduced motion, language, and time-zone preferences." },
  { title: "Privacy and visibility", description: "Discovery, direct-message requests, and other account privacy controls." },
  { title: "AI and research preferences", description: "Default response length, research style, and agent participation preferences." },
  { title: "Connected applications", description: "Review and revoke supported third-party connections." },
  { title: "Data and account management", description: "Review data handling and request export or account deletion." },
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        router.replace("/sign-in?next=/settings");
        return;
      }
      setLoading(false);
    }
    void checkSession();
    return () => { active = false; };
  }, [router, supabase]);

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-9 sm:px-8 sm:pt-12">
        <div className="border-b border-white/[0.09] pb-8 sm:pb-10">
          <p className="mb-3 text-[9px] font-extrabold uppercase tracking-[0.2em] text-emerald-200/70">Your account</p>
          <h1 className="text-3xl font-semibold tracking-[-0.055em] sm:text-[40px]">Settings</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
            Manage your Converge account and preferences. Only controls that are available today are linked below; the remaining settings will be added in stages.
          </p>
        </div>

        {loading ? (
          <div className="mt-8 space-y-4" aria-label="Loading settings">
            <div className="h-16 animate-pulse border-b border-white/[0.08] bg-white/[0.015]" />
            <div className="h-16 animate-pulse border-b border-white/[0.08] bg-white/[0.015]" />
            <div className="h-16 animate-pulse border-b border-white/[0.08] bg-white/[0.015]" />
          </div>
        ) : (
          <>
            <section className="mt-8">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9bb5a2]">Available now</h2>
                <span className="text-[10px] text-white/35">Working destinations</span>
              </div>
              <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {currentSettings.map((item) => (
                  <Link key={item.href} href={item.href} className="group flex items-center gap-4 py-5 transition-colors hover:bg-white/[0.02] sm:px-3">
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-semibold text-white/85 transition-colors group-hover:text-emerald-100">{item.title}</strong>
                      <span className="mt-1 block max-w-2xl text-xs leading-6 text-white/45">{item.description}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 text-[11px] font-semibold text-emerald-200 sm:inline-flex">{item.action}<span aria-hidden="true">↗</span></span>
                    <span className="shrink-0 text-emerald-200 sm:hidden" aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-11">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9bb5a2]">Still to be configured</h2>
                <span className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[9px] font-semibold text-white/40">Not live yet</span>
              </div>
              <div className="divide-y divide-white/[0.07] border-y border-white/[0.08]">
                {plannedSettings.map((item) => (
                  <div key={item.title} className="flex items-start gap-4 py-4 sm:px-3">
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-medium text-white/65">{item.title}</strong>
                      <span className="mt-1 block max-w-2xl text-xs leading-6 text-white/40">{item.description}</span>
                    </span>
                    <span className="mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">Planned</span>
                  </div>
                ))}
              </div>
            </section>

            <p className="mt-8 text-xs leading-6 text-white/35">
              Additional controls will be enabled only when they are connected to real application behaviour and properly enforced.{" "}
              <a href="https://github.com/olaoluwabankole3-cmd/AI-NATIVE-RESEARCH/blob/main/docs/SETTINGS_SPECIFICATION.md" target="_blank" rel="noreferrer" className="text-emerald-200/75 underline decoration-emerald-200/25 underline-offset-4 hover:text-emerald-100">Read the settings specification</a>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
