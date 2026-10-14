"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type PostType = "update" | "question" | "idea" | "resource";
type FeedPost = {
  id: string;
  author_id: string;
  post_type: PostType;
  body: string;
  link_url: string | null;
  created_at: string;
  updated_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};
type MemberProfile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  organization: string | null;
};
type RawPost = Omit<FeedPost, "like_count" | "comment_count" | "liked_by_me">;
type LikeRow = { post_id: string; user_id: string };
type CommentRow = { id: string; post_id: string; author_id: string; body: string; created_at: string };
type DisplayComment = CommentRow & { author: MemberProfile | null };

const postTypes: { value: PostType; label: string; help: string }[] = [
  { value: "update", label: "Research update", help: "Share progress, a result, or something you have learned." },
  { value: "question", label: "Question", help: "Invite members to help think through a problem." },
  { value: "idea", label: "Idea", help: "Put an early thought out there for discussion." },
  { value: "resource", label: "Resource", help: "Share a paper, tool, dataset, or useful link." },
];

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}
function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}
function friendlyError(value: string) {
  if (value.includes("activity_posts") || value.includes("activity_comments") || value.includes("activity_likes")) {
    return "The activity feed database is not ready yet. Apply the Converge activity feed migration in Supabase, then refresh this page.";
  }
  return value;
}

export default function ActivityFeedPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerProfile, setViewerProfile] = useState<MemberProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [composerOpen, setComposerOpen] = useState(true);
  const [postType, setPostType] = useState<PostType>("update");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, DisplayComment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [loadingComments, setLoadingComments] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadFeed = useCallback(async (knownViewerId?: string) => {
    const currentViewerId = knownViewerId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!currentViewerId) {
      router.replace("/sign-in?next=/feed");
      return;
    }
    setViewerId(currentViewerId);

    const [{ data: postData, error: postError }, { data: viewerData }] = await Promise.all([
      supabase.from("activity_posts")
        .select("id, author_id, post_type, body, link_url, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("profiles")
        .select("id, username, display_name, avatar_url, headline, organization")
        .eq("id", currentViewerId)
        .maybeSingle(),
    ]);

    if (postError) {
      setLoadError(friendlyError(postError.message));
      setLoading(false);
      return;
    }
    setLoadError("");
    setViewerProfile((viewerData as MemberProfile | null) ?? null);
    const rawPosts = (postData ?? []) as RawPost[];
    if (!rawPosts.length) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postIds = rawPosts.map((post) => post.id);
    const authorIds = [...new Set(rawPosts.map((post) => post.author_id))];
    const [{ data: likesData, error: likesError }, { data: commentsData, error: commentsError }, { data: profilesData }] = await Promise.all([
      supabase.from("activity_likes").select("post_id, user_id").in("post_id", postIds),
      supabase.from("activity_comments").select("id, post_id").in("post_id", postIds).limit(1000),
      supabase.from("profiles").select("id, username, display_name, avatar_url, headline, organization").in("id", authorIds),
    ]);

    if (likesError || commentsError) {
      setLoadError(friendlyError((likesError ?? commentsError)?.message ?? "Feed activity could not be loaded."));
    }
    const likes = (likesData ?? []) as LikeRow[];
    const comments = (commentsData ?? []) as { id: string; post_id: string }[];
    const likeCounts: Record<string, number> = {};
    const commentCounts: Record<string, number> = {};
    const likedByMe = new Set<string>();
    for (const like of likes) {
      likeCounts[like.post_id] = (likeCounts[like.post_id] ?? 0) + 1;
      if (like.user_id === currentViewerId) likedByMe.add(like.post_id);
    }
    for (const comment of comments) commentCounts[comment.post_id] = (commentCounts[comment.post_id] ?? 0) + 1;

    const profileMap: Record<string, MemberProfile> = {};
    for (const profile of (profilesData ?? []) as MemberProfile[]) profileMap[profile.id] = profile;
    setPosts(rawPosts.map((post) => ({
      ...post,
      post_type: post.post_type as PostType,
      like_count: likeCounts[post.id] ?? 0,
      comment_count: commentCounts[post.id] ?? 0,
      liked_by_me: likedByMe.has(post.id),
    })));
    setAuthors(profileMap);
    setLoading(false);
  }, [router, supabase]);

  const [authors, setAuthors] = useState<Record<string, MemberProfile>>({});

  useEffect(() => {
    let active = true;
    async function start() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/sign-in?next=/feed");
        return;
      }
      await loadFeed(user.id);
    }
    void start();
    return () => { active = false; };
  }, [loadFeed, router, supabase]);

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = body.trim();
    const trimmedLink = linkUrl.trim();
    if (!viewerId || !trimmedBody || publishing) return;
    if (trimmedBody.length > 5000) {
      setNotice("Posts must be 5,000 characters or fewer.");
      return;
    }
    if (trimmedLink) {
      try {
        const url = new URL(trimmedLink);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use a web link beginning with http:// or https://.");
      } catch {
        setNotice("Enter a valid web URL beginning with https:// or http://.");
        return;
      }
    }

    setPublishing(true);
    setNotice("");
    const { error } = await supabase.from("activity_posts").insert({
      author_id: viewerId,
      post_type: postType,
      body: trimmedBody,
      link_url: trimmedLink || null,
    });
    if (error) {
      setNotice(friendlyError(error.message));
    } else {
      setBody("");
      setLinkUrl("");
      setPostType("update");
      setNotice("Your post is live.");
      await loadFeed(viewerId);
    }
    setPublishing(false);
  }

  async function toggleLike(post: FeedPost) {
    if (!viewerId || busyPostId) return;
    setBusyPostId(post.id);
    setNotice("");
    const result = post.liked_by_me
      ? await supabase.from("activity_likes").delete().eq("post_id", post.id).eq("user_id", viewerId)
      : await supabase.from("activity_likes").insert({ post_id: post.id, user_id: viewerId });
    if (result.error) {
      setNotice(friendlyError(result.error.message));
    } else {
      await loadFeed(viewerId);
    }
    setBusyPostId(null);
  }

  async function deletePost(postId: string) {
    if (!viewerId || busyPostId) return;
    setBusyPostId(postId);
    setNotice("");
    const { error } = await supabase.from("activity_posts").delete().eq("id", postId).eq("author_id", viewerId);
    if (error) setNotice(error.message);
    else {
      setPosts((current) => current.filter((post) => post.id !== postId));
      setNotice("Post deleted.");
    }
    setBusyPostId(null);
  }

  async function openComments(postId: string) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    setCommentDraft("");
    if (commentsByPost[postId]) return;
    setLoadingComments(postId);
    const { data, error } = await supabase.from("activity_comments")
      .select("id, post_id, author_id, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      setNotice(friendlyError(error.message));
      setLoadingComments(null);
      return;
    }
    const rows = (data ?? []) as CommentRow[];
    const authorIds = [...new Set(rows.map((comment) => comment.author_id))];
    const { data: profileData } = authorIds.length
      ? await supabase.from("profiles").select("id, username, display_name, avatar_url, headline, organization").in("id", authorIds)
      : { data: [] as MemberProfile[] };
    const profileMap: Record<string, MemberProfile> = {};
    for (const profile of (profileData ?? []) as MemberProfile[]) profileMap[profile.id] = profile;
    setCommentsByPost((current) => ({
      ...current,
      [postId]: rows.map((comment) => ({ ...comment, author: profileMap[comment.author_id] ?? null })),
    }));
    setLoadingComments(null);
  }

  async function addComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const trimmed = commentDraft.trim();
    if (!viewerId || !trimmed || commentBusy) return;
    setCommentBusy(true);
    setNotice("");
    const { error } = await supabase.from("activity_comments").insert({
      post_id: postId,
      author_id: viewerId,
      body: trimmed,
    });
    if (error) setNotice(friendlyError(error.message));
    else {
      setCommentDraft("");
      setCommentsByPost((current) => ({ ...current, [postId]: undefined as unknown as DisplayComment[] }));
      setCommentsByPost((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      await loadFeed(viewerId);
      const { data } = await supabase.from("activity_comments")
        .select("id, post_id, author_id, body, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(100);
      const rows = (data ?? []) as CommentRow[];
      const authorIds = [...new Set(rows.map((comment) => comment.author_id))];
      const { data: profileData } = authorIds.length
        ? await supabase.from("profiles").select("id, username, display_name, avatar_url, headline, organization").in("id", authorIds)
        : { data: [] as MemberProfile[] };
      const profileMap: Record<string, MemberProfile> = {};
      for (const profile of (profileData ?? []) as MemberProfile[]) profileMap[profile.id] = profile;
      setCommentsByPost((current) => ({
        ...current,
        [postId]: rows.map((comment) => ({ ...comment, author: profileMap[comment.author_id] ?? null })),
      }));
    }
    setCommentBusy(false);
  }

  const selectedType = postTypes.find((item) => item.value === postType) ?? postTypes[0];

  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="border-b border-white/[0.09] py-9 sm:py-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Activity</p>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Ideas move when they’re shared.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">Research notes, open questions, useful resources, and small discoveries from people across Converge.</p>
            </div>
            <Link href="/people" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-emerald-200/25 hover:text-white">Discover members ↗</Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Recent posts", value: posts.length, note: "Latest member activity" },
              { label: "Your contributions", value: posts.filter((post) => post.author_id === viewerId).length, note: "In the current feed" },
              { label: "Open conversations", value: posts.filter((post) => post.post_type === "question").length, note: "Questions to explore" },
            ].map((item) => <div key={item.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><p className="text-2xl font-semibold tracking-[-0.05em] text-emerald-100">{loading ? "—" : String(item.value).padStart(2, "0")}</p><p className="mt-1 text-xs font-semibold text-white/75">{item.label}</p><p className="mt-1 text-[10px] text-white/35">{item.note}</p></div>)}
          </div>
        </section>

        {(loadError || notice) && <p role={loadError ? "alert" : "status"} className={["mt-5 rounded-xl border px-4 py-3 text-sm leading-6", loadError ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100"].join(" ")}>{loadError || notice}</p>}

        <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-10">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-3xl border border-white/[0.1] bg-[#101815]/80">
              <button type="button" onClick={() => setComposerOpen((open) => !open)} className="flex w-full items-center justify-between border-b border-white/[0.08] px-5 py-4 text-left sm:px-6">
                <div>
                  <p className="text-sm font-semibold">Add to the conversation</p>
                  <p className="mt-1 text-[11px] text-white/40">Share progress, ask a question, or pass on a resource.</p>
                </div>
                <span className="text-lg text-emerald-200">{composerOpen ? "−" : "+"}</span>
              </button>
              {composerOpen && <form onSubmit={publishPost} className="p-4 sm:p-6">
                <div className="flex items-start gap-3">
                  <Link href="/profile" className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.08] text-sm font-bold text-emerald-100">
                    {viewerProfile?.avatar_url ? <img src={viewerProfile.avatar_url} alt="" className="size-full object-cover" /> : initials(viewerProfile?.display_name ?? "You")}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{viewerProfile?.display_name ?? "Your profile"}</p>
                    <p className="mt-1 text-[10px] text-white/35">Posting as you · visible to signed-in members</p>
                  </div>
                </div>
                <label htmlFor="post-type" className="mt-5 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Type of post</label>
                <select id="post-type" value={postType} onChange={(event) => setPostType(event.target.value as PostType)} className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#0b1110] px-3.5 py-3 text-xs text-white/80 outline-none focus:border-emerald-200/30 sm:w-auto">
                  {postTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <p className="mt-2 text-[11px] text-white/35">{selectedType.help}</p>
                <label htmlFor="post-body" className="sr-only">Write your post</label>
                <textarea id="post-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} rows={4} placeholder={postType === "question" ? "What are you trying to figure out?" : postType === "idea" ? "What idea would you like people to think through?" : postType === "resource" ? "Tell us why this resource is useful…" : "What have you been working on or learning?"} className="mt-4 min-h-28 w-full resize-y rounded-2xl border border-white/[0.1] bg-[#0b1110] px-4 py-3 text-sm leading-6 text-white/85 outline-none placeholder:text-white/25 focus:border-emerald-200/25" />
                <label htmlFor="post-link" className="mt-4 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Link (optional)</label>
                <input id="post-link" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} maxLength={2048} placeholder="https://…" className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#0b1110] px-3.5 py-3 text-xs text-white/80 outline-none placeholder:text-white/25 focus:border-emerald-200/25" />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                  <p className="text-[10px] text-white/30">{body.length}/5000 characters</p>
                  <button type="submit" disabled={!body.trim() || publishing} className="inline-flex items-center gap-2 rounded-full bg-emerald-200 px-5 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">{publishing ? "Publishing…" : "Publish post ↗"}</button>
                </div>
              </form>}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">The community pulse</p><h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em]">Latest activity</h2></div>
              <button type="button" onClick={() => { setLoading(true); void loadFeed(viewerId ?? undefined); }} disabled={loading} className="rounded-full border border-white/12 px-3.5 py-2 text-[10px] font-semibold text-white/55 hover:border-emerald-200/20 hover:text-white disabled:opacity-40">↻ Refresh</button>
            </div>

            {loading ? <div className="mt-4 grid gap-3">{[0,1,2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />)}</div>
              : posts.length ? <div className="mt-4 grid gap-4">{posts.map((post) => {
                const author = authors[post.author_id];
                const typeInfo = postTypes.find((type) => type.value === post.post_type) ?? postTypes[0];
                return <article key={post.id} className="overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101815]/80 transition hover:border-white/[0.14]">
                  <div className="px-5 pt-5 sm:px-6 sm:pt-6">
                    <div className="flex items-start gap-3">
                      <Link href={author ? `/u/${author.username || author.id}` : "/people"} className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.08] text-sm font-bold text-emerald-100">
                        {author?.avatar_url ? <img src={author.avatar_url} alt="" className="size-full object-cover" /> : initials(author?.display_name ?? "Converge member")}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link href={author ? `/u/${author.username || author.id}` : "/people"} className="text-sm font-semibold text-white/90 hover:text-emerald-100">{author?.display_name ?? "Converge member"}</Link>
                          <span className="text-[10px] text-white/30">·</span>
                          <time dateTime={post.created_at} className="text-[10px] text-white/35">{timeLabel(post.created_at)}</time>
                          {post.updated_at !== post.created_at && <span className="text-[9px] text-white/25">· edited</span>}
                        </div>
                        {author?.headline && <p className="mt-1 truncate text-[11px] text-white/40">{author.headline}{author.organization ? ` · ${author.organization}` : ""}</p>}
                        <span className="mt-2 inline-flex rounded-full border border-emerald-200/12 bg-emerald-200/[0.04] px-2.5 py-1 text-[9px] font-semibold text-emerald-100/75">{typeInfo.label}</span>
                      </div>
                      {post.author_id === viewerId && <button type="button" disabled={busyPostId === post.id} onClick={() => void deletePost(post.id)} className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-semibold text-white/35 transition hover:border-red-200/20 hover:text-red-100 disabled:opacity-40">Delete</button>}
                    </div>
                    <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-white/80">{post.body}</p>
                    {post.link_url && <a href={post.link_url} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-200/15 bg-emerald-200/[0.04] px-3.5 py-3 text-xs text-emerald-100/85 transition hover:border-emerald-200/30 hover:text-emerald-50"><span className="shrink-0">↗</span><span className="truncate">{post.link_url}</span></a>}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] py-4">
                      <p className="text-[10px] text-white/35">{post.like_count} {post.like_count === 1 ? "like" : "likes"} <span className="mx-1.5 text-white/15">·</span> {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}</p>
                      <div className="flex gap-2">
                        <button type="button" disabled={busyPostId === post.id} onClick={() => void toggleLike(post)} className={["rounded-full border px-3.5 py-2 text-[10px] font-semibold transition disabled:opacity-40", post.liked_by_me ? "border-emerald-200/25 bg-emerald-200/[0.08] text-emerald-100" : "border-white/12 text-white/55 hover:border-emerald-200/20 hover:text-white"].join(" ")}>{post.liked_by_me ? "♥ Liked" : "♡ Like"}</button>
                        <button type="button" onClick={() => void openComments(post.id)} className="rounded-full border border-white/12 px-3.5 py-2 text-[10px] font-semibold text-white/55 transition hover:border-emerald-200/20 hover:text-white">{expandedPostId === post.id ? "Hide comments" : "Comment ↗"}</button>
                      </div>
                    </div>
                  </div>
                  {expandedPostId === post.id && <div className="border-t border-white/[0.07] bg-[#0b1110]/55 px-5 py-5 sm:px-6">
                    <h3 className="text-xs font-semibold text-white/75">Discussion <span className="ml-1 text-white/30">{post.comment_count}</span></h3>
                    {loadingComments === post.id ? <div className="mt-4 h-14 animate-pulse rounded-xl bg-white/[0.035]" />
                      : <div className="mt-4 space-y-4">
                        {(commentsByPost[post.id] ?? []).map((comment) => <div key={comment.id} className="flex items-start gap-2.5">
                          <Link href={comment.author ? `/u/${comment.author.username || comment.author.id}` : "/people"} className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-emerald-200/[0.06] text-[9px] font-bold text-emerald-100">
                            {comment.author?.avatar_url ? <img src={comment.author.avatar_url} alt="" className="size-full object-cover" /> : initials(comment.author?.display_name ?? "Member")}
                          </Link>
                          <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                            <div className="flex flex-wrap items-center gap-2"><Link href={comment.author ? `/u/${comment.author.username || comment.author.id}` : "/people"} className="text-[11px] font-semibold text-white/75 hover:text-emerald-100">{comment.author?.display_name ?? "Converge member"}</Link><time dateTime={comment.created_at} className="text-[9px] text-white/30">{timeLabel(comment.created_at)}</time></div>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-white/65">{comment.body}</p>
                          </div>
                          {comment.author_id === viewerId && <button type="button" onClick={async () => {
                            const { error } = await supabase.from("activity_comments").delete().eq("id", comment.id).eq("author_id", viewerId);
                            if (error) setNotice(error.message);
                            else {
                              setCommentsByPost((current) => ({ ...current, [post.id]: (current[post.id] ?? []).filter((entry) => entry.id !== comment.id) }));
                              await loadFeed(viewerId);
                            }
                          }} className="mt-2 text-[9px] text-white/25 hover:text-red-100">Delete</button>}
                        </div>)}
                        {!commentsByPost[post.id]?.length && <p className="text-xs text-white/35">No comments yet. Start the discussion.</p>}
                      </div>}
                    <form onSubmit={(event) => void addComment(event, post.id)} className="mt-5 flex items-end gap-2">
                      <label htmlFor={`comment-${post.id}`} className="sr-only">Add a comment</label>
                      <textarea id={`comment-${post.id}`} value={expandedPostId === post.id ? commentDraft : ""} onChange={(event) => setCommentDraft(event.target.value)} rows={2} maxLength={2000} placeholder="Add a thoughtful reply…" className="min-h-11 flex-1 resize-y rounded-xl border border-white/[0.1] bg-[#101815] px-3.5 py-2.5 text-xs leading-5 text-white/80 outline-none placeholder:text-white/25 focus:border-emerald-200/25" />
                      <button type="submit" disabled={!commentDraft.trim() || commentBusy} className="rounded-xl bg-emerald-200 px-3.5 py-3 text-[10px] font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-40">{commentBusy ? "…" : "Reply ↗"}</button>
                    </form>
                  </div>}
                </article>;
              })}</div>
              : <div className="mt-4 rounded-3xl border border-dashed border-white/[0.12] px-6 py-14 text-center sm:px-12">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-xl text-emerald-100">✳</div>
                <h3 className="mt-4 text-xl font-semibold">Make the first contribution.</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-white/45">Share a research question, a recent discovery, or a resource that helped your work. Converge gets more useful when members share what they are learning.</p>
                <button type="button" onClick={() => setComposerOpen(true)} className="mt-5 rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Write the first post ↗</button>
              </div>}
          </section>

          <aside className="grid gap-4 lg:sticky lg:top-[96px]">
            <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/70 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">A good contribution</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.04em]">Bring something people can build on.</h2>
              <div className="mt-4 space-y-3 text-xs leading-5 text-white/50">
                <p><strong className="text-white/75">Share context.</strong> Explain what you are exploring and what you have learned.</p>
                <p><strong className="text-white/75">Ask clearly.</strong> Specific questions make it easier for others to help.</p>
                <p><strong className="text-white/75">Credit sources.</strong> Add a link when you reference research, data, or a tool.</p>
              </div>
            </section>
            <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/70 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Continue collaborating</p>
              <div className="mt-4 grid gap-2">
                <Link href="/communities" className="flex items-center justify-between rounded-xl border border-white/[0.08] px-3.5 py-3 text-xs font-semibold text-white/65 transition hover:border-emerald-200/20 hover:text-white">Communities <span className="text-emerald-200">↗</span></Link>
                <Link href="/people" className="flex items-center justify-between rounded-xl border border-white/[0.08] px-3.5 py-3 text-xs font-semibold text-white/65 transition hover:border-emerald-200/20 hover:text-white">Discover members <span className="text-emerald-200">↗</span></Link>
                <Link href="/messages" className="flex items-center justify-between rounded-xl border border-white/[0.08] px-3.5 py-3 text-xs font-semibold text-white/65 transition hover:border-emerald-200/20 hover:text-white">Direct messages <span className="text-emerald-200">↗</span></Link>
                <Link href="/network" className="flex items-center justify-between rounded-xl border border-white/[0.08] px-3.5 py-3 text-xs font-semibold text-white/65 transition hover:border-emerald-200/20 hover:text-white">Your network <span className="text-emerald-200">↗</span></Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
