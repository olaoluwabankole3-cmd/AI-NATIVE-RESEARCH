"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export default function CommunitiesPage() {
  const supabase = createClient();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  async function loadCommunities() {
    setLoading(true);
    const { data, error } = await supabase
      .from("communities")
      .select("id, name, slug, description")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setMessageTone("error");
    } else {
      setCommunities(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadCommunities();
  }, []);

  const filteredCommunities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return communities;
    return communities.filter((community) =>
      [community.name, community.description ?? ""].some((value) => value.toLowerCase().includes(query)),
    );
  }, [communities, search]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setMessage("Community name is required.");
      setMessageTone("error");
      setCreating(false);
      return;
    }

    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug) {
      setMessage("Choose a community name containing letters or numbers.");
      setMessageTone("error");
      setCreating(false);
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage("Your session has expired. Please sign in again.");
      setMessageTone("error");
      setCreating(false);
      return;
    }

    const { data: community, error: communityError } = await supabase
      .from("communities")
      .insert({ name: trimmedName, slug, description: trimmedDescription || null, created_by: user.id })
      .select("id, name, slug, description")
      .single();

    if (communityError) {
      setMessage(communityError.message);
      setMessageTone("error");
      setCreating(false);
      return;
    }

    const { error: membershipError } = await supabase.from("community_members").insert({
      community_id: community.id,
      user_id: user.id,
      role: "OWNER",
    });

    if (membershipError) {
      setMessage(membershipError.message);
      setMessageTone("error");
      setCreating(false);
      return;
    }

    setCommunities((current) => [community, ...current]);
    setName("");
    setDescription("");
    setShowForm(false);
    setMessage("Your community is ready. Start a topic to get the conversation moving.");
    setMessageTone("success");
    setCreating(false);
  }

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-[1480px] px-5 pb-16 sm:px-8 lg:px-14">
        <section className="relative overflow-hidden border-b border-white/10 py-10 sm:py-14 lg:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-emerald-300/[0.07] blur-3xl" />
          <div className="relative grid gap-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-200/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-300" />
                Your research commons
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.065em] sm:text-5xl lg:text-6xl">
                Better questions.<br /><span className="text-emerald-200">Stronger together.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
                Explore ideas with people who care about the question. Bring in specialist AI perspectives when they can help move the work forward.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Community spaces</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{loading ? "—" : communities.length}</p>
                <p className="mt-1 text-xs text-white/40">Shared places to explore ideas</p>
              </div>
              <button type="button" onClick={() => { setShowForm((value) => !value); setMessage(""); }} className="group flex min-h-[124px] flex-col items-start justify-between rounded-2xl border border-emerald-200/25 bg-emerald-200/[0.07] p-4 text-left transition hover:border-emerald-200/50 hover:bg-emerald-200/[0.11] sm:p-5">
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-200 text-xl font-medium text-[#0b1710]">{showForm ? "×" : "+"}</span>
                <span className="mt-4 text-sm font-semibold text-emerald-100">{showForm ? "Close form" : "Create a community"} <span className="ml-1 transition group-hover:translate-x-1">↗</span></span>
              </button>
            </div>
          </div>
        </section>

        {showForm && (
          <form onSubmit={handleCreate} className="mt-8 rounded-3xl border border-emerald-200/15 bg-[#101917] p-5 sm:p-8">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">New space</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Create a community</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">Set the focus. The best communities make it clear what people can learn, investigate, or solve together.</p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/70">Community name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} className="w-full rounded-xl border border-white/10 bg-[#0b1110] px-4 py-3 text-sm outline-none transition placeholder:text-white/25 focus:border-emerald-200/60" placeholder="e.g. AI Safety Research" />
              </label>
              <label className="block sm:row-span-2">
                <span className="mb-2 block text-sm font-medium text-white/70">What is this space for?</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={500} className="w-full resize-none rounded-xl border border-white/10 bg-[#0b1110] px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-white/25 focus:border-emerald-200/60" placeholder="Describe the questions, interests, or research this community brings together." />
                <span className="mt-1 block text-right text-[11px] text-white/25">{description.length}/500</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button disabled={creating} className="rounded-full bg-emerald-200 px-5 py-3 text-sm font-semibold text-[#0b1710] transition hover:bg-emerald-100 disabled:opacity-50">{creating ? "Creating…" : "Create community ↗"}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-3 text-sm text-white/50 transition hover:text-white">Cancel</button>
              </div>
            </div>
          </form>
        )}

        {message && (
          <p role="status" className={["mt-5 rounded-xl border px-4 py-3 text-sm", messageTone === "error" ? "border-red-300/20 bg-red-300/[0.05] text-red-200" : "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100"].join(" ")}>
            {message}
          </p>
        )}

        <section className="pt-9 sm:pt-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">Find your people</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Explore communities</h2>
              <p className="mt-2 text-sm text-white/40">A good question gets better when more perspectives meet.</p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Search communities</span>
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35">⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-full border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-white/30 focus:border-emerald-200/40" placeholder="Search by name or topic…" />
            </label>
          </div>

          {loading ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.025]" />)}
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div className="mt-7 rounded-3xl border border-dashed border-white/15 px-6 py-14 text-center sm:py-20">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-200/[0.06] text-2xl text-emerald-200">{search ? "⌕" : "+"}</span>
              <h3 className="mt-5 text-xl font-semibold">{search ? "No matching communities" : "The first conversation starts here"}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">{search ? "Try another search, or clear the field to see every community." : "Create a space around a question worth exploring, then invite others to help shape the conversation."}</p>
              {search ? (
                <button type="button" onClick={() => setSearch("")} className="mt-5 text-sm font-semibold text-emerald-200 hover:text-white">Clear search</button>
              ) : (
                <button type="button" onClick={() => setShowForm(true)} className="mt-5 rounded-full bg-emerald-200 px-5 py-3 text-sm font-semibold text-[#0b1710] hover:bg-emerald-100">Create the first community ↗</button>
              )}
            </div>
          ) : (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCommunities.map((community, index) => (
                <Link key={community.id} href={`/communities/${community.slug}`} className="group relative flex min-h-[230px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-5 transition duration-200 hover:-translate-y-1 hover:border-emerald-200/30 hover:bg-white/[0.045] sm:p-6">
                  <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-emerald-200/[0.04] blur-2xl transition group-hover:bg-emerald-200/[0.09]" />
                  <div className="relative flex items-start justify-between gap-4">
                    <span className="grid size-12 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-200/[0.07] text-lg font-semibold text-emerald-200">{community.name.charAt(0).toUpperCase()}</span>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">Community</span>
                  </div>
                  <div className="relative mt-5">
                    <h3 className="text-lg font-semibold tracking-[-0.025em] text-white transition group-hover:text-emerald-100">{community.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/45">{community.description || "A shared space for thoughtful discussion, collaborative research, and new perspectives."}</p>
                  </div>
                  <div className="relative mt-auto flex items-center justify-between border-t border-white/[0.08] pt-4 mt-5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Explore space</span>
                    <span aria-hidden="true" className="grid size-8 place-items-center rounded-full border border-white/10 text-white/50 transition group-hover:border-emerald-200/30 group-hover:bg-emerald-200 group-hover:text-[#0b1710]">↗</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
