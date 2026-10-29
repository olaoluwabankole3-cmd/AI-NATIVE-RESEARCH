"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type ConversationRow = { id: string; user_low_id: string; user_high_id: string; created_by: string; request_status: "PENDING" | "ACCEPTED" | "IGNORED" };
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
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
}

export default function DirectConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId ?? "";
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [requestStatus, setRequestStatus] = useState<ConversationRow["request_status"]>("ACCEPTED");
  const [requestCreatorId, setRequestCreatorId] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [moderatingRequest, setModeratingRequest] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState("");

  const loadThread = useCallback(async (knownUserId?: string) => {
    const currentUserId = knownUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!currentUserId) {
      router.replace(`/sign-in?next=${encodeURIComponent(`/messages/${conversationId}`)}`);
      return;
    }
    setViewerId(currentUserId);

    const { data: conversationData, error: conversationError } = await supabase
      .from("direct_conversations")
      .select("id, user_low_id, user_high_id, created_by, request_status")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError || !conversationData) {
      setPageError(conversationError?.message ?? "This conversation isn’t available to your account.");
      setLoading(false);
      return;
    }

    const conversation = conversationData as ConversationRow;
    const otherId = conversation.user_low_id === currentUserId ? conversation.user_high_id : conversation.user_low_id;
    const [{ data: profileData }, { data: messageData, error: messageError }, { data: blockData }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, headline").eq("id", otherId).maybeSingle(),
      supabase.from("direct_messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", currentUserId).eq("blocked_id", otherId).maybeSingle(),
    ]);
    setRequestStatus(conversation.request_status);
    setRequestCreatorId(conversation.created_by);
    setBlockedByMe(Boolean(blockData));

    if (messageError) setPageError(messageError.message);
    else setPageError("");
    setMember((profileData as MemberProfile | null) ?? {
      id: otherId, username: null, display_name: `Converge member · ${otherId.slice(0, 6)}`, avatar_url: null, headline: null,
    });
    setMessages((messageData ?? []) as MessageRow[]);
    setLoading(false);
  }, [conversationId, router, supabase]);

  useEffect(() => {
    let active = true;
    async function start() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace(`/sign-in?next=${encodeURIComponent(`/messages/${conversationId}`)}`);
        return;
      }
      await loadThread(user.id);
    }
    void start();
    return () => { active = false; };
  }, [conversationId, loadThread, router, supabase]);

  useEffect(() => {
    if (!viewerId || !conversationId) return;
    const channel = supabase
      .channel(`direct-messages-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, () => { void loadThread(viewerId); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, loadThread, supabase, viewerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !viewerId || sending || body.length > 5000) return;

    setSending(true);
    setPageError("");
    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      sender_id: viewerId,
      body,
    });
    if (error) {
      setPageError(error.message);
    } else {
      setDraft("");
      await loadThread(viewerId);
    }
    setSending(false);
  }

  const isIncomingRequest = requestStatus === "PENDING" && requestCreatorId !== viewerId;
  const isOutgoingRequest = requestStatus === "PENDING" && requestCreatorId === viewerId;
  const canSend = !blockedByMe && requestStatus === "ACCEPTED" || (!blockedByMe && isOutgoingRequest && messages.length === 0);

  async function respondToMessageRequest(action: "accept" | "ignore" | "block") {
    if (!viewerId || !member || moderatingRequest) return;
    setModeratingRequest(true);
    setPageError("");
    if (action === "block") {
      const { error } = await supabase.rpc("block_user", { p_blocked_user_id: member.id });
      if (error) setPageError(error.message);
      else router.replace("/messages");
    } else {
      const { error } = await supabase.rpc("respond_direct_message_request", {
        p_conversation_id: conversationId,
        p_action: action,
      });
      if (error) setPageError(error.message);
      else if (action === "ignore") router.replace("/messages");
      else await loadThread(viewerId);
    }
    setModeratingRequest(false);
  }

  async function toggleBlock() {
    if (!viewerId || !member || moderatingRequest) return;
    setModeratingRequest(true);
    setPageError("");
    const { error } = blockedByMe
      ? await supabase.rpc("unblock_user", { p_blocked_user_id: member.id })
      : await supabase.rpc("block_user", { p_blocked_user_id: member.id });
    if (error) setPageError(error.message);
    else if (blockedByMe) {
      setBlockedByMe(false);
      await loadThread(viewerId);
    } else router.replace("/messages");
    setModeratingRequest(false);
  }

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1120px] flex-col px-3 pb-6 pt-4 sm:px-7 sm:pt-7">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/messages" className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-white/65 transition hover:border-emerald-200/25 hover:text-white" aria-label="Back to inbox">←</Link>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.19em] text-emerald-200/70">Converge / Private message</p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.04em]">{member?.display_name ?? "Conversation"}</h1>
            {member?.headline && <p className="truncate text-[11px] text-white/40">{member.headline}</p>}
          </div>
          {member && <Link href={`/u/${member.username || member.id}`} className="hidden rounded-full border border-white/12 px-3.5 py-2 text-[11px] font-semibold text-white/60 hover:border-emerald-200/25 hover:text-white sm:inline-flex">View profile ↗</Link>}
          {member && <button type="button" onClick={() => void toggleBlock()} disabled={moderatingRequest} className="rounded-full border border-red-300/20 px-3 py-2 text-[10px] font-semibold text-red-100/80 transition hover:bg-red-300/[0.06] disabled:opacity-40">{moderatingRequest ? "…" : blockedByMe ? "Unblock" : "Block"}</button>}
        </div>

        <section className="flex min-h-[65vh] flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101815]/75">
          {loading ? (
            <div className="flex-1 space-y-4 p-6">{[0, 1, 2, 3].map((item) => <div key={item} className={["h-16 animate-pulse rounded-2xl bg-white/[0.04]", item % 2 ? "ml-auto w-2/3" : "w-3/4"].join(" ")} />)}</div>
          ) : pageError && !messages.length ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-red-200/15 bg-red-200/[0.05] text-xl text-red-100">!</div>
              <h2 className="mt-4 text-xl font-semibold">Conversation unavailable</h2>
              <p role="alert" className="mt-2 max-w-lg text-sm leading-6 text-white/45">{pageError}</p>
              <Link href="/messages" className="mt-5 rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Back to inbox</Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-6">
                <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-emerald-200/[0.08] text-xs font-bold text-emerald-100">{member?.avatar_url ? <img src={member.avatar_url} alt="" className="size-full object-cover" /> : initials(member?.display_name ?? "Converge")}</div>
                <p className="text-xs text-white/50">Private conversation · messages are visible only to these two members.</p>
              </div>
              {isIncomingRequest && <div className="border-b border-amber-200/15 bg-amber-200/[0.04] px-4 py-4 sm:px-6">
                <p className="text-sm font-semibold text-amber-100">Message request</p>
                <p className="mt-1 text-xs leading-5 text-white/55">{member?.display_name ?? "This member"} wants to start a private conversation. Accept to allow replies, ignore to dismiss the request, or block them to stop future contact.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={moderatingRequest || blockedByMe} onClick={() => void respondToMessageRequest("accept")} className="rounded-full bg-emerald-200 px-4 py-2 text-xs font-bold text-[#0b1710] disabled:opacity-40">{moderatingRequest ? "Working…" : "Accept request"}</button>
                  <button type="button" disabled={moderatingRequest} onClick={() => void respondToMessageRequest("ignore")} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 disabled:opacity-40">Ignore</button>
                  <button type="button" disabled={moderatingRequest} onClick={() => void respondToMessageRequest("block")} className="rounded-full border border-red-300/25 px-4 py-2 text-xs font-semibold text-red-100 disabled:opacity-40">Block person</button>
                </div>
              </div>}
              {isOutgoingRequest && <div className="border-b border-amber-200/15 bg-amber-200/[0.035] px-4 py-3 text-xs leading-5 text-amber-100/75 sm:px-6">{messages.length ? "Your message request has been sent. You can send no further messages until it is accepted." : "This member is not connected with you yet. Send one introductory message; they can accept or ignore the request."}</div>}
              {requestStatus === "IGNORED" && requestCreatorId === viewerId && <div className="border-b border-white/10 px-4 py-3 text-xs text-white/50 sm:px-6">This message request was ignored. You can no longer send messages in this conversation.</div>}
              {blockedByMe && <div className="border-b border-red-300/15 bg-red-300/[0.04] px-4 py-3 text-xs leading-5 text-red-100/80 sm:px-6">You have blocked this person. Unblock them above to allow contact again.</div>}
              <div className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6 sm:py-7">
                {messages.length ? messages.map((message) => {
                  const own = message.sender_id === viewerId;
                  return (
                    <div key={message.id} className={["flex", own ? "justify-end" : "justify-start"].join(" ")}>
                      <div className={["max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%]", own ? "rounded-br-md border border-emerald-200/15 bg-emerald-200/[0.11]" : "rounded-bl-md border border-white/[0.08] bg-white/[0.035]"].join(" ")}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/85">{message.body}</p>
                        <p className={["mt-2 text-right text-[9px]", own ? "text-emerald-100/55" : "text-white/30"].join(" ")}>{own ? "You · " : ""}{timeLabel(message.created_at)}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex min-h-[35vh] flex-col items-center justify-center px-4 text-center">
                    <div className="grid size-12 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-xl text-emerald-100">↗</div>
                    <h2 className="mt-4 text-lg font-semibold">Start the conversation.</h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-white/40">A thoughtful question, a useful resource, or a quick introduction is a good place to begin.</p>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              {pageError && <p role="alert" className="mx-4 mb-3 rounded-xl border border-red-300/20 bg-red-300/[0.05] px-3 py-2 text-xs leading-5 text-red-200 sm:mx-6">{pageError}</p>}
              {canSend ? <form onSubmit={sendMessage} className="border-t border-white/[0.08] p-3 sm:p-5">
                <label htmlFor="message-body" className="sr-only">Write a message</label>
                <div className="flex items-end gap-2 rounded-2xl border border-white/[0.1] bg-[#0b1110] p-2 focus-within:border-emerald-200/25">
                  <textarea id="message-body" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} rows={2} placeholder={isOutgoingRequest ? "Write your introductory message…" : "Write a message…"} className="max-h-36 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/25" />
                  <button type="submit" disabled={!draft.trim() || sending || draft.trim().length > 5000} className="mb-0.5 inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-200 px-4 py-3 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">{sending ? "Sending…" : "Send ↗"}</button>
                </div>
                <p className="mt-2 px-1 text-[9px] text-white/30">{isOutgoingRequest ? "One introductory message · replies unlock when the request is accepted" : "Private conversation · 5,000 characters max"}</p>
              </form> : <div className="border-t border-white/[0.08] px-4 py-5 text-center text-xs leading-5 text-white/40">{blockedByMe ? "You have blocked this person." : isIncomingRequest ? "Accept the request to reply." : "Messaging is not available for this conversation."}</div>}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
