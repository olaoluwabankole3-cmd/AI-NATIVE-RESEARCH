"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TopNavIconName = "home" | "communities" | "activity" | "people" | "organizations" | "network" | "messages" | "agents" | "notifications" | "workspaces" | "more" | "profile" | "settings" | "signout" | "help";

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
    case "profile":
      return <svg {...common}><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20v-1.2a7.5 7.5 0 0 1 15 0V20" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3.1" /><path d="M19.4 13.9 21 15l-1.8 3.1-1.9-.6a7.9 7.9 0 0 1-1.6 1l-.4 2h-3.6l-.4-2a7.9 7.9 0 0 1-1.6-1l-1.9.6L6 15l1.6-1.1a7.2 7.2 0 0 1 0-1.9L6 10.9l1.8-3.1 1.9.6a7.9 7.9 0 0 1 1.6-1l.4-2h3.6l.4 2a7.9 7.9 0 0 1 1.6 1l1.9-.6 1.8 3.1-1.6 1.1a7.2 7.2 0 0 1 0 1.9Z" /></svg>;
    case "signout":
      return <svg {...common}><path d="M10 5H5.5v14H10M14 8l4 4-4 4M8 12h10" /></svg>;
    case "help":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 4.1 1.7c-1.1 1-1.8 1.2-1.8 2.8M12 17h.01" /></svg>;
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

function getInitials(value: string) {
  return value.trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const muted = "text-white/55 hover:text-white";

  useEffect(() => {
    setMoreOpen(false);
    setAccountOpen(false);
    setMobileOpen(false);
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
    if (!accountOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) setAccountOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
      const metadataName = data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name ?? "";
      const metadataAvatar = data.user?.user_metadata?.avatar_url ?? data.user?.user_metadata?.picture;
      setProfileName(typeof metadataName === "string" ? metadataName : "");
      setProfileAvatarUrl(typeof metadataAvatar === "string" ? metadataAvatar : null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      const metadataName = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? "";
      const metadataAvatar = session?.user?.user_metadata?.avatar_url ?? session?.user?.user_metadata?.picture;
      setProfileName(typeof metadataName === "string" ? metadataName : "");
      setProfileAvatarUrl(typeof metadataAvatar === "string" ? metadataAvatar : null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setProfileName("");
      setProfileAvatarUrl(null);
      return () => { active = false; };
    }

    async function loadProfileBadge() {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (!active || error || !data) return;
      setProfileName(data.display_name ?? "");
      setProfileAvatarUrl(data.avatar_url ?? null);
    }

    void loadProfileBadge();
    return () => { active = false; };
  }, [supabase, userId]);

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
      <div className="converge-site-header__inner mx-auto grid h-[72px] max-w-[1480px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-5 sm:px-8 lg:px-14">
        <Link href={userEmail ? "/communities" : "/"} className="converge-brand-link justify-self-start" aria-label="Converge home" onClick={() => setMobileOpen(false)}>
          <Image
            src="/converge-wordmark.svg"
            alt="Converge"
            width={164}
            height={55}
            priority
            className="converge-brand-image"
          />
        </Link>

        <nav aria-label="Main navigation" className="converge-primary-nav hidden items-center gap-0.5 justify-self-center lg:flex">
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

        <div className="converge-site-header__actions flex items-center justify-self-end">
          {authReady && userEmail ? (
            <div className="converge-account-menu" ref={accountMenuRef}>
              <button
                type="button"
                aria-label={`Open account menu for ${profileName || userEmail}`}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-controls="converge-account-menu-panel"
                onClick={() => setAccountOpen((open) => !open)}
                className="converge-account-trigger"
              >
                <span className="converge-account-avatar" aria-hidden="true">
                  {profileAvatarUrl ? <img src={profileAvatarUrl} alt="" /> : <span>{getInitials(profileName || userEmail)}</span>}
                </span>
                <svg className="converge-account-caret" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {accountOpen && (
                <div id="converge-account-menu-panel" className="converge-account-menu__panel" role="menu" aria-label="Account menu">
                  <div className="converge-account-menu__identity">
                    <span className="converge-account-avatar converge-account-avatar--large" aria-hidden="true">
                      {profileAvatarUrl ? <img src={profileAvatarUrl} alt="" /> : <span>{getInitials(profileName || userEmail)}</span>}
                    </span>
                    <span className="converge-account-menu__identity-copy">
                      <strong>{profileName.trim() || userEmail.split("@")[0] || "Converge member"}</strong>
                      <span>{userEmail}</span>
                    </span>
                  </div>
                  <div className="converge-account-menu__divider" />
                  <Link href="/profile" role="menuitem" onClick={() => setAccountOpen(false)} className={["converge-account-menu__item", pathname === "/profile" ? "is-active" : ""].join(" ")}>
                    <TopNavGlyph name="profile" /><span>My profile</span><span className="converge-account-menu__arrow">↗</span>
                  </Link>
                  <Link href="/settings" role="menuitem" onClick={() => setAccountOpen(false)} className={["converge-account-menu__item", pathname === "/settings" ? "is-active" : ""].join(" ")}>
                    <TopNavGlyph name="settings" /><span>Settings</span><span className="converge-account-menu__arrow">↗</span>
                  </Link>
                  <Link href="/notifications" role="menuitem" onClick={() => setAccountOpen(false)} className={["converge-account-menu__item", pathname === "/notifications" ? "is-active" : ""].join(" ")}>
                    <TopNavGlyph name="notifications" /><span>Notifications</span>{unreadNotifications > 0 && <span className="converge-account-menu__count">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
                  </Link>
                  <Link href="/communities" role="menuitem" onClick={() => setAccountOpen(false)} className={["converge-account-menu__item", pathname.startsWith("/communities") ? "is-active" : ""].join(" ")}>
                    <TopNavGlyph name="communities" /><span>Research spaces</span><span className="converge-account-menu__arrow">↗</span>
                  </Link>
                  <Link href="/agents" role="menuitem" onClick={() => setAccountOpen(false)} className={["converge-account-menu__item", pathname.startsWith("/agents") ? "is-active" : ""].join(" ")}>
                    <TopNavGlyph name="agents" /><span>AI registry</span><span className="converge-account-menu__arrow">↗</span>
                  </Link>
                  <div className="converge-account-menu__divider" />
                  <button type="button" role="menuitem" onClick={() => { setAccountOpen(false); void handleSignOut(); }} disabled={signingOut} className="converge-account-menu__item converge-account-menu__signout">
                    <TopNavGlyph name="signout" /><span>{signingOut ? "Signing out…" : "Sign out"}</span>
                  </button>
                </div>
              )}
            </div>
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
                <Link href="/settings" onClick={() => setMobileOpen(false)} className={["rounded-xl px-3 py-3 text-sm font-semibold", pathname === "/settings" ? "bg-emerald-200/[0.08] text-emerald-100" : "text-emerald-200"].join(" ")}>Settings ↗</Link>
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
