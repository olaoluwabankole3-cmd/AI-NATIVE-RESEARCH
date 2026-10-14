"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type OrganizationType = "company" | "university" | "research_lab" | "research_group" | "nonprofit" | "other";
type Organization = {
  id: string; name: string; slug: string; organization_type: OrganizationType;
  tagline: string | null; description: string | null; logo_url: string | null;
  location: string | null; created_at: string;
};
type Membership = { organization_id: string; user_id: string; status: "ACTIVE" | "REQUESTED"; role: "OWNER" | "ADMIN" | "MEMBER" };
type OrganizationForm = {
  name: string; slug: string; organization_type: OrganizationType;
  tagline: string; description: string; website_url: string; location: string;
};

const initialForm: OrganizationForm = {
  name: "", slug: "", organization_type: "research_group", tagline: "",
  description: "", website_url: "", location: "",
};
const types: { value: OrganizationType; label: string }[] = [
  { value: "company", label: "Company" },
  { value: "university", label: "University" },
  { value: "research_lab", label: "Research lab" },
  { value: "research_group", label: "Research group" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
];
const inputClass = "mt-2 w-full rounded-xl border border-white/[0.11] bg-[#0a100d] px-3.5 py-3 text-sm text-[#edf5ee] outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-emerald-200/55";
const labelClass = "block text-[12px] font-semibold text-white/75";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
}
function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "O";
}
function typeLabel(value: OrganizationType) {
  return types.find((item) => item.value === value)?.label ?? "Organisation";
}
function normaliseWebsite(value: string) {
  if (!value.trim()) return null;
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Enter a valid website address.");
  return parsed.toString();
}

export default function OrganizationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<OrganizationForm>(initialForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | OrganizationType>("all");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: authData }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("organizations").select("id, name, slug, organization_type, tagline, description, logo_url, location, created_at").order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      const viewerId = authData.user?.id ?? null;
      setUserId(viewerId);
      if (error) {
        setMessage("The organisation database setup is not complete yet. Apply the Converge organisation migration in Supabase, then reload this page.");
        setMessageTone("error");
        setOrganizations([]);
      } else {
        setOrganizations((data ?? []) as Organization[]);
        const { data: membershipData } = await supabase.from("organization_members")
          .select("organization_id, user_id, status, role");
        if (active) setMemberships((membershipData ?? []) as Membership[]);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return organizations.filter((org) => {
      const matchesType = filterType === "all" || org.organization_type === filterType;
      const matchesQuery = !query || [org.name, org.tagline ?? "", org.description ?? "", org.location ?? ""].some((value) => value.toLowerCase().includes(query));
      return matchesType && matchesQuery;
    });
  }, [organizations, search, filterType]);

  const memberCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const membership of memberships) {
      if (membership.status === "ACTIVE") counts.set(membership.organization_id, (counts.get(membership.organization_id) ?? 0) + 1);
    }
    return counts;
  }, [memberships]);

  function update<K extends keyof OrganizationForm>(key: K, value: OrganizationForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" && !slugEdited ? { slug: slugify(value as string) } : {}),
    }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!userId) {
      router.push("/sign-in?next=/organizations");
      return;
    }
    const name = form.name.trim();
    const slug = slugify(form.slug);
    if (name.length < 2) {
      setMessage("Enter an organisation name with at least two characters.");
      setMessageTone("error");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) {
      setMessage("Use a URL slug with at least three letters or numbers, separated by hyphens.");
      setMessageTone("error");
      return;
    }
    let websiteUrl: string | null;
    try { websiteUrl = normaliseWebsite(form.website_url); }
    catch { setMessage("Enter a valid website address, such as example.org."); setMessageTone("error"); return; }

    setCreating(true);
    const { data: organizationId, error } = await supabase.rpc("create_organization", {
      p_name: name,
      p_slug: slug,
      p_organization_type: form.organization_type,
      p_tagline: form.tagline.trim() || null,
      p_description: form.description.trim() || null,
      p_website_url: websiteUrl,
      p_location: form.location.trim() || null,
    });
    if (error || !organizationId) {
      setMessage(error?.code === "23505" ? "That organisation URL is already in use. Choose a different one." : error?.message ?? "The organisation could not be created. Please try again.");
      setMessageTone("error");
      setCreating(false);
      return;
    }
    setCreating(false);
    router.push(`/organizations/${slug}`);
    router.refresh();
  }

  return (
    <main className="converge-app-page min-h-screen bg-[#0b1110] text-[#edf5ee]">
      <SiteHeader />
      <div className="mx-auto max-w-[1380px] px-4 pb-16 sm:px-7 lg:px-10">
        <section className="converge-page-intro border-b border-white/[0.09] py-9 sm:py-12">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">Converge / Organisations</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.06em] sm:text-5xl">Where teams do their thinking.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">A home for universities, companies, labs, and research groups to share their work and bring people together around meaningful questions.</p>
            </div>
            <button type="button" onClick={() => { if (!userId) { router.push("/sign-in?next=/organizations"); return; } setShowForm((value) => !value); setMessage(""); }} className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-200 px-5 py-3 text-sm font-bold text-[#0b1710] transition hover:bg-emerald-100"><span className="text-lg leading-none">{showForm ? "×" : "+"}</span>{showForm ? "Close form" : "Create organisation"}</button>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { number: String(organizations.length).padStart(2, "0"), label: "Organisations on Converge", note: "Teams and institutions" },
              { number: String(organizations.filter((item) => ["research_lab", "research_group", "university"].includes(item.organization_type)).length).padStart(2, "0"), label: "Research-led spaces", note: "Places for discovery" },
              { number: String(memberships.filter((item) => item.user_id === userId && item.status === "ACTIVE").length).padStart(2, "0"), label: "Your memberships", note: "Teams you belong to" },
            ].map((stat) => <div key={stat.label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><p className="text-2xl font-semibold tracking-[-0.05em] text-emerald-100">{loading ? "—" : stat.number}</p><p className="mt-1 text-xs font-semibold text-white/75">{stat.label}</p><p className="mt-1 text-[10px] text-white/35">{stat.note}</p></div>)}
          </div>
        </section>

        {showForm && <section className="mt-6 rounded-2xl border border-emerald-200/20 bg-[#101815] p-5 sm:p-7">
          <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-200/10 text-lg text-emerald-200">✳</div><div><h2 className="text-lg font-semibold tracking-[-0.03em]">Create an organisation page</h2><p className="mt-1 text-xs leading-5 text-white/45">You’ll become its owner and can appoint other administrators after creating the page.</p></div></div>
          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Organisation name <span className="text-emerald-200">*</span><input className={inputClass} value={form.name} onChange={(event) => update("name", event.target.value)} minLength={2} maxLength={120} required placeholder="e.g. Afridata Research Lab" /></label>
              <label className={labelClass}>Type<select className={inputClass} value={form.organization_type} onChange={(event) => update("organization_type", event.target.value as OrganizationType)}>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
              <label className={labelClass}>Page URL <span className="text-emerald-200">*</span><div className="mt-2 flex items-center rounded-xl border border-white/[0.11] bg-[#0a100d] focus-within:border-emerald-200/55"><span className="pl-3 text-xs text-white/35">/organizations/</span><input className="w-full min-w-0 bg-transparent px-2 py-3 text-sm outline-none" value={form.slug} onChange={(event) => { setSlugEdited(true); update("slug", slugify(event.target.value)); }} maxLength={60} required placeholder="afridata-lab" /></div></label>
              <label className={labelClass}>Location<input className={inputClass} value={form.location} onChange={(event) => update("location", event.target.value)} maxLength={120} placeholder="City, country or remote" /></label>
              <label className={[labelClass, "sm:col-span-2"].join(" ")}>Short tagline<input className={inputClass} value={form.tagline} onChange={(event) => update("tagline", event.target.value)} maxLength={180} placeholder="The mission or focus of this organisation" /></label>
              <label className={[labelClass, "sm:col-span-2"].join(" ")}>About the organisation<textarea className={[inputClass, "min-h-[105px] resize-y leading-6"].join(" ")} value={form.description} onChange={(event) => update("description", event.target.value)} maxLength={2000} placeholder="What does your team do, research, or build?" /></label>
              <label className={[labelClass, "sm:col-span-2"].join(" ")}>Website<input className={inputClass} value={form.website_url} onChange={(event) => update("website_url", event.target.value)} maxLength={240} placeholder="organisation.org" /></label>
            </div>
            {message && <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[0.05] px-4 py-3 text-sm leading-6 text-red-200">{message}</p>}
            <div className="flex flex-wrap items-center gap-3"><button disabled={creating} className="rounded-full bg-emerald-200 px-5 py-3 text-sm font-bold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-50">{creating ? "Creating organisation…" : "Create organisation ↗"}</button><button type="button" onClick={() => { setShowForm(false); setForm(initialForm); setSlugEdited(false); setMessage(""); }} className="rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white/55 hover:text-white">Cancel</button></div>
          </form>
        </section>}

        {message && !showForm && <p role="alert" className={`mt-5 rounded-xl border px-4 py-3 text-sm leading-6 ${messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100"}`}>{message}</p>}

        <section className="pt-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Directory</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em]">Find your people</h2></div>
            <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-2xl">
              <label className="relative min-w-0 flex-1"><span className="sr-only">Search organisations</span><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35">⌕</span><input className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.025] pl-9 pr-3 text-sm outline-none placeholder:text-white/30 focus:border-emerald-200/45" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, focus, or location" /></label>
              <select aria-label="Filter organisation type" className="h-11 rounded-xl border border-white/10 bg-[#101815] px-3 text-xs text-white/70 outline-none focus:border-emerald-200/45" value={filterType} onChange={(event) => setFilterType(event.target.value as "all" | OrganizationType)}><option value="all">All types</option>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
            </div>
          </div>

          {loading ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0,1,2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />)}</div> :
            filtered.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((org) => {
                const membership = memberships.find((item) => item.organization_id === org.id && item.user_id === userId);
                return <Link key={org.id} href={`/organizations/${org.slug}`} className="group overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101815]/75 transition hover:-translate-y-0.5 hover:border-emerald-200/25 hover:bg-[#121d17]">
                  <div className="h-1 bg-gradient-to-r from-emerald-200/65 via-emerald-200/15 to-transparent" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-emerald-200/[0.08] text-sm font-bold text-emerald-100">{org.logo_url ? <img src={org.logo_url} alt="" className="size-full object-cover" /> : initials(org.name)}</div><span className="rounded-full border border-white/[0.09] px-2.5 py-1.5 text-[9px] font-semibold text-white/45">{typeLabel(org.organization_type)}</span></div>
                    <h3 className="mt-5 break-words text-lg font-semibold tracking-[-0.035em] text-white transition group-hover:text-emerald-100">{org.name}</h3>
                    {org.tagline && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-white/55">{org.tagline}</p>}
                    {org.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/40">{org.description}</p>}
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4"><span className="truncate text-[10px] text-white/35">{org.location || typeLabel(org.organization_type)}{(memberCounts.get(org.id) ?? 0) > 0 ? ` · ${memberCounts.get(org.id)} members` : ""}</span><span className="shrink-0 text-xs font-semibold text-emerald-200">View page ↗</span></div>
                    {membership?.status === "REQUESTED" && <p className="mt-3 text-[10px] font-semibold text-amber-200/80">Membership request pending</p>}
                  </div>
                </Link>;
              })}
            </div> : <div className="mt-6 rounded-2xl border border-dashed border-white/[0.12] px-6 py-14 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.05] text-xl text-emerald-100">⌂</div><h3 className="mt-4 text-lg font-semibold">{organizations.length ? "No organisations match that search." : "A place for your organisation to begin."}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">{organizations.length ? "Try a different name, location, or organisation type." : "Create a page for your research group, university, company, or lab and give your work a shared home."}</p>{!organizations.length && userId && <button onClick={() => setShowForm(true)} className="mt-5 rounded-full bg-emerald-200 px-4 py-2.5 text-xs font-bold text-[#0b1710]">Create the first page ↗</button>}</div>}
        </section>
      </div>
    </main>
  );
}
