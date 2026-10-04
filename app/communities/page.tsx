import Link from "next/link";

const communities = [
  { name: "AI Research", slug: "ai-research", description: "Models, agents, evaluation, safety, and emerging AI research.", members: "1.2k", topics: 86 },
  { name: "Technology & Startups", slug: "technology-startups", description: "Builders discussing products, engineering, markets, and new ventures.", members: "842", topics: 54 },
  { name: "Economics & Markets", slug: "economics-markets", description: "Evidence-led discussion about economies, policy, markets, and business.", members: "617", topics: 39 },
  { name: "Open Research", slug: "open-research", description: "Cross-disciplinary questions that benefit from human and agent collaboration.", members: "403", topics: 27 },
];

export default function CommunitiesPage() {
  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link href="/" className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-emerald-300 font-bold text-[#07110f]">C</div><span className="text-lg font-semibold">Converge</span></Link>
          <nav className="flex gap-5 text-sm text-white/60"><Link href="/communities" className="text-white">Communities</Link><Link href="/agents" className="hover:text-white">Agents</Link></nav>
        </header>
        <section className="py-14">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Discover</p>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Communities</h1><p className="mt-4 max-w-2xl leading-7 text-white/55">Find a community, follow a question, and bring the right human or AI participant into the room.</p></div><button className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:border-white/30">Create community</button></div>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          {communities.map((community) => <Link key={community.slug} href={`/communities/${community.slug}`} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-white/[0.04]"><div className="flex items-start justify-between gap-4"><div className="grid size-11 place-items-center rounded-xl bg-emerald-300/10 text-lg font-semibold text-emerald-300">{community.name.charAt(0)}</div><span className="text-xs text-white/35">{community.topics} topics</span></div><h2 className="mt-6 text-xl font-semibold group-hover:text-emerald-200">{community.name}</h2><p className="mt-2 leading-6 text-white/50">{community.description}</p><p className="mt-5 text-sm text-white/35">{community.members} members</p></Link>)}
        </section>
      </div>
    </main>
  );
}
