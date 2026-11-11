"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Specialist = {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  capabilities: string[];
  status: "AVAILABLE" | "PLANNED";
};

function initials(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AI";
}

export function SpecialistDirectory({ agents }: { agents: Specialist[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "planned">("all");
  const [selectedId, setSelectedId] = useState<string | null>(agents[0]?.id ?? null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return agents.filter((agent) => (filter === "all" || agent.status.toLowerCase() === filter)
      && (!needle || [agent.name, agent.role, agent.handle, agent.description, ...agent.capabilities].join(" ").toLocaleLowerCase().includes(needle)));
  }, [agents, filter, query]);

  const selected = filtered.find((agent) => agent.id === selectedId) ?? filtered[0] ?? null;

  return (
    <section className="converge-specialist-directory" aria-label="AI specialist directory">
      <aside className="converge-specialist-directory__list">
        <div className="converge-specialist-directory__heading">
          <h2>AI specialists</h2>
          <span>{agents.length} registered</span>
        </div>
        <label htmlFor="converge-specialist-search" className="sr-only">Find an AI specialist</label>
        <input id="converge-specialist-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a specialist…" />
        <div className="converge-specialist-directory__filters" role="group" aria-label="Filter specialists">
          {([{ id: "all", label: "All" }, { id: "available", label: "Available" }, { id: "planned", label: "Planned" }] as const).map((item) => (
            <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
        <p className="converge-app-eyebrow">SPECIALIST DIRECTORY</p>
        {!filtered.length ? <p className="converge-specialist-directory__empty">No specialists match your search. <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button></p>
          : <div className="converge-specialist-directory__items">
              {filtered.map((agent) => (
                <button key={agent.id} type="button" aria-pressed={selected?.id === agent.id} onClick={() => setSelectedId(agent.id)} className="converge-specialist-directory__item">
                  <span className="converge-specialist-directory__avatar" aria-hidden="true">{initials(agent.name)}</span>
                  <span><strong>{agent.name}</strong><small>{agent.role}</small></span>
                </button>
              ))}
            </div>}
        <Link href="/admin/agents" className="converge-app-action converge-specialist-directory__manage">Manage registry ↗</Link>
      </aside>
      <div className="converge-specialist-directory__detail">
        {selected ? <>
          <p className="converge-app-eyebrow">SPECIALIST PROFILE</p>
          <h2>{selected.name}</h2>
          <p className="converge-specialist-directory__intro">A clearly identified AI specialist for research support.</p>
          <div className="converge-specialist-directory__profile">
            <span className="converge-specialist-directory__avatar converge-specialist-directory__avatar--large" aria-hidden="true">{initials(selected.name)}</span>
            <div>
              <h3>{selected.name}</h3>
              <p className="converge-app-eyebrow">AI SPECIALIST · {selected.status.toLowerCase()}</p>
            </div>
            <p>{selected.description || selected.role}</p>
            <p className="converge-app-eyebrow">SPECIALTIES</p>
            <div className="converge-specialist-directory__tags">{selected.capabilities.slice(0, 8).map((capability) => <span key={capability}>{capability}</span>)}</div>
          </div>
          <div className="converge-specialist-directory__participation">
            <p className="converge-app-eyebrow">HUMAN-LED BY DESIGN</p>
            <h3>AI participation stays transparent.</h3>
            <p>Specialists are identifiable contributors. Research-room access, availability and invitation rules still apply.</p>
            <Link href={`/agents/${selected.id}`} className="converge-app-action converge-app-action--primary">View full specialist profile ↗</Link>
          </div>
        </> : <div className="converge-specialist-directory__empty">No specialists are available for the selected filter.</div>}
      </div>
      <aside className="converge-specialist-directory__context">
        <p className="converge-app-eyebrow">RESEARCH WORKFLOW</p>
        <h2>Keep the human in control.</h2>
        <p>Add available specialists from eligible topic rooms and review their contributions alongside human discussion and evidence.</p>
        <Link href="/communities" className="converge-app-action">Browse research rooms ↗</Link>
        <Link href="/admin/agents" className="converge-app-action converge-app-action--primary">Manage AI registry ↗</Link>
      </aside>
    </section>
  );
}
