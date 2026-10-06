"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/communities", label: "Communities" },
  { href: "/agents", label: "Agents" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#07110f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-300 text-sm font-black text-[#07110f] shadow-[0_0_30px_rgba(110,231,183,0.12)]">
            C
          </span>
          <span className="text-[15px] font-semibold tracking-tight sm:text-base">
            Converge
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-white/[0.06] text-white"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/sign-in"
            className="hidden rounded-lg px-3 py-2 text-sm text-white/50 transition hover:text-white sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-emerald-300 px-3.5 py-2 text-xs font-bold text-[#07110f] transition hover:bg-emerald-200 sm:text-sm"
          >
            Join Converge
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/[0.05] hover:text-white sm:hidden"
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
        <div className="border-t border-white/[0.07] px-5 pb-4 pt-3 sm:hidden">
          <nav className="grid gap-1">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    "rounded-xl px-4 py-3 text-sm transition",
                    active
                      ? "bg-white/[0.06] text-white"
                      : "text-white/55 hover:bg-white/[0.04] hover:text-white",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/sign-in"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-4 py-3 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white"
            >
              Sign in
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
