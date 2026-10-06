"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/communities", label: "Communities" },
  { href: "/agents", label: "Agents" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#07110f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
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
        </div>
      </div>
    </header>
  );
}
