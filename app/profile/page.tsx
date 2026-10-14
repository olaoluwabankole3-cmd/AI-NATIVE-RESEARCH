"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Visibility = "public" | "members" | "private";
type ProfileForm = {
  username: string;
  display_name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  location: string;
  organization: string;
  website_url: string;
  interests: string;
  profile_visibility: Visibility;
};

const emptyProfile: ProfileForm = {
  username: "",
  display_name: "",
  headline: "",
  bio: "",
  avatar_url: "",
  location: "",
  organization: "",
  website_url: "",
  interests: "",
  profile_visibility: "public",
};

const fieldClass = "mt-2 w-full rounded-xl border border-white/[0.11] bg-[#0a100d] px-3.5 py-3 text-sm text-[#edf5ee] outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-emerald-200/55 focus:ring-4 focus:ring-emerald-200/[0.05]";
const labelClass = "block text-[12px] font-semibold text-white/75";

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !user) {
        router.replace("/sign-in?next=/profile");
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? "");
      const metadataName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
      const { data, error } = await supabase.from("profiles")
        .select("username, display_name, headline, bio, avatar_url, location, organization, website_url, interests, profile_visibility")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setMessage("The profile database setup is not complete yet. Apply the Converge profile migration in Supabase, then reload this page.");
        setMessageTone("error");
      } else if (data) {
        setForm({
          username: data.username ?? "",
          display_name: data.display_name ?? metadataName,
          headline: data.headline ?? "",
          bio: data.bio ?? "",
          avatar_url: data.avatar_url ?? "",
          location: data.location ?? "",
          organization: data.organization ?? "",
          website_url: data.website_url ?? "",
          interests: Array.isArray(data.interests) ? data.interests.join(", ") : "",
          profile_visibility: (data.profile_visibility ?? "public") as Visibility,
        });
      } else {
        setForm({ ...emptyProfile, display_name: metadataName });
      }
      setLoading(false);
    }
    void loadProfile();
    return () => { active = false; };
  }, [router, supabase]);

  const profileUrl = form.username.trim() ? `/u/${form.username.trim().toLowerCase()}` : "";
  const nameInitials = initials(form.display_name || email.split("@")[0] || "Converge");

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!userId) {
      setMessage("Your session is still loading. Please try again.");
      setMessageTone("error");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Choose a JPG, PNG, WebP, or GIF image.");
      setMessageTone("error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Your profile picture must be 5 MB or smaller.");
      setMessageTone("error");
      return;
    }

    setUploading(true);
    setMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      setMessage(uploadError.message.includes("Bucket not found")
        ? "Avatar storage is not set up yet. Apply the profile migration in Supabase and try again."
        : uploadError.message);
      setMessageTone("error");
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(objectPath);
    const { error: profileError } = await supabase.from("profiles")
      .update({ avatar_url: publicData.publicUrl })
      .eq("id", userId)
      .select("id")
      .single();
    if (profileError) {
      await supabase.storage.from("avatars").remove([objectPath]);
      setMessage(profileError.message);
      setMessageTone("error");
      setUploading(false);
      return;
    }
    setForm((current) => ({ ...current, avatar_url: publicData.publicUrl }));
    setMessage("Profile picture updated.");
    setMessageTone("success");
    setUploading(false);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const displayName = form.display_name.trim();
    const username = form.username.trim().toLowerCase().replace(/^@/, "");
    if (displayName.length < 2) {
      setMessage("Please enter a display name with at least two characters.");
      setMessageTone("error");
      return;
    }
    if (username && !/^[a-z0-9_]{3,24}$/.test(username)) {
      setMessage("Usernames must be 3–24 characters and use only lowercase letters, numbers, or underscores.");
      setMessageTone("error");
      return;
    }

    let websiteUrl: string | null = null;
    if (form.website_url.trim()) {
      const candidate = /^https?:\/\//i.test(form.website_url.trim()) ? form.website_url.trim() : `https://${form.website_url.trim()}`;
      try {
        const parsed = new URL(candidate);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
        websiteUrl = parsed.toString();
      } catch {
        setMessage("Enter a valid website address, such as example.com.");
        setMessageTone("error");
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      username: username || null,
      display_name: displayName,
      headline: form.headline.trim() || null,
      bio: form.bio.trim() || null,
      avatar_url: form.avatar_url || null,
      location: form.location.trim() || null,
      organization: form.organization.trim() || null,
      website_url: websiteUrl,
      interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 15),
      profile_visibility: form.profile_visibility,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (error) {
      setMessage(error.code === "23505"
        ? "That username is already taken. Try another one."
        : error.message);
      setMessageTone("error");
      setSaving(false);
      return;
    }

    setForm((current) => ({ ...current, username, website_url: websiteUrl ?? "" }));
    setMessage("Your profile has been saved.");
    setMessageTone("success");
    setSaving(false);
    router.refresh();
  }

  if (loading) {
    return <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]"><SiteHeader /><div className="mx-auto max-w-5xl px-5 py-20"><div className="h-6 w-44 animate-pulse rounded bg-white/10" /><div className="mt-5 h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" /></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="border-b border-white/[0.09] py-8 sm:py-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Your identity / Profile</p>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Make your perspective known.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">Give people context about who you are, what you work on, and the questions you care about.</p>
            </div>
            {profileUrl && <Link href={profileUrl} target="_blank" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-emerald-200/35 hover:text-emerald-100">View public profile <span aria-hidden="true">↗</span></Link>}
          </div>
        </section>

        {message && <div role={messageTone === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : messageTone === "success" ? "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-100" : "border-white/10 bg-white/[0.03] text-white/70"}`}>{message}</div>}

        <div className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <form onSubmit={handleSave} className="space-y-5">
            <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/85 p-5 sm:p-7">
              <div className="flex items-start gap-4 border-b border-white/[0.08] pb-5 sm:gap-5">
                <div className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-[23px] border border-emerald-200/20 bg-emerald-200/[0.09] text-xl font-bold text-emerald-100 sm:size-[88px]">
                  {form.avatar_url ? <img src={form.avatar_url} alt="Profile picture preview" className="size-full object-cover" /> : nameInitials}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="text-base font-semibold">Profile picture</h2>
                  <p className="mt-1.5 text-xs leading-5 text-white/45">A clear image helps people recognise you in discussions and research.</p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3.5 py-2 text-xs font-semibold text-white/75 transition hover:border-emerald-200/35 hover:text-white">
                    {uploading ? "Uploading picture…" : form.avatar_url ? "Change picture" : "Upload picture"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={handleAvatarChange} className="sr-only" />
                  </label>
                  <p className="mt-2 text-[10px] text-white/30">JPG, PNG, WebP or GIF · Maximum 5 MB</p>
                </div>
              </div>

              <div className="grid gap-5 pt-5 sm:grid-cols-2">
                <label className={labelClass}>Display name <span className="text-emerald-200">*</span><input className={fieldClass} value={form.display_name} onChange={(event) => update("display_name", event.target.value)} maxLength={80} required placeholder="How people should address you" /></label>
                <label className={labelClass}>Username <span className="text-white/35 font-normal">(optional)</span><div className="mt-2 flex items-center rounded-xl border border-white/[0.11] bg-[#0a100d] focus-within:border-emerald-200/55"><span className="pl-3.5 text-sm text-white/35">@</span><input className="w-full bg-transparent px-2.5 py-3 text-sm outline-none placeholder:text-white/25" value={form.username} onChange={(event) => update("username", event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={24} autoCapitalize="none" placeholder="yourhandle" /></div><span className="mt-1.5 block text-[10px] font-normal text-white/35">3–24 letters, numbers or underscores.</span></label>
                <label className={labelClass}>Headline<input className={fieldClass} value={form.headline} onChange={(event) => update("headline", event.target.value)} maxLength={120} placeholder="e.g. Researcher exploring genomic AI" /></label>
                <label className={labelClass}>Organisation or affiliation<input className={fieldClass} value={form.organization} onChange={(event) => update("organization", event.target.value)} maxLength={120} placeholder="University, company, lab, or independent" /></label>
                <label className={labelClass}>Location<input className={fieldClass} value={form.location} onChange={(event) => update("location", event.target.value)} maxLength={100} placeholder="City or region (optional)" /></label>
                <label className={labelClass}>Website or portfolio<input className={fieldClass} value={form.website_url} onChange={(event) => update("website_url", event.target.value)} maxLength={240} inputMode="url" placeholder="example.com" /></label>
                <label className={[labelClass, "sm:col-span-2"].join(" ")}>About you<textarea className={[fieldClass, "min-h-[126px] resize-y leading-6"].join(" ")} value={form.bio} onChange={(event) => update("bio", event.target.value)} maxLength={1000} placeholder="What do you work on? What perspectives or experience do you bring to the conversation?" /><span className="mt-1.5 block text-right text-[10px] font-normal text-white/30">{form.bio.length}/1000</span></label>
                <label className={[labelClass, "sm:col-span-2"].join(" ")}>Interests and research areas<textarea className={[fieldClass, "min-h-[82px] resize-y leading-6"].join(" ")} value={form.interests} onChange={(event) => update("interests", event.target.value)} maxLength={500} placeholder="Genomic AI, public health, economics, open research" /><span className="mt-1.5 block text-[10px] font-normal text-white/35">Separate each interest with a comma. Up to 15 will be shown.</span></label>
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.09] bg-[#101815]/85 p-5 sm:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/80">Visibility</p>
              <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">Choose who can see your profile.</h2>
              <p className="mt-1.5 text-xs leading-5 text-white/45">Your email address is never displayed on your public profile.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {([
                  { value: "public", title: "Public", detail: "Anyone can view your profile." },
                  { value: "members", title: "Members", detail: "Signed-in Converge members." },
                  { value: "private", title: "Private", detail: "Only you can view your profile." },
                ] as const).map((option) => (
                  <label key={option.value} className={["cursor-pointer rounded-xl border p-3.5 transition", form.profile_visibility === option.value ? "border-emerald-200/40 bg-emerald-200/[0.07]" : "border-white/[0.09] bg-black/10 hover:border-white/20"].join(" ")}>
                    <span className="flex items-center gap-2"><input type="radio" name="profile_visibility" value={option.value} checked={form.profile_visibility === option.value} onChange={() => update("profile_visibility", option.value)} className="accent-emerald-200" /><span className="text-sm font-semibold">{option.title}</span></span>
                    <span className="mt-2 block text-[11px] leading-5 text-white/45">{option.detail}</span>
                  </label>
                ))}
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-5 text-white/35">Your profile helps people discover shared interests and expertise.</p>
              <button type="submit" disabled={saving || uploading || !userId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-200 px-5 py-3 text-sm font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving profile…" : "Save profile"} <span aria-hidden="true">↗</span></button>
            </div>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-[92px]">
            <section className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101815]">
              <div className="h-20 bg-[radial-gradient(ellipse_at_25%_0%,rgba(164,237,193,0.22),transparent_60%),linear-gradient(115deg,#182a20,#101815)]" />
              <div className="px-5 pb-5">
                <div className="-mt-9 grid size-[72px] place-items-center overflow-hidden rounded-[22px] border-4 border-[#101815] bg-emerald-200/[0.12] text-lg font-bold text-emerald-100">
                  {form.avatar_url ? <img src={form.avatar_url} alt="" className="size-full object-cover" /> : nameInitials}
                </div>
                <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200/70">Profile preview</p>
                <h2 className="mt-2 break-words text-xl font-semibold tracking-[-0.04em]">{form.display_name.trim() || "Your name"}</h2>
                {form.username.trim() && <p className="mt-1 text-xs text-white/40">@{form.username.trim().replace(/^@/, "").toLowerCase()}</p>}
                {form.headline.trim() && <p className="mt-3 text-sm leading-6 text-white/70">{form.headline}</p>}
                {(form.organization.trim() || form.location.trim()) && <p className="mt-3 text-xs leading-5 text-white/45">{[form.organization.trim(), form.location.trim()].filter(Boolean).join(" · ")}</p>}
                <div className="my-5 h-px bg-white/[0.08]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">About</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-white/65">{form.bio.trim() || "Your introduction will appear here once you add it."}</p>
                {form.interests.split(",").map((item) => item.trim()).filter(Boolean).length > 0 && <><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Interests</p><div className="mt-2 flex flex-wrap gap-2">{form.interests.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 15).map((interest, index) => <span key={`${interest}-${index}`} className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.05] px-2.5 py-1.5 text-[10px] text-emerald-100/80">{interest}</span>)}</div></>}
                {form.website_url.trim() && <p className="mt-5 truncate text-xs font-semibold text-emerald-200">{form.website_url.replace(/^https?:\/\//i, "")}</p>}
                <p className="mt-5 flex items-center gap-2 text-[10px] text-white/35"><span className="size-1.5 rounded-full bg-emerald-200/80" /> {form.profile_visibility === "public" ? "Visible to everyone" : form.profile_visibility === "members" ? "Visible to signed-in members" : "Private profile"}</p>
              </div>
            </section>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs font-semibold text-white/75">Building your presence on Converge</p>
              <p className="mt-2 text-[11px] leading-5 text-white/40">Your profile will become the foundation for following researchers, connecting with people, and participating in organisation spaces.</p>
              <Link href="/communities" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200 hover:text-emerald-100">Return to communities <span>↗</span></Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
