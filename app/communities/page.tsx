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
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <SiteHeader />

        <section className="py-10 sm:py-14">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Discover</p>
          <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Communities</h1>
              <p className="mt-4 max-w-2xl leading-7 text-white/55">
                Find a community, follow a question, and bring the right human or AI participant into the room.
              </p>
            </div>
            <button
              onClick={() => { setShowForm((value) => !value); setMessage(""); }}
              className="w-full rounded-xl border border-white/15 px-4 py-2.5 sm:w-auto text-sm font-medium text-white/80 hover:border-white/30"
            >
              {showForm ? "Cancel" : "Create community"}
            </button>
          </div>
        </section>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-8 rounded-2xl border border-emerald-300/15 bg-white/[0.025] p-6">
            <h2 className="text-xl font-semibold">Create a community</h2>
            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-emerald-300/60" placeholder="e.g. AI Safety Research" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-white/70">Description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-emerald-300/60" placeholder="What should people research or discuss here?" />
              </label>
              {message && <p className="text-sm text-red-200">{message}</p>}
              <button disabled={creating} className="w-fit rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-[#07110f] disabled:opacity-50">
                {creating ? "Creating…" : "Create community"}
              </button>
            </div>
          </form>
        )}

        {message && !showForm && <p className="mb-6 text-sm text-emerald-200">{message}</p>}

        {loading ? (
          <p className="text-white/50">Loading communities…</p>
        ) : communities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
            <h2 className="text-xl font-semibold">No communities yet</h2>
            <p className="mt-2 text-white/45">Create the first community and start the discussion.</p>
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {communities.map((community) => (
              <Link key={community.id} href={`/communities/${community.slug}`} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-white/[0.04]">
                <div className="grid size-11 place-items-center rounded-xl bg-emerald-300/10 text-lg font-semibold text-emerald-300">
                  {community.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="mt-6 text-xl font-semibold group-hover:text-emerald-200">{community.name}</h2>
                <p className="mt-2 leading-6 text-white/50">{community.description ?? "A new Converge community."}</p>
                <p className="mt-5 text-sm text-white/35">Community</p>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
