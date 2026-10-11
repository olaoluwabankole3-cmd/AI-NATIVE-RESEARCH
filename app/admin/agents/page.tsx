"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type AgentStatus = "AVAILABLE" | "PLANNED";
type AgentRecord = {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  capabilities: string[];
  specialties: string[];
  participation: string;
  permissions: string[];
  status: AgentStatus;
  systemPrompt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type FormState = {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  capabilities: string;
  specialties: string;
  participation: string;
  permissions: string;
  status: AgentStatus;
  systemPrompt: string;
  isActive: boolean;
};
type RegistryFilter = "all" | "active" | "planned";

const emptyForm: FormState = {
  id: "",
  name: "",
  handle: "",
  role: "",
  description: "",
  capabilities: "",
  specialties: "",
  participation: "",
  permissions: "",
  status: "AVAILABLE",
  systemPrompt: "",
  isActive: true,
};

function toForm(agent: AgentRecord): FormState {
  return {
    id: agent.id,
    name: agent.name,
    handle: agent.handle,
    role: agent.role,
    description: agent.description,
    capabilities: agent.capabilities.join("\n"),
    specialties: agent.specialties.join("\n"),
    participation: agent.participation,
    permissions: agent.permissions.join("\n"),
    status: agent.status,
    systemPrompt: agent.systemPrompt,
    isActive: agent.isActive,
  };
}

function Icon({ name, size = 18 }: { name: "plus" | "search" | "bot" | "check" | "clock" | "shield" | "sparkles" | "arrow" | "sliders" | "refresh" | "external" | "book" | "activity"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M9 13h.01M15 13h.01M9 17h6" /><path d="M2 12h2M20 12h2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    sparkles: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>,
    external: <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h7M8 10h6" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AI";
}

export default function AgentAdminPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [registryFilter, setRegistryFilter] = useState<RegistryFilter>("all");

  async function loadAgents(options: { quiet?: boolean } = {}) {
    const quiet = options.quiet ?? false;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/admin/agents", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setAdminAllowed(false);
        setMessage(payload.error || "The registry could not be loaded.");
        setMessageTone("error");
        return;
      }
      setAgents(payload.agents ?? []);
      setAdminAllowed(true);
      if (!quiet) setMessage("");
    } catch {
      setMessage("Could not reach the admin API. Check your connection and try again.");
      setMessageTone("error");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => { void loadAgents(); }, []);

  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  function editAgent(agent: AgentRecord) {
    setEditingId(agent.id);
    setForm(toForm(agent));
    setMessage("");
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const body = {
      ...form,
      capabilities: form.capabilities,
      specialties: form.specialties,
      permissions: form.permissions,
    };

    try {
      const url = editingId ? `/api/admin/agents/${encodeURIComponent(editingId)}` : "/api/admin/agents";
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "The agent could not be saved.");
        setMessageTone("error");
        return;
      }
      const saved = payload.agent as AgentRecord;
      await loadAgents({ quiet: true });
      setEditingId(saved.id);
      setForm(toForm(saved));
      setMessageTone("success");
      setMessage(editingId ? "Agent settings saved. New instructions will apply to future runs." : "Agent created and added to your registry.");
    } catch {
      setMessage("The request failed. Check your connection and try again.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(agent: AgentRecord) {
    if (!window.confirm(`Deactivate ${agent.name}? Existing posts and history will be preserved, but it will no longer be available to add to new topics.`)) return;
    setMessage("");
    try {
      const response = await fetch(`/api/admin/agents/${encodeURIComponent(agent.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "The agent could not be deactivated.");
        setMessageTone("error");
        return;
      }
      if (editingId === agent.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await loadAgents({ quiet: true });
      setMessage(`${agent.name} was deactivated. Its existing discussion history is preserved.`);
      setMessageTone("success");
    } catch {
      setMessage("Could not reach the admin API.");
      setMessageTone("error");
    }
  }

  const editingAgent = agents.find((agent) => agent.id === editingId);
  const filteredAgents = agents.filter((agent) => {
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch = !term || [agent.name, agent.handle, agent.role, agent.description, agent.id]
      .some((value) => value.toLowerCase().includes(term));
    const matchesFilter = registryFilter === "all"
      || (registryFilter === "active" && agent.isActive)
      || (registryFilter === "planned" && agent.status === "PLANNED");
    return matchesSearch && matchesFilter;
  });
  const activeCount = agents.filter((agent) => agent.isActive).length;
  const availableCount = agents.filter((agent) => agent.isActive && agent.status === "AVAILABLE").length;
  const plannedCount = agents.filter((agent) => agent.status === "PLANNED").length;

  return (
    <main className="relative min-h-screen isolate overflow-hidden bg-[#07110f] text-[#eff8f1]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-48 -top-48 h-[34rem] w-[34rem] rounded-full bg-emerald-400/[0.07] blur-[100px]" />
        <div className="absolute -bottom-72 -left-48 h-[34rem] w-[34rem] rounded-full bg-teal-500/[0.05] blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(rgba(173,232,190,.45) .65px, transparent .65px)", backgroundSize: "22px 22px", maskImage: "linear-gradient(to bottom, black, transparent 75%)" }} />
      </div>
      <div className="relative z-10">
        <SiteHeader />
        <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 sm:px-6 sm:pt-9 lg:px-10 xl:px-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Link href="/communities" className="transition hover:text-white/75">Workspace</Link>
              <span className="text-white/20">/</span>
              <span className="text-white/75">Agent Registry</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-200/[0.05] px-3 py-1.5 text-[11px] font-medium text-emerald-100/80">
              <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300/60" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" /></span>
              Platform control room
            </div>
          </div>

          <section className="relative mt-5 overflow-hidden rounded-[28px] border border-white/[0.09] bg-[linear-gradient(115deg,rgba(19,43,31,.96),rgba(12,25,20,.97)_55%,rgba(12,23,20,.94))] p-6 shadow-[0_24px_90px_rgba(0,0,0,.2)] sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-16 -top-32 size-[24rem] rounded-full border border-emerald-100/[0.09]" />
            <div className="pointer-events-none absolute -right-4 -top-20 size-[19rem] rounded-full border border-dashed border-emerald-100/[0.08]" />
            <div className="pointer-events-none absolute right-[9%] top-[18%] hidden size-40 rounded-full bg-emerald-300/[0.06] blur-3xl lg:block" />
            <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-black/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-200/90">
                  <Icon name="sparkles" size={14} /> Converge / Platform ops
                </div>
                <h1 className="mt-5 text-4xl font-semibold tracking-[-.055em] text-white sm:text-5xl lg:text-[3.65rem]">Your agents.<br className="hidden sm:block" /> Your rules.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#b0c5b6] sm:text-base">
                  Shape the specialists behind every research conversation. Create agents, tune their behaviour, and decide how they participate—all without editing application code.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <button type="button" onClick={startNew} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#a4edc1] px-5 text-sm font-bold text-[#092016] shadow-[0_8px_28px_rgba(129,230,164,.12)] transition hover:-translate-y-0.5 hover:bg-[#c1f6d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
                  <Icon name="plus" size={17} /> Create an agent
                </button>
                <Link href="/agents" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.035] px-5 text-sm font-semibold text-white/75 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white">
                  Explore public registry <Icon name="external" size={15} />
                </Link>
              </div>
            </div>
          </section>

          <section aria-label="Registry overview" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Registered agents" value={loading || !adminAllowed ? "—" : String(agents.length)} note="Across your workspace" icon={<Icon name="bot" size={18} />} accent="mint" />
            <StatCard label="Active agents" value={loading || !adminAllowed ? "—" : String(activeCount)} note="Included in the public registry" icon={<Icon name="activity" size={18} />} accent="mint" />
            <StatCard label="Ready to join" value={loading || !adminAllowed ? "—" : String(availableCount)} note="Available for new topics" icon={<Icon name="check" size={18} />} accent="blue" />
            <StatCard label="In planning" value={loading || !adminAllowed ? "—" : String(plannedCount)} note="Not available for invitations" icon={<Icon name="clock" size={18} />} accent="amber" />
          </section>

          {message && (
            <div role="status" aria-live="polite" className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 shadow-lg shadow-black/10 ${messageTone === "error" ? "border-rose-300/20 bg-rose-300/[0.07] text-rose-100" : messageTone === "success" ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50" : "border-white/10 bg-white/[0.035] text-white/75"}`}>
              <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${messageTone === "error" ? "bg-rose-300/10 text-rose-200" : messageTone === "success" ? "bg-emerald-300/10 text-emerald-200" : "bg-white/10 text-white/70"}`}>
                <Icon name={messageTone === "error" ? "activity" : messageTone === "success" ? "check" : "sparkles"} size={14} />
              </span>
              <span>{message}</span>
            </div>
          )}

          {loading ? (
            <div className="mt-6 grid gap-5 xl:grid-cols-[350px_minmax(0,1fr)]" aria-label="Loading agent registry">
              <div className="h-[440px] animate-pulse rounded-3xl border border-white/[0.08] bg-white/[0.025]" />
              <div className="h-[680px] animate-pulse rounded-3xl border border-white/[0.08] bg-white/[0.025]" />
            </div>
          ) : !adminAllowed ? (
            <section className="mt-6 max-w-3xl rounded-3xl border border-white/10 bg-[#0d1914]/90 p-6 shadow-2xl shadow-black/20 sm:p-9">
              <div className="grid size-12 place-items-center rounded-2xl border border-amber-200/15 bg-amber-200/[0.07] text-amber-100"><Icon name="shield" size={22} /></div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-200/70">Restricted workspace</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Admin access required</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">This workspace is protected by a server-side email allowlist. Sign in with the account authorized to manage Converge, then confirm that <code className="rounded-md border border-white/10 bg-black/25 px-1.5 py-1 text-emerald-100">CONVERGE_ADMIN_EMAILS</code> contains that exact email in the Vercel Production environment.</p>
              <p className="mt-3 text-xs leading-6 text-white/35">For multiple administrators, separate email addresses with commas. System prompts are only returned to authorized admins and are not exposed by the public registry endpoint.</p>
              <button type="button" onClick={() => void loadAgents()} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/80 transition hover:border-emerald-200/30 hover:bg-white/[0.04]"><Icon name="refresh" size={15} /> Check access again</button>
            </section>
          ) : (
            <div className="mt-6 grid items-start gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
              <aside className="overflow-hidden rounded-3xl border border-white/[0.09] bg-[#0c1713]/90 shadow-[0_22px_80px_rgba(0,0,0,.16)] xl:sticky xl:top-24">
                <div className="border-b border-white/[0.07] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-200/70">Your workforce</p>
                      <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">Agent directory</h2>
                      <p className="mt-1 text-xs leading-5 text-white/40">Select a specialist to manage its profile.</p>
                    </div>
                    <span className="grid min-w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] px-2 py-2 text-sm font-semibold tabular-nums text-white/75">{agents.length}</span>
                  </div>
                  <label className="mt-5 flex h-11 items-center gap-2.5 rounded-xl border border-white/10 bg-[#07110e] px-3.5 text-white/35 transition focus-within:border-emerald-200/40 focus-within:ring-2 focus-within:ring-emerald-200/[0.08]">
                    <Icon name="search" size={16} />
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search agents" placeholder="Search name, handle, role…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
                    {searchQuery && <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} className="text-xs text-white/45 hover:text-white">Clear</button>}
                  </label>
                  <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
                    {([
                      ["all", "All agents"],
                      ["active", "Active"],
                      ["planned", "Planned"],
                    ] as const).map(([filter, label]) => (
                      <button key={filter} type="button" onClick={() => setRegistryFilter(filter)} className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition ${registryFilter === filter ? "bg-[#a4edc1] text-[#0a2016] shadow-sm" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[620px] space-y-1.5 overflow-y-auto p-3 sm:p-4">
                  {filteredAgents.map((agent) => {
                    const selected = editingId === agent.id;
                    return (
                      <button key={agent.id} type="button" onClick={() => editAgent(agent)} aria-pressed={selected} className={`group relative w-full overflow-hidden rounded-2xl border p-3.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/70 ${selected ? "border-emerald-200/25 bg-emerald-200/[0.075] shadow-[inset_0_0_0_1px_rgba(164,237,193,.04)]" : "border-transparent bg-white/[0.018] hover:border-white/[0.09] hover:bg-white/[0.035]"}`}>
                        {selected && <span className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-emerald-200" />}
                        <span className="flex items-start gap-3">
                          <span className={`grid size-11 shrink-0 place-items-center rounded-[14px] border text-xs font-bold tracking-wide ${selected ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-100" : "border-white/[0.08] bg-white/[0.035] text-white/60"}`}>{initials(agent.name)}</span>
                          <span className="min-w-0 flex-1 pt-0.5">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-white/90">{agent.name}</span>
                              <span className={`ml-auto size-1.5 shrink-0 rounded-full ${agent.isActive ? "bg-emerald-300 shadow-[0_0_10px_rgba(134,239,172,.35)]" : "bg-white/20"}`} />
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-white/35">{agent.handle || `@${agent.id}`}</span>
                            <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-md border px-1.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${agent.status === "AVAILABLE" ? "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100/75" : "border-amber-200/15 bg-amber-200/[0.05] text-amber-100/75"}`}>{agent.status === "AVAILABLE" ? "Available" : "Planned"}</span>
                              {!agent.isActive && <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-white/40">Inactive</span>}
                            </span>
                            {agent.role && <span className="mt-2 block line-clamp-2 text-[11px] leading-5 text-white/40">{agent.role}</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {filteredAgents.length === 0 && (
                    <div className="px-3 py-10 text-center">
                      <span className="mx-auto grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/40"><Icon name="search" /></span>
                      <p className="mt-3 text-sm font-medium text-white/75">No matching agents</p>
                      <p className="mt-1 text-xs leading-5 text-white/35">Try another search or choose a different filter.</p>
                      <button type="button" onClick={() => { setSearchQuery(""); setRegistryFilter("all"); }} className="mt-3 text-xs font-semibold text-emerald-200 hover:text-emerald-100">Clear filters</button>
                    </div>
                  )}
                </div>
                <div className="border-t border-white/[0.07] bg-black/10 px-5 py-3.5">
                  <p className="flex items-center gap-2 text-[10px] text-white/35"><Icon name="shield" size={13} /> Prompts and registry changes are admin-only.</p>
                </div>
              </aside>

              <section className="min-w-0 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#0c1713]/95 shadow-[0_22px_80px_rgba(0,0,0,.18)]">
                <form onSubmit={saveAgent}>
                  <div className="border-b border-white/[0.07] bg-[linear-gradient(100deg,rgba(255,255,255,.025),transparent)] px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-100">
                          <Icon name={editingId ? "sliders" : "plus"} size={21} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-200/65">{editingId ? "Configuration" : "New specialist"}</p>
                          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">{editingId ? (form.name || "Edit specialist") : "Create an agent"}</h2>
                          <p className="mt-1 text-xs leading-5 text-white/40">{editingId ? `Editing registry ID: ${editingId}` : "Give your new specialist a clear role and a reliable set of instructions."}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {editingAgent && <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.09em] ${editingAgent.isActive ? "border-emerald-200/15 bg-emerald-200/[0.05] text-emerald-100/80" : "border-white/10 bg-white/[0.03] text-white/45"}`}><span className={`size-1.5 rounded-full ${editingAgent.isActive ? "bg-emerald-300" : "bg-white/25"}`} />{editingAgent.isActive ? "Active" : "Inactive"}</span>}
                        {editingId && <button type="button" onClick={() => void deactivate(editingAgent ?? agents.find((agent) => agent.id === editingId)!)} disabled={!editingAgent?.isActive} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-200/65 transition hover:bg-rose-300/[0.07] hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-25">Deactivate</button>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
                    <FormSection number="01" title="Identity & availability" description="Set the name people see, the specialist's role, and where it can participate.">
                      {!editingId && (
                        <Field label="Agent ID" hint="Optional · lowercase letters, numbers, and hyphens">
                          <input value={form.id} onChange={(event) => update("id", event.target.value)} placeholder="e.g. policy-researcher" className={inputClass} />
                        </Field>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Display name" required>
                          <input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Policy Researcher" className={inputClass} />
                        </Field>
                        <Field label="Handle" hint="How this specialist appears in conversations">
                          <input value={form.handle} onChange={(event) => update("handle", event.target.value)} placeholder="@policy-researcher" className={inputClass} />
                        </Field>
                        <Field label="Role" required>
                          <input required value={form.role} onChange={(event) => update("role", event.target.value)} placeholder="Public policy evidence analysis" className={inputClass} />
                        </Field>
                        <Field label="Participation status">
                          <select value={form.status} onChange={(event) => update("status", event.target.value as AgentStatus)} className={inputClass}>
                            <option value="AVAILABLE">Available to join topics</option>
                            <option value="PLANNED">Planned · not addable to topics</option>
                          </select>
                        </Field>
                      </div>
                      <Field label="Description" hint="A short explanation shown to people browsing the public registry." required>
                        <textarea required rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What is this agent designed to help with?" className={inputClass} />
                      </Field>
                    </FormSection>

                    <FormSection number="02" title="Expertise & participation" description="Make the agent's strengths and expected behaviour easy to understand.">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Field label="Capabilities" hint="One item per line">
                          <textarea rows={4} value={form.capabilities} onChange={(event) => update("capabilities", event.target.value)} placeholder={"Evidence synthesis\nSummarization\nCritical review"} className={inputClass} />
                        </Field>
                        <Field label="Research specialties" hint="One item per line">
                          <textarea rows={4} value={form.specialties} onChange={(event) => update("specialties", event.target.value)} placeholder={"Literature review\nSource comparison\nPolicy analysis"} className={inputClass} />
                        </Field>
                        <Field label="Permissions (description only)" hint="Describe expected access; this text does not enforce security rules.">
                          <textarea rows={3} value={form.permissions} onChange={(event) => update("permissions", event.target.value)} placeholder={"Read topic context\nPublish responses in assigned discussions"} className={inputClass} />
                        </Field>
                        <Field label="Participation guidance" hint="When should this agent join, and what should it contribute?">
                          <textarea rows={3} value={form.participation} onChange={(event) => update("participation", event.target.value)} placeholder="Join when research assistance is requested…" className={inputClass} />
                        </Field>
                      </div>
                    </FormSection>

                    <FormSection number="03" title="System prompt & behaviour" description="The working instructions that shape every future response from this specialist.">
                      <div className="overflow-hidden rounded-2xl border border-emerald-200/[0.14] bg-[#07120e] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
                        <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] bg-[linear-gradient(90deg,rgba(164,237,193,.055),transparent)] px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-8 place-items-center rounded-lg border border-emerald-200/15 bg-emerald-200/[0.07] text-emerald-100"><Icon name="sparkles" size={15} /></span>
                            <div>
                              <p className="text-xs font-semibold text-white/85">Behaviour instructions</p>
                              <p className="mt-0.5 text-[10px] text-white/35">Private to authorized platform admins</p>
                            </div>
                          </div>
                          <span className={`self-start rounded-full border px-2.5 py-1 text-[10px] font-medium tabular-nums sm:self-auto ${form.systemPrompt.length > 14000 ? "border-amber-200/20 text-amber-100/80" : "border-white/[0.08] text-white/40"}`}>{form.systemPrompt.length.toLocaleString()}/15,000 characters</span>
                        </div>
                        <textarea rows={13} maxLength={15000} value={form.systemPrompt} onChange={(event) => update("systemPrompt", event.target.value)} aria-label="System prompt and behaviour instructions" placeholder={"You are a specialist in…\n\nYour priorities are…\n\nStructure replies as…\n\nWhen evidence is missing, explain what is uncertain."} className="min-h-[250px] w-full resize-y bg-transparent px-4 py-4 font-mono text-xs leading-6 text-emerald-50/85 outline-none placeholder:text-white/20 focus:bg-emerald-100/[0.015] sm:px-5 sm:py-5 sm:text-[13px]" />
                        <div className="flex items-start gap-2.5 border-t border-white/[0.06] px-4 py-3 text-[10px] leading-5 text-white/35 sm:px-5">
                          <Icon name="shield" size={13} />
                          <p>Role instructions are combined with platform-level guardrails. Changes apply to future agent runs; they don't rewrite previous replies.</p>
                        </div>
                      </div>
                    </FormSection>

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.018] p-4 sm:p-5">
                      <label className="flex cursor-pointer items-start gap-3.5">
                        <input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} className="mt-1 size-4 shrink-0 accent-emerald-300" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white/90">Active in the public registry <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] ${form.isActive ? "bg-emerald-200/10 text-emerald-100/80" : "bg-white/[0.06] text-white/40"}`}>{form.isActive ? "Enabled" : "Disabled"}</span></span>
                          <span className="mt-1 block text-xs leading-5 text-white/40">Turn this off to remove the agent from new topic invitations. Existing posts and execution history are retained.</span>
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={startNew} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/55 transition hover:border-white/20 hover:bg-white/[0.035] hover:text-white/85"><Icon name="refresh" size={15} /> {editingId ? "Discard changes" : "Clear form"}</button>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <span className="self-center text-[10px] text-white/30">Saved changes apply to future runs.</span>
                        <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#a4edc1] px-5 text-sm font-bold text-[#092016] shadow-[0_8px_26px_rgba(129,230,164,.1)] transition hover:-translate-y-0.5 hover:bg-[#c1f6d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-wait disabled:opacity-60">
                          {saving ? <><span className="size-4 animate-spin rounded-full border-2 border-[#092016]/25 border-t-[#092016]" /> Saving changes…</> : <><Icon name="check" size={16} /> {editingId ? "Save changes" : "Create specialist"}</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          )}

          <footer className="mt-8 flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-5 text-[10px] leading-5 text-white/30 sm:flex-row sm:items-center">
            <p>Converge · Agent Registry <span className="mx-1.5 text-white/15">/</span> Platform administration</p>
            <p className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-300/70" /> Changes are saved to the registry and used by future runs.</p>
          </footer>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, note, icon, accent }: { label: string; value: string; note: string; icon: ReactNode; accent: "mint" | "blue" | "amber" }) {
  const accents = {
    mint: "border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-100",
    blue: "border-sky-200/15 bg-sky-200/[0.06] text-sky-100",
    amber: "border-amber-200/15 bg-amber-200/[0.06] text-amber-100",
  };
  return (
    <div className="group rounded-2xl border border-white/[0.08] bg-[#0c1713]/85 p-4 transition hover:border-white/[0.14] hover:bg-[#0e1b16] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-white/45 sm:text-xs">{label}</p>
        <span className={`grid size-9 place-items-center rounded-xl border ${accents[accent]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-[-.055em] text-white tabular-nums sm:text-[2.15rem]">{value}</p>
      <p className="mt-1 text-[10px] leading-5 text-white/30 sm:text-[11px]">{note}</p>
    </div>
  );
}

function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] font-mono text-[10px] text-emerald-100/70">{number}</span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-white sm:text-[15px]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-white/38">{description}</p>
        </div>
      </div>
      <div className="space-y-4 pl-0 sm:pl-[46px]">{children}</div>
    </section>
  );
}

const inputClass = "mt-2 w-full min-w-0 rounded-xl border border-white/[0.10] bg-[#07110e] px-3.5 py-3 text-sm leading-6 text-white/90 outline-none transition placeholder:text-white/22 hover:border-white/[0.16] focus:border-emerald-200/45 focus:ring-2 focus:ring-emerald-200/[0.07]";

function Field({ label, hint, required = false, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block min-w-0 text-xs font-semibold text-white/70">
      <span className="flex flex-wrap items-center gap-1.5">{label}{required && <span className="text-emerald-200">*</span>}</span>
      {hint && <span className="mt-1 block text-[10px] font-normal leading-5 text-white/35">{hint}</span>}
      {children}
    </label>
  );
}
