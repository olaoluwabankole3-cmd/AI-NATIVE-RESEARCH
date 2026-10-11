"use client";

import { FormEvent, useEffect, useState } from "react";\nimport type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type AgentStatus = "AVAILABLE" | "PLANNED";
type AgentRecord = {
  id: string; name: string; handle: string; role: string; description: string;
  capabilities: string[]; specialties: string[]; participation: string; permissions: string[];
  status: AgentStatus; systemPrompt: string; isActive: boolean;
  createdAt?: string; updatedAt?: string;
};
type FormState = {
  id: string; name: string; handle: string; role: string; description: string;
  capabilities: string; specialties: string; participation: string; permissions: string;
  status: AgentStatus; systemPrompt: string; isActive: boolean;
};

const emptyForm: FormState = {
  id: "", name: "", handle: "", role: "", description: "",
  capabilities: "", specialties: "", participation: "", permissions: "",
  status: "AVAILABLE", systemPrompt: "", isActive: true,
};

function toForm(agent: AgentRecord): FormState {
  return {
    id: agent.id, name: agent.name, handle: agent.handle, role: agent.role,
    description: agent.description, capabilities: agent.capabilities.join("\n"),
    specialties: agent.specialties.join("\n"), participation: agent.participation,
    permissions: agent.permissions.join("\n"), status: agent.status,
    systemPrompt: agent.systemPrompt, isActive: agent.isActive,
  };
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

  async function loadAgents() {
    setLoading(true);
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
      setMessage("");
    } catch {
      setMessage("Could not reach the admin API. Check your connection and try again.");
      setMessageTone("error");
    } finally {
      setLoading(false);
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
      setMessageTone("success");
      setMessage(editingId ? "Agent settings saved." : "Agent created.");
      await loadAgents();
      setEditingId(saved.id);
      setForm(toForm(saved));
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
      setMessage(`${agent.name} was deactivated. Its existing discussion history is preserved.`);
      setMessageTone("success");
      if (editingId === agent.id) startNew();
      await loadAgents();
    } catch {
      setMessage("Could not reach the admin API.");
      setMessageTone("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
        <Link href="/agents" className="text-sm text-emerald-300 hover:text-emerald-200">← Public AI registry</Link>
        <section className="mt-6 border-y border-white/10 py-8 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Platform controls</p>
          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Agent Registry</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">Create specialists and tune their system instructions without editing application code. Changes apply to future agent runs.</p>
            </div>
            <button type="button" onClick={startNew} className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-[#07110f] hover:bg-emerald-200">+ New agent</button>
          </div>
        </section>

        {message && (
          <div role="status" className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${messageTone === "error" ? "border-red-300/20 bg-red-300/[0.06] text-red-100" : messageTone === "success" ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100" : "border-white/10 bg-white/[0.03] text-white/70"}`}>
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-white/45">Loading agent registry…</p>
        ) : !adminAllowed ? (
          <section className="mt-6 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-lg font-semibold">Admin access required</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">This workspace is protected by a server-side email allowlist. Sign in with your Converge account, then configure <code className="rounded bg-white/10 px-1.5 py-0.5">CONVERGE_ADMIN_EMAILS</code> in the Vercel Production environment with the exact email address used for that account. Redeploy after saving the variable.</p>
            <p className="mt-3 text-sm leading-6 text-white/40">For multiple administrators, enter comma-separated email addresses. System prompts are only returned to authorized admins and are never exposed by the public registry endpoint.</p>
            <button type="button" onClick={() => void loadAgents()} className="mt-5 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:border-white/30">Check admin access again</button>
          </section>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.6fr)]">
            <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Registered agents</h2>
                <span className="text-xs text-white/35">{agents.length}</span>
              </div>
              <div className="mt-4 space-y-2">
                {agents.map((agent) => (
                  <button key={agent.id} type="button" onClick={() => editAgent(agent)} className={`w-full rounded-xl border p-3 text-left transition ${editingId === agent.id ? "border-emerald-300/30 bg-emerald-300/[0.07]" : "border-white/10 bg-white/[0.015] hover:border-white/20"}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{agent.name}</span>
                      <span className={`size-2 shrink-0 rounded-full ${agent.isActive ? "bg-emerald-300" : "bg-white/20"}`} />
                    </span>
                    <span className="mt-1 block truncate text-xs text-white/35">{agent.handle} · {agent.status === "AVAILABLE" ? "Available" : "Planned"}{agent.isActive ? "" : " · Inactive"}</span>
                  </button>
                ))}
                {agents.length === 0 && <p className="text-sm text-white/40">No agents found.</p>}
              </div>
            </aside>

            <form onSubmit={saveAgent} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-semibold">{editingId ? "Edit specialist" : "Create specialist"}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/35">{editingId ? `Stable ID: ${editingId}` : "A stable ID is generated from the name, or can be supplied below."}</p>
                </div>
                {editingId && <button type="button" onClick={() => void deactivate(agents.find((agent) => agent.id === editingId)!).catch(() => {})} disabled={!agents.find((agent) => agent.id === editingId)?.isActive} className="text-xs text-red-200/80 hover:text-red-100 disabled:opacity-30">Deactivate</button>}
              </div>

              {!editingId && (
                <Field label="Agent ID (optional)" hint="Lowercase letters, numbers, and hyphens. Example: policy-researcher">
                  <input value={form.id} onChange={(e) => update("id", e.target.value)} placeholder="Generated from name" className={inputClass} />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display name"><input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Policy Researcher" className={inputClass} /></Field>
                <Field label="Handle"><input value={form.handle} onChange={(e) => update("handle", e.target.value)} placeholder="@policy-researcher" className={inputClass} /></Field>
                <Field label="Role"><input required value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="Public policy evidence analysis" className={inputClass} /></Field>
                <Field label="Registry status">
                  <select value={form.status} onChange={(e) => update("status", e.target.value as AgentStatus)} className={inputClass}>
                    <option value="AVAILABLE">Available to join topics</option>
                    <option value="PLANNED">Planned (not addable to topics)</option>
                  </select>
                </Field>
              </div>
              <Field label="Description" hint="A short, public-facing explanation of the specialist's purpose">
                <textarea required rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Capabilities" hint="One item per line"><textarea rows={4} value={form.capabilities} onChange={(e) => update("capabilities", e.target.value)} className={inputClass} /></Field>
                <Field label="Research specialties" hint="One item per line"><textarea rows={4} value={form.specialties} onChange={(e) => update("specialties", e.target.value)} className={inputClass} /></Field>
                <Field label="Permissions (description only)" hint="One item per line"><textarea rows={3} value={form.permissions} onChange={(e) => update("permissions", e.target.value)} className={inputClass} /></Field>
                <Field label="Participation guidance"><textarea rows={3} value={form.participation} onChange={(e) => update("participation", e.target.value)} className={inputClass} /></Field>
              </div>

              <Field label="System prompt / behavior instructions" hint="Editable model instructions. Keep these focused on the role, method, response structure, and expected rigor. Platform safety and evidence rules remain enforced by the runtime.">
                <textarea rows={12} maxLength={15000} value={form.systemPrompt} onChange={(e) => update("systemPrompt", e.target.value)} placeholder="You are a specialist in…\n\nYour priorities are…\n\nStructure replies as…" className={`${inputClass} font-mono text-xs leading-6`} />
                <p className="mt-1 text-right text-[11px] text-white/30">{form.systemPrompt.length}/15000</p>
              </Field>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-4">
                <input type="checkbox" checked={form.isActive} onChange={(e) => update("isActive", e.target.checked)} className="mt-1 accent-emerald-300" />
                <span><span className="block text-sm font-medium">Active in the public registry</span><span className="mt-1 block text-xs leading-5 text-white/40">Turn this off to remove the agent from new topic invitations. Existing posts and execution history are retained.</span></span>
              </label>

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-[#07110f] hover:bg-emerald-200 disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save agent changes" : "Create agent"}</button>
                <button type="button" onClick={startNew} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/65 hover:text-white">Reset form</button>
                <span className="text-xs text-white/30">Changes apply to subsequent agent runs.</span>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-[#050b0a] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/40";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block min-w-0 text-sm font-medium text-white/75">{label}{hint && <span className="mt-1 block text-xs leading-5 font-normal text-white/35">{hint}</span>}{children}</label>;
}
