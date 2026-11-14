"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { voiceCallsEnabled } from "@/lib/voice-calls-config";
import { ConversationRail } from "@/components/conversation-rail";
import { CommunicationIcon } from "@/components/communication-icon";

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
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [requestStatus, setRequestStatus] = useState<ConversationRow["request_status"]>("ACCEPTED");
  const [requestCreatorId, setRequestCreatorId] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedBetween, setBlockedBetween] = useState(false);
  const [moderatingRequest, setModeratingRequest] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<"idle" | "sent" | "failed">("idle");
  const [calling, setCalling] = useState(false);
  const [pageError, setPageError] = useState("");
  const [threadUnavailable, setThreadUnavailable] = useState(false);

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
      setThreadUnavailable(true);
      setPageError(conversationError?.message ?? "This conversation isn’t available to your account.");
      setLoading(false);
      return;
    }

    setThreadUnavailable(false);
    const conversation = conversationData as ConversationRow;
    const otherId = conversation.user_low_id === currentUserId ? conversation.user_high_id : conversation.user_low_id;
    const [{ data: profileData }, { data: messageData, error: messageError }, { data: blockData }, { data: blockedPair, error: blockedPairError }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, headline").eq("id", otherId).maybeSingle(),
      supabase.from("direct_messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", currentUserId).eq("blocked_id", otherId).maybeSingle(),
      supabase.rpc("users_blocked", { p_user_a: currentUserId, p_user_b: otherId }),
    ]);
    setRequestStatus(conversation.request_status);
    setRequestCreatorId(conversation.created_by);
    setBlockedByMe(Boolean(blockData));
    // Fail closed: if the block lookup fails, do not offer the send form.
    // Row-level security independently enforces messaging permissions.
    setBlockedBetween(Boolean(blockedPair) || Boolean(blockedPairError));

    if (messageError) setPageError(messageError.message);
    else if (blockedPairError) setPageError("We could not verify messaging permissions. Refresh to try again.");
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

  // iOS virtual keyboards can shrink visualViewport without resizing 100dvh.
  // Limit the variable to this page so other screens keep their own viewport rules.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      workspaceRef.current?.style.setProperty("--converge-chat-visible-height", `${Math.floor(viewport.height)}px`);
    };
    resize();
    viewport.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Scroll *within the conversation*, not the whole page. scrollIntoView previously
  // pushed the composer below the mobile viewport when a thread opened or refreshed.
  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !viewerId || threadUnavailable || sending || body.length > 5000) return;

    setSending(true);
    setSendFeedback("idle");
    setPageError("");
    try {
      const { error } = await supabase.from("direct_messages").insert({
        conversation_id: conversationId,
        sender_id: viewerId,
        body,
      });
      if (error) throw error;
      setDraft("");
      setSendFeedback("sent");
      await loadThread(viewerId);
    } catch (caught) {
      setSendFeedback("failed");
      setPageError(caught instanceof Error ? caught.message : "Could not send your message. Try again.");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey ||
        event.ctrlKey || event.metaKey || event.nativeEvent.isComposing || sending) return;
    // Preserve the normal keyboard return/newline behavior on phones.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const isIncomingRequest = requestStatus === "PENDING" && requestCreatorId !== viewerId;
  const isOutgoingRequest = requestStatus === "PENDING" && requestCreatorId === viewerId;
  const canSend = !blockedBetween && (requestStatus === "ACCEPTED" || (isOutgoingRequest && messages.length === 0));

  async function startCall(kind: "audio" | "video") {
    if (!voiceCallsEnabled || !viewerId || calling || blockedBetween || requestStatus !== "ACCEPTED") return;
    setCalling(true);
    setPageError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Calls require HTTPS and a compatible browser.");
      const { data: callId, error: callError } = kind === "video"
        ? await supabase.rpc("start_video_call", { p_conversation_id: conversationId })
        : await supabase.rpc("start_voice_call", { p_conversation_id: conversationId });
      if (callError) throw callError;
      if (typeof callId !== "string") throw new Error("The call could not be started.");
      router.push("/calls/" + callId);
    } catch (caught) {
      setPageError(caught instanceof Error ? caught.message : "Could not start the call.");
      setCalling(false);
    }
  }

  async function respondToMessageRequest(action: "accept" | "ignore" | "block") {
    if (!viewerId || !member || moderatingRequest) return;
    setModeratingRequest(true);
    setPageError("");
    try {
      if (action === "block") {
        if (!window.confirm(`Block ${member.display_name}? They won't be able to send you new messages.`)) return;
        const { error } = await supabase.rpc("block_user", { p_blocked_user_id: member.id });
        if (error) throw error;
        router.replace("/messages");
      } else {
        const { error } = await supabase.rpc("respond_direct_message_request", {
          p_conversation_id: conversationId,
          p_action: action,
        });
        if (error) throw error;
        if (action === "ignore") router.replace("/messages");
        else await loadThread(viewerId);
      }
    } catch (caught) {
      setPageError(caught instanceof Error ? caught.message : "Could not respond to the message request. Try again.");
    } finally {
      setModeratingRequest(false);
    }
  }

  async function toggleBlock() {
    if (!viewerId || !member || moderatingRequest) return;
    if (!blockedByMe && !window.confirm(`Block ${member.display_name}? You can unblock them from your inbox later.`)) return;
    setModeratingRequest(true);
    setPageError("");
    try {
      const { error } = blockedByMe
        ? await supabase.rpc("unblock_user", { p_blocked_user_id: member.id })
        : await supabase.rpc("block_user", { p_blocked_user_id: member.id });
      if (error) throw error;
      if (blockedByMe) {
        await loadThread(viewerId);
      } else {
        router.replace("/messages");
      }
    } catch (caught) {
      setPageError(caught instanceof Error ? caught.message : "Could not change this block. Try again.");
    } finally {
      setModeratingRequest(false);
    }
  }

  return (
    <main ref={workspaceRef} className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="converge-chat-workspace mx-auto flex min-h-[calc(100vh-72px)] max-w-[1400px] flex-col px-3 pb-6 pt-4 sm:px-7 sm:pt-7">
        <div className="converge-chat-grid">
          <ConversationRail viewerId={viewerId} activeId={conversationId} />
          <div className="converge-chat-main">
        <div className="converge-chat-header mb-4 flex items-center gap-3">
          <Link href="/messages" className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/65 transition hover:border-emerald-200/25 hover:text-white" aria-label="Back to inbox"><CommunicationIcon name="arrow-left" className="size-5" /></Link>
          <div className="min-w-0 flex-1">
            <p className="converge-chat-header__eyebrow text-[9px] font-bold uppercase tracking-[0.19em] text-emerald-200/70">Converge / Private message</p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.04em]">{member?.display_name ?? "Conversation"}</h1>
            {member?.headline && <p className="truncate text-[11px] text-white/40">{member.headline}</p>}
          </div>
          {member && viewerId && requestStatus === "ACCEPTED" && !blockedBetween && (
            voiceCallsEnabled ? (
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => void startCall("audio")} disabled={calling || moderatingRequest}
                  aria-label={`Voice call ${member.display_name}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200/30 bg-emerald-200/[.08] px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-200/[.15] disabled:opacity-40">
                  <CommunicationIcon name="phone" className="size-4" /><span className="hidden sm:inline">{calling ? "Starting…" : "Voice"}</span>
                </button>
                <button type="button" onClick={() => void startCall("video")} disabled={calling || moderatingRequest}
                  aria-label={`Video call ${member.display_name}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-200 px-3 text-xs font-bold text-[#0d2016] transition hover:bg-emerald-100 disabled:opacity-40">
                  <CommunicationIcon name="video" className="size-4" /><span className="hidden sm:inline">{calling ? "Starting…" : "Video"}</span>
                </button>
              </div>
            ) : (
              <Link href="/calls" aria-label="Voice calls — setup in progress"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-white/65 hover:border-emerald-200/30 hover:text-emerald-100">
                <span aria-hidden="true">☎</span><span className="hidden sm:inline">Call setup</span>
              </Link>
            )
          )}
          {member && (
             <details className="converge-thread-options relative shrink-0">
               <summary aria-label="Conversation options" className="grid size-11 cursor-pointer place-items-center rounded-xl border border-white/10 text-white/75 transition hover:border-emerald-200/30 hover:bg-emerald-200/[.05] hover:text-emerald-100">
                 <CommunicationIcon name="more" className="size-5" />
               </summary>
               <div className="absolute right-0 top-[calc(100%+8px)] z-30 grid min-w-[208px] gap-1 rounded-2xl border border-white/15 bg-[#14241b] p-2 text-left shadow-[0_16px_48px_rgba(0,0,0,.45)]">
                 <Link href={`/u/${member.username || member.id}`} className="rounded-xl px-3 py-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.06]">View member profile</Link>
                 <button type="button" onClick={() => void toggleBlock()} disabled={moderatingRequest}
                   className="rounded-xl px-3 py-3 text-left text-xs font-semibold text-red-200 transition hover:bg-red-200/[.07] disabled:opacity-40">
                   {moderatingRequest ? "Working…" : blockedByMe ? "Unblock this member" : "Block this member"}
                 </button>
               </div>
             </details>
           )}
        </div>

        <section className="converge-chat-thread flex min-h-[65vh] min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101815]/75">
          {loading ? (
            <div className="flex-1 space-y-4 p-6">{[0, 1, 2, 3].map((item) => <div key={item} className={["h-16 animate-pulse rounded-2xl bg-white/[0.04]", item % 2 ? "ml-auto w-2/3" : "w-3/4"].join(" ")} />)}</div>
          ) : threadUnavailable && !messages.length ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-2xl border border-red-200/15 bg-red-200/[0.05] text-xl text-red-100">!</div>
              <h2 className="mt-4 text-xl font-semibold">Conversation unavailable</h2>
              <p role="alert" className="mt-2 max-w-lg text-sm leading-6 text-white/45">{pageError}</p>
              <Link href="/messages" className="mt-5 rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Back to inbox</Link>
            </div>
          ) : (
            <>
                            {isIncomingRequest && <div className="border-b border-amber-200/15 bg-amber-200/[0.04] px-4 py-4 sm:px-6">
                <p className="text-sm font-semibold text-amber-100">Message request</p>
                <p className="mt-1 text-xs leading-5 text-white/55">{member?.display_name ?? "This member"} wants to start a private conversation. Accept to allow replies, ignore to dismiss the request, or block them to stop future contact.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={moderatingRequest || blockedBetween} onClick={() => void respondToMessageRequest("accept")} className="rounded-full bg-emerald-200 px-4 py-2 text-xs font-bold text-[#0b1710] disabled:opacity-40">{moderatingRequest ? "Working…" : "Accept request"}</button>
                  <button type="button" disabled={moderatingRequest} onClick={() => void respondToMessageRequest("ignore")} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 disabled:opacity-40">Ignore</button>
                  <button type="button" disabled={moderatingRequest} onClick={() => void respondToMessageRequest("block")} className="rounded-full border border-red-300/25 px-4 py-2 text-xs font-semibold text-red-100 disabled:opacity-40">Block person</button>
                </div>
              </div>}
              {isOutgoingRequest && <div className="border-b border-amber-200/15 bg-amber-200/[0.035] px-4 py-3 text-xs leading-5 text-amber-100/75 sm:px-6">{messages.length ? "Your message request has been sent. You can send no further messages until it is accepted." : "This member is not connected with you yet. Send one introductory message; they can accept or ignore the request."}</div>}
              {requestStatus === "IGNORED" && requestCreatorId === viewerId && <div className="border-b border-white/10 px-4 py-3 text-xs text-white/50 sm:px-6">This message request was ignored. You can no longer send messages in this conversation.</div>}
              {blockedByMe && <div className="border-b border-red-300/15 bg-red-300/[0.04] px-4 py-3 text-xs leading-5 text-red-100/80 sm:px-6">You have blocked this person. Open conversation options above to unblock them.</div>}
              {blockedBetween && !blockedByMe && <div className="border-b border-red-300/15 bg-red-300/[0.04] px-4 py-3 text-xs leading-5 text-red-100/80 sm:px-6">Messaging is unavailable because one of you has blocked the other.</div>}
              <div ref={messagesViewportRef} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions" className="converge-chat-messages min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-6 sm:py-7">
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
              </div>
              {pageError && <p role="alert" className="mx-4 mb-3 rounded-xl border border-red-300/20 bg-red-300/[0.05] px-3 py-2 text-xs leading-5 text-red-200 sm:mx-6">{pageError}</p>}
              {canSend ? <form onSubmit={sendMessage} className="converge-chat-composer border-t border-white/[0.08] p-3 sm:p-5" aria-label="Send a direct message">
                <label htmlFor="message-body" className="sr-only">Write a message</label>
                <div className="flex items-end gap-2 rounded-2xl border border-white/[0.1] bg-[#0b1110] p-2 focus-within:border-emerald-200/25">
                  <textarea id="message-body" value={draft} onChange={(event) => { setDraft(event.target.value); setSendFeedback("idle"); }}
                     onKeyDown={handleComposerKeyDown} maxLength={5000} rows={2}
                     aria-describedby="converge-message-composer-help"
                     placeholder={isOutgoingRequest ? "Write your introductory message…" : "Write a message…"}
                     className="min-w-0 max-h-36 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-base leading-6 text-white outline-none placeholder:text-white/35 sm:text-sm" />
                  <button type="submit" disabled={!draft.trim() || sending || draft.trim().length > 5000} className="mb-0.5 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-200 px-4 py-3 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"><CommunicationIcon name="send" className="size-4" /><span>{sending ? "Sending…" : "Send"}</span></button>
                </div>
                <div id="converge-message-composer-help" className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-white/45">
                  <span>{isOutgoingRequest ? "Send one introduction. Replies unlock when accepted." : "Enter to send · Shift + Enter for a new line"}</span>
                  <span className={draft.length > 4500 ? "text-amber-100" : ""}>{draft.length.toLocaleString()} / 5,000</span>
                </div>
                <div role="status" aria-live="polite" className="min-h-4 px-1 text-[11px]">
                  {sendFeedback === "sent" && !draft && <span className="inline-flex items-center gap-1.5 text-emerald-100"><CommunicationIcon name="check" className="size-3.5" />Message sent</span>}
                  {sendFeedback === "failed" && <span className="text-red-200">Not sent — your draft is preserved. Try again.</span>}
                </div>
              </form> : <div className="border-t border-white/[0.08] px-4 py-5 text-center text-xs leading-5 text-white/40">{blockedByMe ? "You have blocked this person." : blockedBetween ? "Messaging is unavailable because one of you has blocked the other." : isIncomingRequest ? "Accept the request to reply." : "Messaging is not available for this conversation."}</div>}
            </>
          )}
        </section>
          </div>
          <aside className="converge-chat-context" aria-label="Conversation details">
            <div className="converge-chat-context__identity">
              <div className="converge-chat-context__avatar" aria-hidden="true">{member?.avatar_url ? <img src={member.avatar_url} alt="" /> : initials(member?.display_name ?? "Converge")}</div>
              <h2>{member?.display_name ?? "Conversation"}</h2>
              {member?.headline && <p>{member.headline}</p>}
              {member && <Link href={`/u/${member.username || member.id}`} className="converge-app-action">View member profile ↗</Link>}
            </div>

          </aside>
        </div>
      </div>
    </main>
  );
}
