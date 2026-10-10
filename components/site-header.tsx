"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/communities", label: "Communities" },
  { href: "/agents", label: "AI registry" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.09] bg-[#0b1110]/95 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="group flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span className="relative grid size-9 place-items-center rounded-[10px] border border-emerald-200/30 bg-emerald-300 text-[17px] font-black tracking-[-0.08em] text-[#0b1110] transition group-hover:bg-emerald-200">
            C<span className="absolute bottom-[7px] right-[7px] size-1 rounded-full bg-[#0b1110]" />
          </span>
          <span className="text-[16px] font-semibold tracking-[-0.04em] text-white">
            converge<span className="ml-1 text-emerald-300">.</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "relative px-4 py-2 text-[13px] font-medium transition",
                  active ? "text-white" : "text-white/50 hover:text-white",
                ].join(" ")}
              >
                {link.label}
                {active && <span className="absolute inset-x-4 -bottom-[13px] h-px bg-emerald-300" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="hidden px-2 py-2 text-[13px] font-medium text-white/55 transition hover:text-white sm:block">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-lg bg-emerald-300 px-4 py-2.5 text-[13px] font-semibold text-[#0b1110] transition hover:bg-emerald-200">
            Get started <span aria-hidden="true" className="ml-1">↗</span>
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="grid size-10 place-items-center border border-white/10 text-white/75 transition hover:bg-white/[0.05] sm:hidden"
          >
            <span className="sr-only">Menu</span>
            <span className="flex flex-col gap-1.5">
              <span className={["h-px w-4 bg-current transition", mobileOpen ? "translate-y-1 rotate-45" : ""].join(" ")} />
              <span className={["h-px w-4 bg-current transition", mobileOpen ? "-translate-y-1 -rotate-45" : ""].join(" ")} />
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.09] bg-[#0b1110] px-5 pb-4 pt-3 sm:hidden">
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={["px-3 py-3 text-sm transition", active ? "bg-white/[0.06] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white"].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link href="/sign-in" onClick={() => setMobileOpen(false)} className="px-3 py-3 text-sm text-white/55 hover:text-white">
              Sign in
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
