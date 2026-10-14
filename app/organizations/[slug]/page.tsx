"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type OrganizationType = "company" | "university" | "research_lab" | "research_group" | "nonprofit" | "other";
type Organization = {
  id: string; name: string; slug: string; organization_type: OrganizationType;
  tagline: string | null; description: string | null; website_url: string | null;
  location: string | null; logo_url: string | null; cover_url: string | null;
  created_by: string; created_at: string; updated_at: string;
};
type ProfileSummary = { id: string; username: string | null; display_name: string; avatar_url: string | null; headline: string | null };
type MemberRow = { organization_id: string; user_id: string; role: "OWNER" | "ADMIN" | "MEMBER"; status: "ACTIVE" | "REQUESTED"; created_at: string };
type Member = MemberRow & { profile: ProfileSummary | null };
type OrganizationForm = Pick<Organization, "name" | "organization_type" | "tagline" | "description" | "website_url" | "location">;

const types: { value: OrganizationType; label: string }[] = [
  { value: "company", label: "Company" }, { value: "university", label: "University" },
  { value: "research_lab", label: "Research lab" }, { value: "research_group", label: "Research group" },
  { value: "nonprofit", label: "Nonprofit" }, { value: "other", label: "Other" },
];
const inputClass = "mt-2 w-full rounded-xl border border-white/[0.11] bg-[#0a100d] px-3.5 py-3 text-sm text-[#edf5ee] outline-none transition placeholder:text-white/25 focus:border-emerald-200/55";
const labelClass = "block text-[12px] font-semibold text-white/75";
function initials(value: string) { return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "O"; }
function typeLabel(value: OrganizationType) { return types.find((item) => item.value === value)?.label ?? "Organisation"; }
function normaliseWebsite(value: string) {
  if (!value.trim()) return null;
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Enter a valid website address.");
  return parsed.toString();
}
function memberName(member: Member) { return member.profile?.display_name || `Converge member · ${member.user_id.slice(0, 6)}`; }

export default function OrganizationDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug ?? "").toLowerCase();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<OrganizationForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [memberAction, setMemberAction] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const refreshMembers = useCallback(async (organizationId: string) => {
    const { data, error } = await supabase.from("organization_members")
      .select("organization_id, user_id, role, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
    if (error) return;
    const rows = (data ?? []) as MemberRow[];
    const ids = [...new Set(rows.map((member) => member.user_id))];
    let profiles: ProfileSummary[] = [];
    if (ids.length) {
      const { data: profileData } = await supabase.from("profiles")
        .select("id, username, display_name, avatar_url, headline").in("id", ids);
      profiles = (profileData ?? []) as ProfileSummary[];
    }
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    setMembers(rows.map((member) => ({ ...member, profile: profileMap.get(member.user_id) ?? null })));
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      if (!active) return;
      const viewerId = authData.user?.id ?? null;
      setUserId(viewerId);
      const { data, error } = await supabase.from("organizations")
        .select("id, name, slug, organization_type, tagline, description, website_url, location, logo_url, cover_url, created_by, created_at, updated_at")
        .eq("slug", slug).maybeSingle();
      if (!active) return;
      if (error) {
        setPageError("The organisation database setup is not complete. Apply the Converge organisation migration in Supabase, then reload this page.");
        setLoading(false);
        return;
      }
      if (!data) { setLoading(false); return; }
      const org = data as Organization;
      setOrganization(org);
      setForm({ name: org.name, organization_type: org.organization_type, tagline: org.tagline ?? "", description: org.description ?? "", website_url: org.website_url ?? "", location: org.location ?? "" });
      await refreshMembers(org.id);
      if (active) setLoading(false);
    }
    if (slug) void load(); else setLoading(false);
    return () => { active = false; };
  }, [slug, supabase, refreshMembers]);

  const myMembership = members.find((member) => member.user_id === userId) ?? null;
  const isOwner = Boolean(organization && userId && (organization.created_by === userId || (myMembership?.role === "OWNER" && myMembership.status === "ACTIVE")));
  const canManage = isOwner || (myMembership?.status === "ACTIVE" && myMembership.role === "ADMIN");
  const activeMembers = members.filter((member) => member.status === "ACTIVE");
  const requests = members.filter((member) => member.status === "REQUESTED");

  function update<K extends keyof OrganizationForm>(key: K, value: OrganizationForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !form) return;
    let websiteUrl: string | null;
    try { websiteUrl = normaliseWebsite(form.website_url ?? ""); }
    catch { setMessage("Enter a valid website address, such as organisation.org."); setMessageTone("error"); return; }
    if (form.name.trim().length < 2) { setMessage("Organisation name must contain at least two characters."); setMessageTone("error"); return; }
    setSaving(true); setMessage("");
    const { data, error } = await supabase.from("organizations").update({
      name: form.name.trim(), organization_type: form.organization_type,
      tagline: form.tagline?.trim() || null, description: form.description?.trim() || null,
      website_url: websiteUrl, location: form.location?.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", organization.id)
      .select("id, name, slug, organization_type, tagline, description, website_url, location, logo_url, cover_url, created_by, created_at, updated_at")
      .single();
    if (error || !data) {
      setMessage(error?.message ?? "The organisation could not be updated."); setMessageTone("error");
    } else {
      setOrganization(data as Organization);
      setForm({ ...form, name: data.name, website_url: data.website_url ?? "" });
      setEditing(false); setMessage("Organisation details saved."); setMessageTone("success");
    }
    setSaving(false);
  }

  async function handleAssetUpload(event: ChangeEvent<HTMLInputElement>, asset: "logo" | "cover") {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !organization || !userId) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setMessage("Choose a JPG, PNG, WebP, or GIF image."); setMessageTone("error"); return;
    }
    if (file.size > 8 * 1024 * 1024) { setMessage("Organisation images must be 8 MB or smaller."); setMessageTone("error"); return; }
    setUploading(asset); setMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${organization.id}/${userId}/${asset}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("organization-assets").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) {
      setMessage(uploadError.message.includes("Bucket not found") ? "Organisation image storage is not set up. Apply the organisation migration in Supabase, then retry." : uploadError.message);
      setMessageTone("error"); setUploading(null); return;
    }
    const { data: urlData } = supabase.storage.from("organization-assets").getPublicUrl(path);
    const column = asset === "logo" ? "logo_url" : "cover_url";
    const { data, error } = await supabase.from("organizations").update({ [column]: urlData.publicUrl })
      .eq("id", organization.id)
      .select("id, name, slug, organization_type, tagline, description, website_url, location, logo_url, cover_url, created_by, created_at, updated_at").single();
    if (error || !data) {
      await supabase.storage.from("organization-assets").remove([path]);
      setMessage(error?.message ?? "The uploaded image could not be attached to this organisation.");
      setMessageTone("error"); setUploading(null); return;
    }
    setOrganization(data as Organization);
    setMessage(asset === "logo" ? "Organisation logo updated." : "Cover image updated.");
    setMessageTone("success"); setUploading(null);
  }

  async function handleJoin() {
    if (!organization) return;
    if (!userId) { router.push(`/sign-in?next=${encodeURIComponent(`/organizations/${slug}`)}`); return; }
    setMembershipBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("request_organization_membership", { p_organization_id: organization.id });
    if (error) { setMessage(error.message); setMessageTone("error"); }
    else {
      await refreshMembers(organization.id);
      setMessage(data === "ACTIVE" ? "You are already a member of this organisation." : "Your membership request has been sent to the organisation administrators.");
      setMessageTone("success");
    }
    setMembershipBusy(false);
  }

  async function handleLeave() {
    if (!organization) return;
    setMembershipBusy(true); setMessage("");
    const { error } = await supabase.rpc("leave_organization", { p_organization_id: organization.id });
    if (error) { setMessage(error.message); setMessageTone("error"); }
    else {
      await refreshMembers(organization.id);
      setMessage("Your membership request or membership has been removed."); setMessageTone("success");
    }
    setMembershipBusy(false);
  }

  async function handleMemberAction(targetUserId: string, action: "approve" | "reject" | "remove" | "promote_admin" | "demote_admin") {
    if (!organization) return;
    setMemberAction(`${targetUserId}:${action}`); setMessage("");
    const { error } = await supabase.rpc("manage_organization_member", { p_organization_id: organization.id, p_user_id: targetUserId, p_action: action });
    if (error) { setMessage(error.message); setMessageTone("error"); }
    else {
      await refreshMembers(organization.id);
      const labels: Record<typeof action, string> = {
        approve: "Membership request approved.", reject: "Membership request declined.", remove: "Member removed.",
        promote_admin: "Administrator role granted.", demote_admin: "Administrator role removed.",
      };
      setMessage(labels[action]); setMessageTone("success");
    }
    setMemberAction(null);
  }

  if (loading) return <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]"><SiteHeader /><div className="mx-auto max-w-5xl px-5 py-12"><div className="h-7 w-48 animate-pulse rounded bg-white/10" /><div className="mt-6 h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" /></div></main>;

  if (!organization) return <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]"><SiteHeader /><div className="mx-auto max-w-3xl px-5 py-16 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Organisations</p><h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">This organisation isn’t available.</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/45">{pageError || "Check the page address, or return to the organisation directory."}</p><Link href="/organizations" className="mt-6 inline-flex rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Explore organisations ↗</Link></div></main>;

  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1160px] px-4 pb-16 pt-5 sm:px-7 sm:pt-8">
        <Link href="/organizations" className="inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition hover:text-emerald-100">← All organisations</Link>
        <section className="mt-4 overflow-hidden rounded-3xl border border-white/[0.1] bg-[#101815]">
          <div className="relative h-32 overflow-hidden bg-[radial-gradient(ellipse_at_18%_0%,rgba(164,237,193,0.23),transparent_57%),radial-gradient(ellipse_at_90%_65%,rgba(246,198,157,0.1),transparent_42%),linear-gradient(110deg,#192b20,#101815)] sm:h-48">
            {organization.cover_url && <img src={organization.cover_url} alt="" className="absolute inset-0 size-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#101815] via-[#101815]/15 to-transparent" />
            <p className="absolute left-5 top-5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 sm:left-8 sm:top-7">Converge / Organisation</p>
            {canManage && <label className="absolute right-4 top-4 cursor-pointer rounded-full border border-white/20 bg-black/30 px-3 py-2 text-[10px] font-semibold text-white backdrop-blur hover:bg-black/50">{uploading === "cover" ? "Uploading…" : "Change cover"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!!uploading} onChange={(event) => void handleAssetUpload(event, "cover")} className="sr-only" /></label>}
          </div>
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <div className="-mt-10 flex flex-col justify-between gap-5 sm:-mt-12 sm:flex-row sm:items-end">
              <div className="flex min-w-0 items-end gap-4">
                <div className="grid size-[84px] shrink-0 place-items-center overflow-hidden rounded-[24px] border-[5px] border-[#101815] bg-emerald-200/[0.11] text-xl font-bold text-emerald-100 sm:size-[100px]">{organization.logo_url ? <img src={organization.logo_url} alt={organization.name} className="size-full object-cover" /> : initials(organization.name)}</div>
                <div className="min-w-0 pb-1"><span className="inline-flex rounded-full border border-emerald-200/15 bg-emerald-200/[0.05] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-100/80">{typeLabel(organization.organization_type)}</span><h1 className="mt-2 break-words text-2xl font-semibold tracking-[-0.055em] sm:text-4xl">{organization.name}</h1>{organization.location && <p className="mt-1.5 text-xs text-white/40">{organization.location}</p>}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {canManage && <><label className="cursor-pointer rounded-full border border-white/15 px-3.5 py-2.5 text-xs font-semibold text-white/70 transition hover:border-emerald-200/30 hover:text-white">{uploading === "logo" ? "Uploading logo…" : "Change logo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!!uploading} onChange={(event) => void handleAssetUpload(event, "logo")} className="sr-only" /></label><button type="button" onClick={() => { setEditing((value) => !value); setMessage(""); }} className="rounded-full border border-white/15 px-3.5 py-2.5 text-xs font-semibold text-white/70 transition hover:border-emerald-200/30 hover:text-white">{editing ? "Close editor" : "Edit page"}</button></>}
                {!canManage && myMembership?.status === "ACTIVE" && <><span className="rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-3.5 py-2.5 text-xs font-semibold text-emerald-100">Member</span><button type="button" disabled={membershipBusy} onClick={() => void handleLeave()} className="rounded-full border border-white/15 px-3.5 py-2.5 text-xs font-semibold text-white/55 hover:text-red-100 disabled:opacity-50">Leave organisation</button></>}
                {!canManage && myMembership?.status === "REQUESTED" && <><span className="rounded-full border border-amber-200/20 bg-amber-200/[0.05] px-3.5 py-2.5 text-xs font-semibold text-amber-100">Request pending</span><button type="button" disabled={membershipBusy} onClick={() => void handleLeave()} className="rounded-full border border-white/15 px-3.5 py-2.5 text-xs font-semibold text-white/55 hover:text-white disabled:opacity-50">Cancel request</button></>}
                {!canManage && !myMembership && <button type="button" disabled={membershipBusy} onClick={() => void handleJoin()} className="rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-50">{membershipBusy ? "Please wait…" : userId ? "Request to join" : "Sign in to join"} ↗</button>}
              </div>
            </div>
            {organization.tagline && <p className="mt-5 max-w-3xl text-base leading-7 text-white/75">{organization.tagline}</p>}
            <div className="mt-6 flex flex-wrap gap-5 border-t border-white/[0.08] pt-5 text-xs text-white/45"><span><strong className="mr-1.5 text-white">{activeMembers.length}</strong>{activeMembers.length === 1 ? "member" : "members"}</span><span>Since {new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(organization.created_at))}</span>{organization.website_url && <a href={organization.website_url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1.5 break-all font-semibold text-emerald-200 hover:text-emerald-100">{organization.website_url.replace(/^https?:\/\//i, "").replace(/\/$/, "")} ↗</a>}</div>
          </div>
        </section>

        {message && <p role={messageTone === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100"}`}>{message}</p>}

        {editing && canManage && form && <section className="mt-5 rounded-2xl border border-emerald-200/20 bg-[#101815] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Organisation details</h2><p className="mt-1 text-xs leading-5 text-white/45">Keep the page accurate so members and collaborators understand your focus.</p>
          <form onSubmit={handleSave} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Organisation name<input className={inputClass} value={form.name} onChange={(event) => update("name", event.target.value)} required maxLength={120} /></label>
            <label className={labelClass}>Type<select className={inputClass} value={form.organization_type} onChange={(event) => update("organization_type", event.target.value as OrganizationType)}>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label className={labelClass}>Location<input className={inputClass} value={form.location ?? ""} onChange={(event) => update("location", event.target.value)} maxLength={120} placeholder="City, country or remote" /></label>
            <label className={labelClass}>Website<input className={inputClass} value={form.website_url ?? ""} onChange={(event) => update("website_url", event.target.value)} maxLength={240} placeholder="organisation.org" /></label>
            <label className={[labelClass, "sm:col-span-2"].join(" ")}>Tagline<input className={inputClass} value={form.tagline ?? ""} onChange={(event) => update("tagline", event.target.value)} maxLength={180} placeholder="Your organisation’s mission or focus" /></label>
            <label className={[labelClass, "sm:col-span-2"].join(" ")}>About<textarea className={[inputClass, "min-h-[130px] resize-y leading-6"].join(" ")} value={form.description ?? ""} onChange={(event) => update("description", event.target.value)} maxLength={2000} placeholder="Describe your work, research, and community." /></label>
            <div className="flex gap-3 sm:col-span-2"><button disabled={saving} className="rounded-full bg-emerald-200 px-5 py-3 text-sm font-bold text-[#0b1710] disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button><button type="button" onClick={() => { setForm({ name: organization.name, organization_type: organization.organization_type, tagline: organization.tagline ?? "", description: organization.description ?? "", website_url: organization.website_url ?? "", location: organization.location ?? "" }); setEditing(false); }} className="rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-white/55">Cancel</button></div>
          </form>
        </section>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/80 p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-200/70">The organisation</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">About this space</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-white/65">{organization.description || "This organisation hasn’t added a description yet."}</p>{!organization.description && canManage && <button type="button" onClick={() => setEditing(true)} className="mt-4 text-xs font-semibold text-emerald-200 hover:text-emerald-100">Add an organisation description ↗</button>}{organization.website_url && <a href={organization.website_url} target="_blank" rel="noreferrer noopener" className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2.5 text-xs font-semibold text-white/70 hover:border-emerald-200/30 hover:text-emerald-100">Official website ↗</a>}</section>
          <aside className="space-y-5">
            <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/80 p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">People</h2><p className="mt-1 text-[10px] text-white/35">{activeMembers.length} active {activeMembers.length === 1 ? "member" : "members"}</p></div><span className="grid size-9 place-items-center rounded-xl bg-emerald-200/[0.08] text-emerald-100">◎</span></div>
              {activeMembers.length ? <div className="mt-4 space-y-3">{activeMembers.map((member) => <div key={member.user_id} className="flex items-center gap-3">
                {member.profile?.username ? <Link href={`/u/${member.profile.username}`} aria-label={`View ${memberName(member)} profile`} className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-emerald-200/[0.08] text-xs font-bold text-emerald-100">{member.profile.avatar_url ? <img src={member.profile.avatar_url} alt="" className="size-full object-cover" /> : initials(memberName(member))}</Link> : <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-emerald-200/[0.08] text-xs font-bold text-emerald-100">{member.profile?.avatar_url ? <img src={member.profile.avatar_url} alt="" className="size-full object-cover" /> : initials(memberName(member))}</div>}
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white/85">{memberName(member)}</p>{member.profile?.headline && <p className="mt-0.5 truncate text-[10px] text-white/35">{member.profile.headline}</p>}<p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-white/35">{member.role.toLowerCase()}</p></div>
                {canManage && member.role !== "OWNER" && member.user_id !== userId && <div className="flex flex-wrap justify-end gap-1.5">{isOwner && member.role === "MEMBER" && <button type="button" disabled={!!memberAction} onClick={() => void handleMemberAction(member.user_id, "promote_admin")} className="rounded-lg border border-white/10 px-2 py-1.5 text-[9px] font-semibold text-white/55 hover:text-emerald-100 disabled:opacity-40">{memberAction === `${member.user_id}:promote_admin` ? "…" : "Make admin"}</button>}{isOwner && member.role === "ADMIN" && <button type="button" disabled={!!memberAction} onClick={() => void handleMemberAction(member.user_id, "demote_admin")} className="rounded-lg border border-white/10 px-2 py-1.5 text-[9px] font-semibold text-white/55 hover:text-white disabled:opacity-40">Remove admin</button>}{(isOwner || member.role === "MEMBER") && <button type="button" disabled={!!memberAction} onClick={() => void handleMemberAction(member.user_id, "remove")} className="rounded-lg border border-red-200/10 px-2 py-1.5 text-[9px] font-semibold text-red-200/70 hover:border-red-200/25 hover:text-red-100 disabled:opacity-40">Remove</button>}</div>}
              </div>)}</div> : <p className="mt-4 text-xs leading-5 text-white/40">The organisation’s members will appear here.</p>}
              {myMembership?.status === "ACTIVE" && <p className="mt-4 border-t border-white/[0.07] pt-3 text-[10px] text-white/35">You are a member of this organisation.</p>}
            </section>
            {canManage && <section className="rounded-2xl border border-amber-200/15 bg-amber-100/[0.025] p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Membership requests</h2><p className="mt-1 text-[10px] text-white/35">Review people who want to join.</p></div><span className="grid size-8 place-items-center rounded-lg border border-amber-200/15 text-xs font-bold text-amber-100">{requests.length}</span></div>
              {requests.length ? <div className="mt-4 space-y-4">{requests.map((member) => <div key={member.user_id} className="border-t border-white/[0.07] pt-3 first:border-0 first:pt-0"><p className="text-xs font-semibold text-white/80">{memberName(member)}</p>{member.profile?.headline && <p className="mt-1 text-[10px] text-white/35">{member.profile.headline}</p>}<div className="mt-3 flex gap-2"><button type="button" disabled={!!memberAction} onClick={() => void handleMemberAction(member.user_id, "approve")} className="rounded-full bg-emerald-200 px-3 py-2 text-[10px] font-bold text-[#0b1710] disabled:opacity-40">{memberAction === `${member.user_id}:approve` ? "…" : "Approve"}</button><button type="button" disabled={!!memberAction} onClick={() => void handleMemberAction(member.user_id, "reject")} className="rounded-full border border-white/15 px-3 py-2 text-[10px] font-semibold text-white/55 disabled:opacity-40">Decline</button></div></div>)}</div> : <p className="mt-4 text-xs text-white/40">No pending requests right now.</p>}
              {isOwner && <p className="mt-4 border-t border-white/[0.07] pt-3 text-[10px] leading-5 text-white/35">You’re the organisation owner. Grant administrator access only to people responsible for managing this page.</p>}
            </section>}
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"><p className="text-xs font-semibold text-white/75">Built for collaboration</p><p className="mt-2 text-[11px] leading-5 text-white/40">Organisation spaces are designed to connect expertise, projects, and research conversations across Converge.</p></section>
          </aside>
        </div>
      </div>
    </main>
  );
}
