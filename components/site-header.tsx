"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TopNavIconName = "home" | "communities" | "activity" | "people" | "organizations" | "network" | "messages" | "agents" | "notifications" | "workspaces" | "more";

const links: { href: string; label: string; icon: TopNavIconName }[] = [
  { href: "/communities", label: "Research spaces", icon: "communities" },
  { href: "/people", label: "People", icon: "people" },
  { href: "/organizations", label: "Organisations", icon: "organizations" },
  { href: "/network", label: "Network", icon: "network" },
  { href: "/messages", label: "Messages", icon: "messages" },
  { href: "/agents", label: "AI registry", icon: "agents" },
  { href: "/workspaces", label: "Workspaces", icon: "workspaces" },
];

const desktopLinks: { href: string; label: string; icon: TopNavIconName }[] = [
  { href: "/communities", label: "Research", icon: "communities" },
  { href: "/agents", label: "AI registry", icon: "agents" },
  { href: "/messages", label: "Messaging", icon: "messages" },
  { href: "/notifications", label: "Notifications", icon: "notifications" },
];

const moreLinks = links.filter((link) => ["/people", "/organizations", "/network", "/workspaces"].includes(link.href));

function TopNavGlyph({ name }: { name: TopNavIconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: "converge-nav-icon",
  };
  switch (name) {
    case "home":
      return <svg {...common}><path d="m3 10.5 9-7.3 9 7.3M5.5 9v11h13V9M9.5 20v-6h5v6" /></svg>;
    case "communities":
      return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
    case "activity":
      return <svg {...common}><path d="M3 12h4l2.2-6 4.4 12 2.2-6H21" /></svg>;
    case "people":
      return <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20v-1.4a5.5 5.5 0 0 1 11 0V20M16 5.4a3.2 3.2 0 0 1 0 6.2M17 15a4.8 4.8 0 0 1 3.5 4.6" /></svg>;
    case "organizations":
      return <svg {...common}><path d="M4 20.5h16M6 20V4.5h12V20M9 8h1.5M13.5 8H15M9 11.5h1.5M13.5 11.5H15M10 20v-4h4v4" /></svg>;
    case "network":
      return <svg {...common}><circle cx="12" cy="5" r="2.3" /><circle cx="5" cy="18" r="2.3" /><circle cx="19" cy="18" r="2.3" /><path d="m10.9 7-4.7 8.9M13.1 7l4.7 8.9M7.5 18h9" /></svg>;
    case "messages":
      return <svg {...common}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-1-4.2A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h8M8 14.5h5" /></svg>;
    case "agents":
      return <svg {...common}><path d="m12 2.8 2.4 6.1 6.2 2.4-6.2 2.4-2.4 6.2-2.4-6.2-6.1-2.4 6.1-2.4L12 2.8Z" /><path d="m19.5 15.5 1.1 2.8 2.6 1.1-2.6 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1 1.1-2.8Z" /></svg>;
    case "notifications":
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
    case "workspaces":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /><path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" /></svg>;
    case "more":
      return <svg {...common}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>;
  }
}

const mobileLinksPrimary = [
  { href: "/communities", label: "Research", kind: "spaces" },
  { href: "/agents", label: "AI", kind: "agents" },
  { href: "/messages", label: "Inbox", kind: "inbox" },
  { href: "/notifications", label: "Alerts", kind: "notifications" },
] as const;

function MobileGlyph({ name }: { name: (typeof mobileLinksPrimary)[number]["kind"] | "more" }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "spaces": return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
    case "agents": return <svg {...common}><path d="m12 2.8 2.4 6.1 6.2 2.4-6.2 2.4-2.4 6.2-2.4-6.2-6.1-2.4 6.1-2.4L12 2.8Z" /><path d="m19.5 15.5 1.1 2.8 2.6 1.1-2.6 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1 1.1-2.8Z" /></svg>;
    case "notifications": return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>;
    case "inbox": return <svg {...common}><path d="M4 4.5h16v15H4z" /><path d="m4 8 8 5.2L20 8M9 15h6" /></svg>;
    default: return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
  }
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const muted = "text-white/55 hover:text-white";

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !moreMenuRef.current?.contains(event.target)) setMoreOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) {
      setUnreadNotifications(0);
      return;
    }

    let active = true;
    async function loadUnreadCount() {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false);
      if (active && !error) setUnreadNotifications(count ?? 0);
    }

    void loadUnreadCount();
    const channel = supabase.channel(`header-notifications-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      }, () => { void loadUnreadCount(); })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setUserEmail(null);
    setSigningOut(false);
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0b1110]/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-14">
        <Link href={userEmail ? "/communities" : "/"} className="group flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span className="relative grid size-9 place-items-center rounded-[11px] border border-emerald-200/25 bg-[#15231b] text-emerald-200 transition group-hover:border-emerald-100/50 group-hover:bg-[#1b3024]" aria-hidden="true">
            <svg viewBox="0 0 36 36" className="size-[25px]" fill="none">
              <path d="M7.5 8.5 18 18 28.5 8.5M18 18l10.5 9.5M18 18 7.5 27.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="7.5" cy="8.5" r="3" fill="currentColor" />
              <circle cx="28.5" cy="8.5" r="3" fill="currentColor" />
              <circle cx="7.5" cy="27.5" r="3" fill="currentColor" />
              <circle cx="28.5" cy="27.5" r="3" fill="currentColor" />
              <circle cx="18" cy="18" r="4.2" fill="#EAB58E" stroke="#15231B" strokeWidth="1.7" />
            </svg>
          </span>
          <span className="text-[17px] font-bold tracking-[-0.055em]">converge<span className="ml-0.5 text-emerald-300">.</span></span>
        </Link>

        <nav aria-label="Main navigation" className="converge-primary-nav hidden items-center gap-0.5 lg:flex">
          {desktopLinks.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={["converge-primary-nav__link", active ? "is-active" : "", active ? "text-white" : muted].join(" ")}>
                <span className="converge-nav-icon-wrap">
                  <TopNavGlyph name={link.icon} />
                  {link.href === "/notifications" && unreadNotifications > 0 && <span className="converge-nav-count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
                </span>
                <span className="converge-nav-label">{link.label}</span>
              </Link>
            );
          })}
          <div className="converge-nav-more" ref={moreMenuRef}>
            <button type="button" aria-expanded={moreOpen} aria-controls="converge-more-menu" onClick={() => setMoreOpen((open) => !open)} className={["converge-primary-nav__link converge-primary-nav__button", moreOpen || moreLinks.some((link) => pathname === link.href || pathname.startsWith(link.href + "/")) ? "is-active" : "", moreOpen || moreLinks.some((link) => pathname === link.href || pathname.startsWith(link.href + "/")) ? "text-white" : muted].join(" ")}>
              <TopNavGlyph name="more" />
              <span className="converge-nav-label">More</span>
            </button>
            {moreOpen && (
              <div id="converge-more-menu" className="converge-more-menu" role="menu" aria-label="More destinations">
                <p className="converge-more-menu__eyebrow">Explore Converge</p>
                {moreLinks.map((link) => {
                  const active = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link key={link.href} href={link.href} role="menuitem" onClick={() => setMoreOpen(false)} className={["converge-more-menu__link", active ? "is-active" : ""].join(" ")}>
                      <TopNavGlyph name={link.icon} />
                      <span>{link.label}</span>
                      <span className="converge-more-menu__arrow" aria-hidden="true">↗</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {authReady && userEmail ? (
            <>
              <Link href="/profile" className={["hidden rounded-full border px-3 py-2 text-[11px] font-semibold transition lg:inline-flex", pathname === "/profile" ? "border-emerald-200/35 bg-emerald-200/[0.08] text-emerald-100" : "border-white/10 text-white/65 hover:border-emerald-200/25 hover:text-white"].join(" ")}>My profile <span className="ml-1 text-emerald-200">↗</span></Link>
              <span className="hidden max-w-[160px] truncate text-xs text-white/40 xl:block">{userEmail}</span>
              <button type="button" onClick={handleSignOut} disabled={signingOut} className="hidden rounded-full border border-white/15 px-4 py-2.5 text-[12px] font-semibold text-white/70 transition hover:border-white/30 hover:text-white xl:inline-flex">
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className={["hidden px-2 py-2 text-[13px] font-semibold transition xl:block", muted].join(" ")}>Sign in</Link>
              <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2.5 text-[13px] font-semibold text-[#0b1110] transition hover:bg-emerald-200 sm:px-5">
                Get started <span aria-hidden="true">↗</span>
              </Link>
            </>
          )}
          <button type="button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)} className={["grid size-10 place-items-center rounded-xl border border-white/10 text-white/75 transition hover:bg-white/[0.05] lg:hidden", userEmail ? "hidden" : "grid"].join(" ")}>
            <span className="sr-only">Menu</span>
            <span className="flex flex-col gap-1.5">
              <span className={["h-px w-4 bg-current transition", mobileOpen ? "translate-y-1 rotate-45" : ""].join(" ")} />
              <span className={["h-px w-4 bg-current transition", mobileOpen ? "-translate-y-1 -rotate-45" : ""].join(" ")} />
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.09] bg-[#0b1110] px-5 pb-24 pt-3 lg:hidden">
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={["rounded-xl px-3 py-3 text-sm font-medium transition", active ? "bg-white/[0.06] text-white" : muted].join(" ")}>{link.label}</Link>;
            })}
            {userEmail ? (
              <>
                <Link href="/notifications" onClick={() => setMobileOpen(false)} className={["flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold", pathname === "/notifications" ? "bg-emerald-200/[0.08] text-emerald-100" : "text-white/70"].join(" ")}><span>Notifications</span>{unreadNotifications > 0 && <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-[#0b1710]">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</Link>
                <Link href="/profile" onClick={() => setMobileOpen(false)} className={["rounded-xl px-3 py-3 text-sm font-semibold", pathname === "/profile" ? "bg-emerald-200/[0.08] text-emerald-100" : "text-emerald-200"].join(" ")}>My profile ↗</Link>
                <p className="truncate px-3 py-2 text-xs text-white/40">{userEmail}</p>
                <button type="button" onClick={handleSignOut} disabled={signingOut} className="px-3 py-3 text-left text-sm font-medium text-white/65">{signingOut ? "Signing out…" : "Sign out"}</button>
              </>
            ) : (
              <>
                <Link href="/sign-in" onClick={() => setMobileOpen(false)} className={["px-3 py-3 text-sm font-medium", muted].join(" ")}>Sign in</Link>
                <Link href="/sign-up" onClick={() => setMobileOpen(false)} className="px-3 py-3 text-sm font-semibold text-emerald-300">Create account ↗</Link>
              </>
            )}
          </nav>
        </div>
      )}

    </header>
      {authReady && userEmail && (
        <nav className="converge-mobile-dock" aria-label="Mobile primary navigation">
          {mobileLinksPrimary.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={["converge-mobile-dock__item", active ? "is-active" : ""].join(" ")}>
                <MobileGlyph name={item.kind} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button type="button" aria-expanded={mobileOpen} aria-label={mobileOpen ? "Close more navigation" : "Open more navigation"} onClick={() => setMobileOpen((open) => !open)} className={["converge-mobile-dock__item", mobileOpen || !mobileLinksPrimary.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")) ? "is-active" : ""].join(" ")}>
            <MobileGlyph name="more" />
            <span>More</span>
          </button>
        </nav>
      )}
    </>
  );
}
