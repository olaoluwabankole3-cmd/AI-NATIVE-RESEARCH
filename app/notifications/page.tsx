"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { safeAuthDestination } from "@/lib/auth/destination";

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  notification_type: "new_message" | "post_comment" | "post_like" | "connection_request" | "connection_accepted" | "topic_reply" | "community_join_request" | "community_join_approved" | "community_join_rejected" | "message_request_accepted";
  title: string;
  body: string;
  href: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};
type ActorProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" }).format(date);
}
function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}
function iconFor(type: NotificationRow["notification_type"]) {
  if (type === "new_message" || type === "message_request_accepted") return "↗";
  if (type === "community_join_request" || type === "community_join_approved" || type === "community_join_rejected") return "⌂";
  if (type === "post_comment" || type === "topic_reply") return "↳";
  if (type === "post_like") return "♥";
  if (type === "connection_request" || type === "connection_accepted") return "◎";
  return "•";
}

function categoryFor(type: NotificationRow["notification_type"]): "research" | "community" | "network" | "messages" {
  if (type === "topic_reply" || type === "post_comment" || type === "post_like") return "research";
  if (type.startsWith("community_")) return "community";
  if (type === "new_message" || type === "message_request_accepted") return "messages";
  return "network";
}
function labelFor(type: NotificationRow["notification_type"]) {
  const labels: Record<NotificationRow["notification_type"],string> = {
    new_message:"MESSAGE",post_comment:"RESEARCH",post_like:"RESEARCH",
    connection_request:"NETWORK",connection_accepted:"NETWORK",
    topic_reply:"RESEARCH",community_join_request:"COMMUNITY",
    community_join_approved:"COMMUNITY",community_join_rejected:"COMMUNITY",
    message_request_accepted:"MESSAGE"
  };
  return labels[type];
}
export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [actors, setActors] = useState<Record<string, ActorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"all" | "unread">("all");
  const [context, setContext] = useState<"all" | "research" | "community" | "network" | "messages">("all");
  const [query, setQuery] = useState("");
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const displayedNotifications = notifications.filter((item) => {
    const matchesTab = view === "all" || !item.is_read;
    const matchesContext = context === "all" || categoryFor(item.notification_type) === context;
    const text = [item.title,item.body, actors[item.actor_id ?? ""]?.display_name ?? ""].join(" ").toLowerCase();
    return matchesTab && matchesContext && text.includes(query.trim().toLowerCase());
  });

  const loadNotifications = useCallback(async (knownViewerId?: string) => {
    const currentViewerId = knownViewerId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!currentViewerId) {
      router.replace("/sign-in?next=/notifications");
      return;
    }
    setViewerId(currentViewerId);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, recipient_id, actor_id, notification_type, title, body, href, metadata, is_read, created_at")
      .eq("recipient_id", currentViewerId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setNotice(error.message.includes("notifications")
        ? "Notifications are not set up yet. Apply the Converge notifications migration in Supabase, then refresh this page."
        : error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as NotificationRow[];
    setNotifications(rows);
    const actorIds = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
    if (actorIds.length) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", actorIds);
      const map: Record<string, ActorProfile> = {};
      for (const profile of (profileData ?? []) as ActorProfile[]) map[profile.id] = profile;
      setActors(map);
    } else {
      setActors({});
    }
    setNotice("");
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    let active = true;
    async function start() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/sign-in?next=/notifications");
        return;
      }
      await loadNotifications(user.id);
    }
    void start();
    return () => { active = false; };
  }, [loadNotifications, router, supabase]);

  useEffect(() => {
    if (!viewerId) return;
    const channel = supabase.channel(`notifications-page-${viewerId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${viewerId}`,
      }, () => { void loadNotifications(viewerId); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadNotifications, supabase, viewerId]);

  async function markAllRead() {
    if (!viewerId || busyId) return;
    setBusyId("all");
    setNotice("");
    try {
      const { error } = await supabase.from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", viewerId)
        .eq("is_read", false);
      if (error) throw error;
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not update notifications. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function openNotification(item: NotificationRow) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      if (!item.is_read) {
        const { error } = await supabase.from("notifications")
          .update({ is_read: true })
          .eq("id", item.id)
          .eq("recipient_id", viewerId);
        if (error) throw error;
        setNotifications((current) => current.map((row) => row.id === item.id ? { ...row, is_read: true } : row));
      }
      const safeHref = safeAuthDestination(item.href, window.location.origin, "/notifications");
      router.push(safeHref);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not open this notification. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissNotification(id: string) {
    if (!viewerId || busyId) return;
    setBusyId(id);
    setNotice("");
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", id).eq("recipient_id", viewerId);
      if (error) throw error;
      setNotifications((current) => current.filter((row) => row.id !== id));
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Could not dismiss this notification. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="converge-app-page converge-figma figma-notifications min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <header className="figma-notifications-mobile-toolbar">
        <Link href="/communities" aria-label="Back to research">‹</Link>
        <strong>Notifications</strong>
        <details>
          <summary aria-label="Notification options">⋯</summary>
          <div><Link href="/settings">Account settings</Link><Link href="/communities">Research</Link></div>
        </details>
      </header>
      <aside className="figma-notifications-navigator" aria-label="Notification navigation">
        <Link href="/communities" className="figma-notifications-brand">converge.</Link>
        <h2>Notifications</h2>
        <label>
          <span className="sr-only">Search notifications</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕   Search notifications" />
        </label>
        <div className="figma-notifications-sidebar-tabs" role="group" aria-label="Notification status">
          <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>All</button>
          <button type="button" aria-pressed={view === "unread"} onClick={() => setView("unread")}>Unread</button>
        </div>
        <p>FILTER BY CONTEXT</p>
        <nav aria-label="Notification categories">
          {([
            ["all","AL","All activity","From across Converge"],
            ["research","RE","Research","Replies, evidence and AI"],
            ["community","CO","Community","Requests and membership"],
            ["network","NE","Connections","People and messages"],
            ["messages","ME","Messages","Private communication"],
          ] as const).map(([value,initial,title,description]) => (
            <button type="button" key={value} aria-pressed={context === value} onClick={() => setContext(value)}>
              <span className="figma-notifications-category-icon">{initial}</span>
              <span><strong>{title}</strong><small>{description}</small></span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="figma-notifications-container mx-auto max-w-[1080px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="converge-page-intro flex flex-col justify-between gap-5 border-b border-white/[0.09] py-9 sm:flex-row sm:items-end sm:py-12">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Notifications</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl"><span className="figma-notifications-mobile-heading">Updates</span><span className="figma-notifications-desktop-heading">Stay in the loop.</span></h1>
            <span className="figma-notifications-mobile-unread">{unreadCount} unread</span>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">Relevant updates from research rooms, communities, messages, and people.</p>
          </div>

        </section>

        <div className="converge-notifications-controls" role="tablist" aria-label="Notification view">
          <button type="button" role="tab" aria-selected={view === "all"} onClick={() => setView("all")}>All</button>
          <button type="button" role="tab" aria-selected={view === "unread"} onClick={() => setView("unread")}>Unread</button>
          <button type="button" onClick={() => void markAllRead()} disabled={!unreadCount || Boolean(busyId)} className="figma-notifications-mark-all">{busyId === "all" ? "Updating…" : "Mark all as read"}</button>
        </div>
        {notice && <p role="alert" className="mt-5 rounded-xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-100">{notice}</p>}

        <p className="figma-notifications-date-label">RECENT UPDATES</p>
        <section className="converge-notifications-list mt-6 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101815]/70">
          {loading ? <div className="grid gap-0">{[0,1,2,3].map((item) => <div key={item} className="h-24 animate-pulse border-b border-white/[0.06] bg-white/[0.02]" />)}</div>
            : displayedNotifications.length ? displayedNotifications.map((item) => {
              const actor = item.actor_id ? actors[item.actor_id] : undefined;
              return (
                <article key={item.id} className={["figma-notification-card flex items-start gap-3 px-4 py-4 transition sm:gap-4 sm:px-6 sm:py-5", item.is_read ? "is-read" : "is-unread", "border-b border-white/[0.06] last:border-b-0"].join(" ")}>
                  <div className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.07] text-sm font-bold text-emerald-100">
                    {actor?.avatar_url ? <img src={actor.avatar_url} alt="" className="size-full object-cover" /> : initials(actor?.display_name ?? (item.notification_type === "topic_reply" ? "Research" : "Converge"))}
                    {!item.is_read && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-emerald-200 ring-2 ring-[#101815]" />}
                  </div>
                  <button type="button" onClick={() => void openNotification(item)} disabled={busyId === item.id} className="min-w-0 flex-1 text-left disabled:opacity-50">
                    <div className="figma-notifications-row-top">
                      <span className="figma-notifications-category">{labelFor(item.notification_type)}</span>
                      <time dateTime={item.created_at}>{formatTime(item.created_at)}</time>
                    </div>
                    <h3 className="figma-notifications-row-title">{item.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-white/50">{actor?.display_name ? <strong className="font-semibold text-white/75">{actor.display_name} </strong> : null}{item.body}</p>
                  </button>
                  <button type="button" aria-label="Dismiss notification" disabled={Boolean(busyId)} onClick={() => void dismissNotification(item.id)} className="shrink-0 rounded-full px-2 py-1 text-sm text-white/25 transition hover:bg-white/[0.05] hover:text-white/75 disabled:opacity-40">×</button>
                </article>
              );
            })
            : <div className="px-6 py-16 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-2xl text-emerald-100">♧</div>
              <h2 className="mt-5 text-xl font-semibold">{view === "unread" ? "No unread notifications." : "You’re all caught up."}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">{view === "unread" ? "You have reviewed your recent updates. Switch to All updates to see the full history." : "Messages, research replies, access requests and network updates will appear here."}</p>
              <Link href="/communities" className="mt-6 inline-flex rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100">Explore research ↗</Link>
            </div>}
        </section>
        <p className="figma-notifications-helper mt-6 text-[10px] leading-5 text-white/30">Swipe or open an update to review it in context.</p>
      </div>
      <aside className="figma-notifications-inspector" aria-label="Notifications context">
        <p>YOUR ATTENTION</p>
        <h2>{unreadCount} unread {unreadCount === 1 ? "update" : "updates"}</h2>
        <section><h3>A quieter workspace</h3><span>Updates remain available here without competing with your active work.</span></section>
        <p>REVIEW IN CONTEXT</p>
        <span>Open an update to see the related research, community, or person.</span>
        <Link href="/communities">Back to research ↗</Link>
      </aside>
    </main>
  );
}
