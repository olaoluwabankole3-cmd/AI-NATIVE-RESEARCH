"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ArtifactType = "CLAIM" | "EVIDENCE" | "SOURCE" | "SYNTHESIS" | "DECISION";

type ResearchArtifact = {
  id: string;
  topic_id: string;
  created_by_participant_id: string | null;
  artifact_type: ArtifactType;
  title: string;
  content: string;
  provenance: {
    source_url?: string;
    note?: string;
    generated?: boolean;
    generated_by_agent_name?: string;
    provider?: string;
    model?: string;
    context_artifact_ids?: string[];
    context_post_count?: number;
  };
  created_at: string;
};

const artifactTypes: Array<{ value: ArtifactType; label: string; description: string }> = [
  { value: "CLAIM", label: "Claim", description: "A specific proposition the room wants to examine." },
  { value: "EVIDENCE", label: "Evidence", description: "An observation, data point, quotation, or supporting material." },
  { value: "SOURCE", label: "Source", description: "A reference worth preserving for later verification." },
  { value: "SYNTHESIS", label: "Synthesis", description: "A concise combination of the strongest findings so far." },
  { value: "DECISION", label: "Decision", description: "A proposed decision or next action grounded in the discussion." },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ResearchRoom({
  topicId,
  participantId,
}: {
  topicId: string;
  participantId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ArtifactType>("SYNTHESIS");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [generating, setGenerating] = useState(false);

  async function loadArtifacts() {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase
        .from("research_artifacts")
        .select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, created_at")
        .eq("topic_id", topicId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setArtifacts((data ?? []) as ResearchArtifact[]);
    } catch (caught) {
      const error = caught as { code?: string };
      setLoadError(error?.code === "42P01"
        ? "Research storage is not yet available."
        : "Could not load the research record. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArtifacts();
  }, [topicId]);

  // Bring mobile and keyboard users directly into the artifact editor.
  useEffect(() => {
    if (showForm) document.getElementById("research-artifact-title")?.focus();
  }, [showForm]);

  async function handleGenerateSynthesis() {
    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch(`/api/topics/${topicId}/agents/research-analyst/artifacts/synthesis`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Could not generate a synthesis.");
      if (!payload?.artifact?.id) throw new Error("Synthesis response incomplete. Reload to check whether it saved.");
      setArtifacts((current) => [payload.artifact as ResearchArtifact, ...current]);
      setMessage("Research Analyst synthesis saved to the evidence record.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The research synthesis runtime could not be reached.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const trimmedSourceUrl = sourceUrl.trim();

    if (!trimmedTitle || !trimmedContent) {
      setMessage("Add a title and the research material before saving.");
      return;
    }

    setSaving(true);
    setMessage("");

    const provenance = {
      ...(trimmedSourceUrl ? { source_url: trimmedSourceUrl } : {}),
      note: "Created from the Converge research room by a human participant.",
    };

    try {
      const { data, error } = await supabase
        .from("research_artifacts")
        .insert({
          topic_id: topicId,
          created_by_participant_id: participantId,
          artifact_type: type,
          title: trimmedTitle,
          content: trimmedContent,
          provenance,
        })
        .select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, created_at")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Could not confirm the save. Reload before trying again.");
      setArtifacts((current) => [data as ResearchArtifact, ...current]);
      setTitle("");
      setContent("");
      setSourceUrl("");
      setType("SYNTHESIS");
      setShowForm(false);
      setMessage("Artifact saved to this research room.");
    } catch (caught) {
      const error = caught as { code?: string; message?: string };
      setMessage(error?.code === "42P01"
        ? "Research storage is not available yet."
        : error?.message || "Could not save your artifact. Your draft is preserved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="research-record" aria-labelledby="research-room-heading" className="converge-research-room mt-12 min-w-0 rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.02] p-4 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Research room</p>
          <h2 id="research-room-heading" className="mt-2 text-2xl font-semibold">Evidence & provenance</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Preserve important claims, evidence, sources, syntheses, and decisions separately from the conversation stream.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleGenerateSynthesis()}
            disabled={generating || saving || loading}
            aria-busy={generating}
            className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.05] px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate synthesis"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            aria-expanded={showForm}
            aria-controls="converge-artifact-form"
            className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-[#07110f] hover:bg-emerald-200"
          >
            {showForm ? "Close" : "Add artifact"}
          </button>
        </div>
      </div>

      {showForm && (
        <form id="converge-artifact-form" onSubmit={handleCreate} className="mt-5 grid min-w-0 gap-4 rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm text-white/65">Artifact type</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as ArtifactType)}
                className="w-full rounded-xl border border-white/10 bg-[#0b1714] px-4 py-3 outline-none focus:border-emerald-300/60"
              >
                {artifactTypes.map((artifact) => (
                  <option key={artifact.value} value={artifact.value}>
                    {artifact.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-white/30">
                {artifactTypes.find((artifact) => artifact.value === type)?.description}
              </span>
            </label>

            <label>
              <span className="mb-2 block text-sm text-white/65">Title</span>
              <input
                id="research-artifact-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Primary finding from the Afridata literature review"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-emerald-300/60"
              />
            </label>
          </div>

          <label>
            <span className="mb-2 block text-sm text-white/65">Research material</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder="Write the claim, evidence, source notes, synthesis, or decision you want preserved."
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 leading-6 outline-none focus:border-emerald-300/60"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-white/65">Source URL (optional)</span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              type="url"
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-emerald-300/60"
            />
          </label>

          {message && <p role="status" aria-live="polite" className="text-sm text-amber-100">{message}</p>}

          <button
            disabled={saving}
            className="w-fit rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#07110f] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save research artifact"}
          </button>
        </form>
      )}

      {message && !showForm && (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-sm text-amber-100/80">
          {message}
        </div>
      )}

      {loading ? (
        <div role="status" aria-label="Loading research artifacts" className="mt-6 space-y-3">
          {[0, 1].map((item) => <div key={item} className="animate-pulse rounded-xl border border-white/[0.07] p-5">
            <div className="h-3 w-24 rounded bg-emerald-200/10" />
            <div className="mt-4 h-4 w-2/3 rounded bg-white/[0.08]" />
            <div className="mt-3 h-3 w-full rounded bg-white/[0.05]" />
          </div>)}
          <span className="sr-only">Loading research record…</span>
        </div>
      ) : loadError ? (
        <div role="alert" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.04] p-5">
          <p className="text-sm leading-6 text-amber-100">{loadError}</p>
          <button type="button" onClick={() => void loadArtifacts()} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-emerald-200/25 px-4 text-xs font-semibold text-emerald-100 hover:bg-emerald-200/[0.08]">Retry loading</button>
        </div>
      ) : artifacts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-7 text-center">
          <p className="text-sm text-white/40">No research artifacts have been preserved yet.</p>
          <p className="mt-2 text-xs text-white/45">Start with a claim, source, or synthesis from the current discussion.</p>
          <button type="button" onClick={() => setShowForm(true)} className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-emerald-200/25 px-4 text-xs font-semibold text-emerald-100 hover:bg-emerald-200/[0.08]">Add your first artifact</button>
        </div>
      ) : artifacts.length > 0 ? (
        <div className="mt-6 space-y-3">
          {artifacts.map((artifact) => (
            <article key={artifact.id} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-200">
                  {artifact.artifact_type}
                </span>
                <span className="text-xs text-white/30">{formatDate(artifact.created_at)}</span>
              </div>
              <h3 className="mt-3 break-words text-lg font-semibold">{artifact.title}</h3>
              {artifact.provenance?.generated && (
                <div className="mt-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] px-3 py-2">
                  <p className="text-xs font-medium text-emerald-200/80">
                    AI-generated by {artifact.provenance.generated_by_agent_name || "a Converge agent"}
                  </p>
                  {artifact.provenance.provider && (
                    <p className="mt-1 text-xs text-white/35">
                      {artifact.provenance.provider} · {artifact.provenance.model || "model not recorded"}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-white/35">
                    Context included {artifact.provenance.context_post_count ?? 0} posts and {artifact.provenance.context_artifact_ids?.length ?? 0} saved artifacts
                  </p>
                </div>
              )}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-white/55">{artifact.content}</p>
              {artifact.provenance?.source_url && (
                <a
                  href={artifact.provenance.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex max-w-full break-all text-sm text-emerald-300 hover:text-emerald-200"
                >
                  Source ↗
                </a>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
