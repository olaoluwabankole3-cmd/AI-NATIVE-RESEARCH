"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type ConversationRow = {
  id: string;
  user_low_id: string;
  user_high_id: string;
  created_at: string;
  last_message_at: string;
};
type MemberProfile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}
function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export default function MessagesInboxPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [previews, setPreviews] = useState<Record<string, MessageRow>>({});
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const loadInbox = useCallback(async (knownUserId?: string) => {
    const currentUserId = knownUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!currentUserId) {
      router.replace("/sign-in?next=/messages");
      return;
    }

    const { data: conversationData, error: conversationError } = await supabase
      .from("direct_conversations")
      .select("id, user_low_id, user_high_id, created_at, last_message_at")
      .or(`user_low_id.eq.${currentUserId},user_high_id.eq.${currentUserId}`)
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (conversationError) {
      setLoadError(conversationError.message);
      setLoading(false);
      return;
    }

    setViewerId(currentUserId);
    const rows = (conversationData ?? []) as ConversationRow[];
    setConversations(rows);
    const conversationIds = rows.map((row) => row.id);
    const otherIds = [...new Set(rows.map((row) => row.user_low_id === currentUserId ? row.user_high_id : row.user_low_id))];

    if (!conversationIds.length) {
      setProfiles({});
      setPreviews({});
      setLoading(false);
      return;
    }

    const [{ data: profileData }, { data: messageData, error: messageError }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, headline").in("id", otherIds),
      supabase.from("direct_messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (messageError) setLoadError(messageError.message);
    const profileMap: Record<string, MemberProfile> = {};
    for (const profile of (profileData ?? []) as MemberProfile[]) profileMap[profile.id] = profile;
    setProfiles(profileMap);

    const previewMap: Record<string, MessageRow> = {};
    for (const message of (messageData ?? []) as MessageRow[]) {
      if (!previewMap[message.conversation_id]) previewMap[message.conversation_id] = message;
    }
    setPreviews(previewMap);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    let active = true;
    async function start() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/sign-in?next=/messages");
        return;
      }
      await loadInbox(user.id);
    }
    void start();
    return () => { active = false; };
  }, [loadInbox, router, supabase]);

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1120px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="converge-page-intro flex flex-col justify-between gap-5 border-b border-white/[0.09] py-9 sm:flex-row sm:items-end sm:py-12">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Messages</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Conversations that keep ideas moving.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">A private space to follow up, exchange ideas, and work with people in your network.</p>
          </div>
          <Link href="/people" className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100">Find people ↗</Link>
        </section>

        {loadError && <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-300/[0.05] px-4 py-3 text-sm leading-6 text-red-200">{loadError}</p>}

        {loading ? (
          <div className="mt-6 grid gap-3">{[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />)}</div>
        ) : conversations.length ? (
          <section className="mt-6 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101815]/70">
            {conversations.map((conversation, index) => {
              const otherId = conversation.user_low_id === viewerId ? conversation.user_high_id : conversation.user_low_id;
              const member = profiles[otherId] ?? {
                id: otherId, username: null, display_name: `Converge member · ${otherId.slice(0, 6)}`, avatar_url: null, headline: null,
              };
              const preview = previews[conversation.id];
              return (
                <Link key={conversation.id} href={`/messages/${conversation.id}`} className={["flex items-center gap-4 px-4 py-4 transition hover:bg-white/[0.035] sm:px-6", index > 0 ? "border-t border-white/[0.07]" : ""].join(" ")}>
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[16px] border border-emerald-200/15 bg-emerald-200/[0.08] text-sm font-bold text-emerald-100">
                    {member.avatar_url ? <img src={member.avatar_url} alt="" className="size-full object-cover" /> : initials(member.display_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white/90">{member.display_name}</p>
                      <span className="shrink-0 text-[10px] text-white/35">{timeLabel(preview?.created_at ?? conversation.last_message_at)}</span>
                    </div>
                    {member.headline && <p className="mt-1 truncate text-[11px] text-white/35">{member.headline}</p>}
                    <p className="mt-2 truncate text-xs text-white/50">{preview ? `${preview.sender_id === viewerId ? "You: " : ""}${preview.body}` : "No messages yet — say hello."}</p>
                  </div>
                  <span aria-hidden="true" className="text-lg text-white/25">›</span>
                </Link>
              );
            })}
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-dashed border-white/[0.12] px-6 py-16 text-center sm:px-12">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-2xl text-emerald-100">↗</div>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.045em]">Your first conversation starts with a connection.</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/45">Connect with a member first. Once they accept, open their profile or find them in People and choose Message. Your conversation will be saved here.</p>
            <Link href="/people" className="mt-6 inline-flex rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100">Discover members ↗</Link>
          </section>
        )}
      </div>
    </main>
  );
}
