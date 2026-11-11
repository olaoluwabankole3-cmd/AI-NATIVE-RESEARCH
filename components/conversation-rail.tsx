"use client";

/**
 * Read-only, contextual conversation navigation for the desktop messaging workspace.
 * Uses the same Supabase RLS-protected tables as the existing inbox. All messaging
 * actions and moderation remain in the original page components.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  user_low_id: string;
  user_high_id: string;
  request_status: "PENDING" | "ACCEPTED" | "IGNORED";
  last_message_at: string;
};
type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}
function labelForDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export function ConversationRail({ viewerId, activeId }: { viewerId: string | null; activeId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!viewerId) return;
    async function load() {
      if (!viewerId) return;
      const { data, error } = await supabase.from("direct_conversations")
        .select("id, user_low_id, user_high_id, request_status, last_message_at")
        .or(`user_low_id.eq.${viewerId},user_high_id.eq.${viewerId}`)
        .order("last_message_at", { ascending: false })
        .limit(60);
      if (!mounted) return;
      if (error) {
        setLoadError("Conversation list is unavailable.");
        setLoading(false);
        return;
      }
      const results = (data ?? []) as Conversation[];
      setRows(results);
      const otherIds = [...new Set(results.map((row) => row.user_low_id === viewerId ? row.user_high_id : row.user_low_id))];
      if (otherIds.length) {
        const { data: members } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", otherIds);
        if (!mounted) return;
        const index: Record<string, Profile> = {};
        for (const profile of (members ?? []) as Profile[]) index[profile.id] = profile;
        setProfiles(index);
      }
      setLoadError("");
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [supabase, viewerId]);

  const visible = rows.filter((row) => {
    if (!viewerId) return false;
    const otherId = row.user_low_id === viewerId ? row.user_high_id : row.user_low_id;
    const name = profiles[otherId]?.display_name ?? "Converge member";
    return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });

  return (
    <aside className="converge-conversation-rail" aria-label="Conversations">
      <Link href="/messages" className="converge-conversation-rail__logo" aria-label="Back to inbox">
        <Image src="/converge-header-lockup.svg" alt="Converge" width={166} height={39} />
      </Link>
      <div className="converge-conversation-rail__title">
        <h2>Messages</h2>
        <Link href="/people" aria-label="Find people to message" className="converge-app-action">+ New</Link>
      </div>
      <label htmlFor="converge-conversation-search" className="sr-only">Search conversations</label>
      <input id="converge-conversation-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations…" className="converge-conversation-rail__search" />
      <div className="converge-conversation-rail__caption">YOUR CONVERSATIONS</div>
      {loading ? <p role="status" className="converge-conversation-rail__notice">Loading conversations…</p>
        : loadError ? <p role="alert" className="converge-conversation-rail__notice">{loadError} <Link href="/messages">Open inbox</Link></p>
        : !visible.length ? <p className="converge-conversation-rail__notice">{query ? "No matching conversations." : "Find a person to start a conversation."}</p>
        : <nav aria-label="Conversation list" className="converge-conversation-rail__items">
          {visible.map((row) => {
            const otherId = row.user_low_id === viewerId ? row.user_high_id : row.user_low_id;
            const member = profiles[otherId];
            const name = member?.display_name || "Converge member";
            return <Link key={row.id} href={`/messages/${row.id}`} aria-current={row.id === activeId ? "page" : undefined} className={["converge-conversation-rail__item", row.id === activeId ? "is-active" : ""].join(" ")}>
              <span className="converge-conversation-rail__avatar">{member?.avatar_url ? <img src={member.avatar_url} alt="" /> : initials(name)}</span>
              <span className="converge-conversation-rail__copy">
                <strong>{name}</strong>
                <span>{row.request_status === "PENDING" ? "Message request" : row.request_status === "IGNORED" ? "Request ignored" : "Open conversation"}</span>
              </span>
              <time>{labelForDate(row.last_message_at)}</time>
            </Link>;
          })}
        </nav>}
      <Link href="/messages" className="converge-conversation-rail__footer">View full inbox and requests <span aria-hidden="true">↗</span></Link>
    </aside>
  );
}
