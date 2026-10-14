"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  notification_type: "new_message" | "post_comment" | "post_like" | "connection_request" | "connection_accepted" | "topic_reply";
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
  if (type === "new_message") return "↗";
  if (type === "post_comment" || type === "topic_reply") return "↳";
  if (type === "post_like") return "♥";
  if (type === "connection_request" || type === "connection_accepted") return "◎";
  return "•";
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
    if (!viewerId || busyId === "all") return;
    setBusyId("all");
    const { error } = await supabase.from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", viewerId)
      .eq("is_read", false);
    if (error) setNotice(error.message);
    else setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setBusyId(null);
  }

  async function openNotification(item: NotificationRow) {
    if (!item.is_read) {
      setBusyId(item.id);
      const { error } = await supabase.from("notifications")
        .update({ is_read: true })
        .eq("id", item.id)
        .eq("recipient_id", viewerId);
      if (error) {
        setNotice(error.message);
        setBusyId(null);
        return;
      }
      setNotifications((current) => current.map((row) => row.id === item.id ? { ...row, is_read: true } : row));
      setBusyId(null);
    }
    const safeHref = item.href.startsWith("/") && !item.href.startsWith("//") ? item.href : "/notifications";
    router.push(safeHref);
  }

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1080px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="converge-page-intro flex flex-col justify-between gap-5 border-b border-white/[0.09] py-9 sm:flex-row sm:items-end sm:py-12">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Notifications</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Stay in the loop.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">Messages, community activity, and replies that bring your work forward.</p>
          </div>
          <button type="button" onClick={() => void markAllRead()} disabled={!notifications.some((item) => !item.is_read) || busyId === "all"} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-emerald-200/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-35">{busyId === "all" ? "Updating…" : "Mark all as read ✓"}</button>
        </section>

        {notice && <p role="alert" className="mt-5 rounded-xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-100">{notice}</p>}

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101815]/70">
          {loading ? <div className="grid gap-0">{[0,1,2,3].map((item) => <div key={item} className="h-24 animate-pulse border-b border-white/[0.06] bg-white/[0.02]" />)}</div>
            : notifications.length ? notifications.map((item) => {
              const actor = item.actor_id ? actors[item.actor_id] : undefined;
              return (
                <div key={item.id} className={["flex items-start gap-3 px-4 py-4 transition sm:gap-4 sm:px-6 sm:py-5", item.is_read ? "bg-transparent" : "bg-emerald-200/[0.035]", "border-b border-white/[0.06] last:border-b-0"].join(" ")}>
                  <div className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.07] text-sm font-bold text-emerald-100">
                    {actor?.avatar_url ? <img src={actor.avatar_url} alt="" className="size-full object-cover" /> : initials(actor?.display_name ?? (item.notification_type === "topic_reply" ? "Research" : "Converge"))}
                    {!item.is_read && <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-emerald-200 ring-2 ring-[#101815]" />}
                  </div>
                  <button type="button" onClick={() => void openNotification(item)} disabled={busyId === item.id} className="min-w-0 flex-1 text-left disabled:opacity-50">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-xs text-emerald-100">{iconFor(item.notification_type)}</span>
                      <span className={["text-sm font-semibold", item.is_read ? "text-white/70" : "text-white/95"].join(" ")}>{item.title}</span>
                      <time dateTime={item.created_at} className="text-[10px] text-white/30">{formatTime(item.created_at)}</time>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/50">{actor?.display_name ? <strong className="font-semibold text-white/75">{actor.display_name} </strong> : null}{item.body}</p>
                  </button>
                  <button type="button" aria-label="Dismiss notification" onClick={async () => {
                    const { error } = await supabase.from("notifications").delete().eq("id", item.id).eq("recipient_id", viewerId);
                    if (error) setNotice(error.message);
                    else setNotifications((current) => current.filter((row) => row.id !== item.id));
                  }} className="shrink-0 rounded-full px-2 py-1 text-sm text-white/25 transition hover:bg-white/[0.05] hover:text-white/75">×</button>
                </div>
              );
            })
            : <div className="px-6 py-16 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-2xl text-emerald-100">♧</div>
              <h2 className="mt-5 text-xl font-semibold">You’re all caught up.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">When someone messages you, comments on your post, likes your work, or responds to your topic, you’ll see it here.</p>
              <Link href="/feed" className="mt-6 inline-flex rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100">Explore activity ↗</Link>
            </div>}
        </section>
        <p className="mt-6 text-[10px] leading-5 text-white/30">Notifications are visible only to their intended recipient. You can mark all as read or dismiss individual items.</p>
      </div>
    </main>
  );
}
