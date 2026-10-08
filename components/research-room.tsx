"use client";

import { FormEvent, useEffect, useState } from "react";
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
  researchAnalystParticipating,
}: {
  topicId: string;
  participantId: string;
  researchAnalystParticipating: boolean;
}) {
  const supabase = createClient();
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ArtifactType>("SYNTHESIS");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [reviewingArtifactId, setReviewingArtifactId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  async function loadArtifacts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("research_artifacts")
      .select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, review_status, reviewed_by, reviewed_at, review_note, created_at")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(
        error.code === "42P01"
          ? "Research storage is not provisioned yet. Apply the Converge research_artifacts migration."
          : error.message,
      );
      setArtifacts([]);
    } else {
      setArtifacts((data ?? []) as ResearchArtifact[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadArtifacts();
  }, [topicId]);

  async function handleGenerateSynthesis() {
    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch(`/api/topics/${topicId}/agents/research-analyst/artifacts/synthesis`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) { setMessage(payload.error || "Could not generate a synthesis."); return; }
      setArtifacts((current) => [payload.artifact as ResearchArtifact, ...current]);
      setMessage(
        payload.executionLogged === false
          ? "Synthesis saved, but execution history could not be recorded. Apply the agent_executions migration."
          : `Research Analyst synthesis saved using ${payload.provider} with ${payload.contextArtifactCount ?? 0} existing research artifacts in context.`,
      );
    } catch {
      setMessage("The research synthesis runtime could not be reached.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement) {
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

    if (error || !data) {
      setMessage(
        error?.code === "42P01"
          ? "Research storage is not provisioned yet. Apply the Converge research_artifacts migration."
          : error?.message || "Could not save the artifact.",
      );
      setSaving(false);
      return;
    }

    setArtifacts((current) => [data as ResearchArtifact, ...current]);
    setTitle("");
    setContent("");
    setSourceUrl("");
    setType("SYNTHESIS");
    setShowForm(false);
    setSaving(false);
  }

  return (
    <section className="mt-12 rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.02] p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Research room</p>
          <h2 className="mt-2 text-2xl font-semibold">Evidence & provenance</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Preserve important claims, evidence, sources, syntheses, and decisions separately from the conversation stream.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleGenerateSynthesis()}
            disabled={generating || !researchAnalystParticipating}
            className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.05] px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50"
          >
            {generating ? "Generating…" : researchAnalystParticipating ? "Generate synthesis" : "Add Research Analyst first"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((value) => !value)}
            className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-[#07110f] hover:bg-emerald-200"
          >
            {showForm ? "Close" : "Add artifact"}
          </button>
        </div>
        {!researchAnalystParticipating && (
          <p className="mt-3 text-xs leading-5 text-white/35">
            Add the Research Analyst from the conversation section below before generating an AI synthesis.
          </p>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-black/10 p-5">
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

          {message && <p className="text-sm text-red-200">{message}</p>}

          <button
            disabled={saving}
            className="w-fit rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#07110f] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save research artifact"}
          </button>
        </form>
      )}

      {message && !showForm && (
        <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-sm text-amber-100/80">
          {message}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-white/35">Loading research record…</p>
      ) : artifacts.length === 0 && !message ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-7 text-center">
          <p className="text-sm text-white/40">No research artifacts have been preserved yet.</p>
          <p className="mt-2 text-xs text-white/25">Start with a claim, source, or synthesis from the current discussion.</p>
        </div>
      ) : artifacts.length > 0 ? (
        <div className="mt-6 space-y-3">
          {artifacts.map((artifact) => (
            <article key={artifact.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-200">
                  {artifact.artifact_type}
                </span>
                <span className="text-xs text-white/30">{formatDate(artifact.created_at)}</span>
                <span className={artifact.review_status === "APPROVED"
                  ? "rounded-full bg-emerald-300/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200"
                  : artifact.review_status === "REJECTED"
                    ? "rounded-full bg-red-300/10 px-2.5 py-1 text-[11px] font-medium text-red-200"
                    : "rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-200"}>
                  {artifact.review_status === "APPROVED" ? "Approved" : artifact.review_status === "REJECTED" ? "Needs revision" : "Awaiting review"}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{artifact.title}</h3>
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
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/55">{artifact.content}</p>
              {artifact.review_note && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
                  <p className="text-xs font-medium text-white/55">Review note</p>
                  <p className="mt-1 text-xs leading-5 text-white/40">{artifact.review_note}</p>
                </div>
              )}
              {artifact.review_status !== "APPROVED" && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {reviewingArtifactId === artifact.id ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        maxLength={2000}
                        placeholder="Optional review note"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none focus:border-emerald-300/50"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={reviewingArtifactId !== null}
                          onClick={() => void handleReview(artifact.id, "APPROVED")}
                          className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-[#07110f] disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={reviewingArtifactId !== null}
                          onClick={() => void handleReview(artifact.id, "REJECTED")}
                          className="rounded-lg border border-red-300/20 px-3 py-2 text-xs font-medium text-red-200 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setReviewingArtifactId(artifact.id); setReviewNote(artifact.review_note || ""); }}
                      className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      Review artifact →
                    </button>
                  )}
                </div>
              )}
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
