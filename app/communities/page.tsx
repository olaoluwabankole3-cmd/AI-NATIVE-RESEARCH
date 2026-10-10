"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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
  const [message, setMessage] = useState("");

  async function loadCommunities() {
    setLoading(true);
    const { data, error } = await supabase
      .from("communities")
      .select("id, name, slug, description")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setCommunities(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadCommunities();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setMessage("Community name is required.");
      setCreating(false);
      return;
    }

    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!slug) {
      setMessage("Choose a community name containing letters or numbers.");
      setCreating(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Your session has expired. Please sign in again.");
      setCreating(false);
      return;
    }

    const { data: community, error: communityError } = await supabase
      .from("communities")
      .insert({
        name: trimmedName,
        slug,
        description: trimmedDescription || null,
        created_by: user.id,
      })
      .select("id, name, slug, description")
      .single();

    if (communityError) {
      setMessage(communityError.message);
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
      setCreating(false);
      return;
    }

    setCommunities((current) => [community, ...current]);
    setName("");
    setDescription("");
    setShowForm(false);
    setMessage("Community created.");
    setCreating(false);
  }

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12">

        <section className="border-b border-white/10 py-10 sm:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Discover</p>
          <div className="mt-4 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-medium tracking-[-0.055em] sm:text-5xl">Communities</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/55">
                Find a community, follow a question, and bring the right human or AI participant into the room.
              </p>
            </div>
            <button
              onClick={() => { setShowForm((value) => !value); setMessage(""); }}
              className="w-full border border-white/20 px-4 py-3 text-sm font-medium text-white/80 transition hover:border-emerald-300/50 hover:text-white sm:w-auto"
            >
              {showForm ? "Cancel" : "Create community"}
            </button>
          </div>
        </section>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-8 border border-white/10 bg-[#101917] p-6 sm:p-7">
            <h2 className="text-xl font-semibold">Create a community</h2>
            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required
                  className="w-full border border-white/15 bg-[#0b1110] px-4 py-3 outline-none transition focus:border-emerald-300/60" placeholder="e.g. AI Safety Research" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3}
                  className="w-full resize-none border border-white/15 bg-[#0b1110] px-4 py-3 outline-none transition focus:border-emerald-300/60" placeholder="What should people research or discuss here?" />
              </label>
              {message && <p className="text-sm text-red-200">{message}</p>}
              <button disabled={creating} className="w-fit bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#0b1110] transition hover:bg-emerald-200 disabled:opacity-50">
                {creating ? "Creating…" : "Create community"}
              </button>
            </div>
          </form>
        )}

        {message && !showForm && <p className="mb-6 text-sm text-emerald-200">{message}</p>}

        {loading ? (
          <p className="text-white/50">Loading communities…</p>
        ) : communities.length === 0 ? (
          <div className="border-y border-dashed border-white/15 px-6 py-14 text-center">
            <h2 className="text-xl font-semibold">No communities yet</h2>
            <p className="mt-2 text-white/45">Create the first community and start the discussion.</p>
          </div>
        ) : (
          <section className="divide-y divide-white/10 border-b border-white/10">
            {communities.map((community) => (
              <Link key={community.id} href={`/communities/${community.slug}`} className="group flex items-start gap-5 py-6 transition hover:bg-white/[0.02] sm:gap-7 sm:px-4">
                <div className="grid size-12 shrink-0 place-items-center border border-emerald-300/25 bg-emerald-300/[0.06] text-base font-semibold text-emerald-300">
                  {community.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold tracking-[-0.025em] text-white transition group-hover:text-emerald-200">{community.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">{community.description ?? "A new Converge community."}</p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Community space</p></div><span aria-hidden="true" className="mt-1 text-white/25 transition group-hover:translate-x-1 group-hover:text-emerald-300">↗</span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
