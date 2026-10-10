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
  const isHome = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const shell = isHome
    ? "border-[#e4e5ec]/90 bg-[#f7f6f2]/90 text-[#202943]"
    : "border-white/[0.09] bg-[#0b1110]/95 text-white";
  const muted = isHome ? "text-[#717991] hover:text-[#293455]" : "text-white/50 hover:text-white";
  const line = isHome ? "bg-[#5869db]" : "bg-emerald-300";

  return (
    <header className={["sticky top-0 z-30 border-b backdrop-blur-xl", shell].join(" ")}>
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-14">
        <Link href="/" className="group flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span className={["relative grid size-9 place-items-center rounded-[12px] text-[17px] font-black tracking-[-0.08em] transition", isHome ? "bg-[#5869db] text-white group-hover:bg-[#4858c8]" : "border border-emerald-200/30 bg-emerald-300 text-[#0b1110] group-hover:bg-emerald-200"].join(" ")}>
            C<span className={["absolute bottom-[7px] right-[7px] size-1 rounded-full", isHome ? "bg-[#f7b79b]" : "bg-[#0b1110]"].join(" ")} />
          </span>
          <span className="text-[17px] font-bold tracking-[-0.055em]">
            converge<span className={["ml-0.5", isHome ? "text-[#5869db]" : "text-emerald-300"].join(" ")}>.</span>
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
                  "relative px-4 py-2 text-[13px] font-semibold transition",
                  active ? (isHome ? "text-[#293455]" : "text-white") : muted,
                ].join(" ")}
              >
                {link.label}
                {active && <span className={["absolute inset-x-4 -bottom-[17px] h-0.5", line].join(" ")} />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/sign-in" className={["hidden px-2 py-2 text-[13px] font-semibold transition sm:block", muted].join(" ")}>
            Sign in
          </Link>
          <Link href="/sign-up" className={["inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition sm:px-5", isHome ? "bg-[#5869db] text-white shadow-sm hover:bg-[#4858c8]" : "bg-emerald-300 text-[#0b1110] hover:bg-emerald-200"].join(" ")}>
            Get started <span aria-hidden="true">↗</span>
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className={["grid size-10 place-items-center rounded-xl border transition sm:hidden", isHome ? "border-[#dfe1eb] text-[#37415f] hover:bg-white" : "border-white/10 text-white/75 hover:bg-white/[0.05]"].join(" ")}
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
        <div className={["border-t px-5 pb-4 pt-3 sm:hidden", isHome ? "border-[#e4e5ec] bg-[#f7f6f2]" : "border-white/[0.09] bg-[#0b1110]"].join(" ")}>
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={["rounded-xl px-3 py-3 text-sm font-medium transition", active ? (isHome ? "bg-white text-[#293455]" : "bg-white/[0.06] text-white") : muted].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link href="/sign-in" onClick={() => setMobileOpen(false)} className={["px-3 py-3 text-sm font-medium", muted].join(" ")}>
              Sign in
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
