"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SourceVerificationPanel } from "@/components/source-verification-panel";
import type { SourceVerification } from "@/lib/source-verification";
import { ResearchLineagePanel } from "@/components/research-lineage-panel";
import { ResearchEvidenceReviewPanel } from "@/components/research-evidence-review-panel";
import { resolveResearchLinks, validResearchSourceUrl, type EvidenceEdge, type ReviewEvent, type ResearchArtifact, type ResearchArtifactType } from "@/lib/research-outcome";

type ArtifactType = ResearchArtifactType;

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
  topicTitle,
  topicQuestion,
}: {
  topicId: string;
  participantId: string;
  topicTitle: string;
  topicQuestion: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [artifacts, setArtifacts] = useState<ResearchArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [workspaceStage, setWorkspaceStage] = useState<"materials" | "review" | "outcome">("materials");
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ArtifactType>("SYNTHESIS");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [artifactFilter, setArtifactFilter] = useState<"ALL" | ArtifactType>("ALL");
  const [artifactSearch, setArtifactSearch] = useState("");
  const filteredArtifacts = useMemo(() => {
    const query = artifactSearch.trim().toLowerCase();
    return artifacts.filter((artifact) =>
      (artifactFilter === "ALL" || artifact.artifact_type === artifactFilter) &&
      (!query || [artifact.title, artifact.content, artifact.provenance?.source_url || ""]
        .some((value) => value.toLowerCase().includes(query)))
    );
  }, [artifacts, artifactFilter, artifactSearch]);
  const [generating, setGenerating] = useState(false);
  const [reviewRecords, setReviewRecords] = useState<{ edges: EvidenceEdge[]; reviews: ReviewEvent[] }>({
    edges: [], reviews: [],
  });
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState("");

  async function loadReviewRecords() {
    setReviewLoading(true);
    setReviewError("");
    try {
      const response = await fetch("/api/topics/" + encodeURIComponent(topicId) + "/evidence-review", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Could not load evidence review history.");
      if (!Array.isArray(payload?.edges) || !Array.isArray(payload?.reviews)) throw new Error("Research review response incomplete.");
      setReviewRecords({ edges: payload.edges as EvidenceEdge[], reviews: payload.reviews as ReviewEvent[] });
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : "Research review history could not be loaded.");
    } finally {
      setReviewLoading(false);
    }
  }

  const [verifications, setVerifications] = useState<SourceVerification[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationError, setVerificationError] = useState("");
  async function loadVerifications() {
    setVerificationLoading(true); setVerificationError("");
    try {
      const response = await fetch("/api/topics/" + encodeURIComponent(topicId) + "/source-verification", {cache:"no-store"});
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.verifications)) throw new Error(payload?.error || "Could not load verification history.");
      setVerifications(payload.verifications);
    } catch (cause) {
      setVerificationError(cause instanceof Error ? cause.message : "Could not load verification history.");
    } finally { setVerificationLoading(false); }
  }
  useEffect(() => { setVerifications([]); void loadReviewRecords(); void loadVerifications(); }, [topicId]);

  function recordHumanDecision() {
    setWorkspaceStage("materials");
    setType("DECISION");
    setShowForm(true);
    window.requestAnimationFrame(() => document.getElementById("converge-artifact-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function loadArtifacts() {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await supabase
        .from("research_artifacts")
        .select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, created_at, updated_at")
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

  // Deep links into a saved artifact always open the material record first.
  useEffect(() => {
    function openLinkedArtifact() {
      if (!window.location.hash.startsWith("#research-artifact-")) return;
      setWorkspaceStage("materials");
      window.requestAnimationFrame(() => {
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
      });
    }
    window.addEventListener("hashchange", openLinkedArtifact);
    openLinkedArtifact();
    return () => window.removeEventListener("hashchange", openLinkedArtifact);
  }, [artifacts.length]);

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

    const checkedSource = trimmedSourceUrl ? validResearchSourceUrl(trimmedSourceUrl) : null;
    if (trimmedSourceUrl && !checkedSource) {
      setMessage("Use an http:// or https:// URL without embedded credentials for source references.");
      return;
    }

    // Explicit links only: an AI's context_artifact_ids are never counted as citations.
    const validIds = new Set(artifacts.filter((item) => item.topic_id === topicId).map((item) => item.id));
    const linkedIds = Array.from(new Set(selectedLinkIds.filter((id) => validIds.has(id)))).slice(0, 20);
    setSaving(true);
    setMessage("");

    const provenance = {
      ...(checkedSource ? { source_url: checkedSource } : {}),
      ...(linkedIds.length ? { linked_artifact_ids: linkedIds } : {}),
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
        .select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, created_at, updated_at")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Could not confirm the save. Reload before trying again.");
      setArtifacts((current) => [data as ResearchArtifact, ...current]);
      setTitle("");
      setContent("");
      setSourceUrl("");
      setSelectedLinkIds([]);
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
          <h2 id="research-room-heading" className="mt-2 text-2xl font-semibold">Research evidence workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Organize research materials, examine supporting and conflicting evidence, then prepare a reviewable outcome.
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
            onClick={() => { setWorkspaceStage("materials"); setShowForm((value) => workspaceStage !== "materials" ? true : !value); }}
            aria-expanded={showForm && workspaceStage === "materials"}
            aria-controls="converge-artifact-form"
            className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-[#07110f] hover:bg-emerald-200"
          >
            {showForm && workspaceStage === "materials" ? "Close" : "Add artifact"}
          </button>
        </div>
      </div>


      <div className="converge-evidence-overview" aria-label="Research progress">
        <div><strong>{artifacts.filter((item) => item.artifact_type === "CLAIM").length}</strong><span>Claims</span></div>
        <div><strong>{artifacts.filter((item) => item.artifact_type === "SOURCE" || item.artifact_type === "EVIDENCE").length}</strong><span>Sources & evidence</span></div>
        <div><strong>{reviewRecords.edges.length}</strong><span>Evidence links</span></div>
        <div><strong>{reviewRecords.reviews.length}</strong><span>Peer reviews</span></div>
      </div>
      <nav className="converge-evidence-steps" role="tablist" aria-label="Evidence workflow steps">
        <button type="button" role="tab" id="evidence-materials-tab" aria-controls="evidence-materials-panel"
          aria-selected={workspaceStage === "materials"} onClick={() => setWorkspaceStage("materials")}>
          <span className="converge-evidence-step-number">01</span><span><strong>Research materials</strong><small>Claims, sources & notes</small></span>
        </button>
        <button type="button" role="tab" id="evidence-review-tab" aria-controls="evidence-review-panel"
          aria-selected={workspaceStage === "review"} onClick={() => setWorkspaceStage("review")}>
          <span className="converge-evidence-step-number">02</span><span><strong>Evidence review</strong><small>Compare & challenge</small></span>
        </button>
        <button type="button" role="tab" id="evidence-outcome-tab" aria-controls="evidence-outcome-panel"
          aria-selected={workspaceStage === "outcome"} onClick={() => setWorkspaceStage("outcome")}>
          <span className="converge-evidence-step-number">03</span><span><strong>Research outcome</strong><small>Decisions & export</small></span>
        </button>
      </nav>
      <div className="converge-evidence-stage" id="evidence-materials-panel" role="tabpanel" aria-labelledby="evidence-materials-tab" hidden={workspaceStage !== "materials"}>
        <div className="converge-evidence-stage-intro">
          <div><p className="converge-evidence-kicker">STEP 01 · COLLECT</p><h3>Research materials</h3>
            <p>Start with a claim. Add credible sources or evidence, and keep syntheses and decisions accessible in the same record.</p></div>
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

          {artifacts.length > 0 && (
            <fieldset className="rounded-xl border border-emerald-300/15 p-3">
              <legend className="px-2 text-xs font-semibold text-emerald-200">Explicitly link saved research material (optional)</legend>
              <p className="mb-3 text-xs leading-5 text-white/45">Link a claim to evidence or a decision to claims. Links record researcher associations; they do not prove the source is reliable.</p>
              <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                {artifacts.map((item) => (
                  <label key={item.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-white/10 p-2 text-xs">
                    <input type="checkbox" className="mt-0.5 accent-emerald-300"
                      checked={selectedLinkIds.includes(item.id)}
                      onChange={() => setSelectedLinkIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length < 20 ? [...current, item.id] : current)}
                    />
                    <span className="min-w-0 break-words text-white/65"><b className="text-emerald-200">{item.artifact_type}</b> · {item.title}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/40">{selectedLinkIds.length} of 20 links selected</p>
            </fieldset>
          )}

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

      {!loading && !loadError && artifacts.length > 0 && (
        <div className="converge-research-record-tools mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold text-white/70">
              Search the research record
              <input type="search" value={artifactSearch} onChange={(event) => setArtifactSearch(event.target.value)}
                placeholder="Search titles, notes or source links…"
                className="min-h-11 w-full rounded-xl border border-white/15 bg-[#14241b] px-3.5 text-sm font-normal text-white outline-none focus:border-emerald-200/50" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-white/70">
              Material type
              <select aria-label="Filter research artifacts by type" value={artifactFilter}
                onChange={(event) => setArtifactFilter(event.target.value as "ALL" | ArtifactType)}
                className="min-h-11 rounded-xl border border-white/15 bg-[#14241b] px-3.5 text-sm font-normal text-white outline-none focus:border-emerald-200/50">
                <option value="ALL">All materials</option>
                {artifactTypes.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45" role="status" aria-live="polite">
            <span>Showing {filteredArtifacts.length} of {artifacts.length} saved {artifacts.length === 1 ? "item" : "items"}</span>
            {(artifactFilter !== "ALL" || artifactSearch) && (
              <button type="button" onClick={() => { setArtifactFilter("ALL"); setArtifactSearch(""); }}
                className="min-h-9 rounded-lg px-3 font-semibold text-emerald-200 hover:bg-emerald-200/[.07]">
                Clear filters
              </button>
            )}
          </div>
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
      ) : filteredArtifacts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
          <h3 className="text-base font-semibold">No matching research material</h3>
          <p className="mt-2 text-sm text-white/45">Try another search or material type.</p>
          <button type="button" onClick={() => { setArtifactSearch(""); setArtifactFilter("ALL"); }}
            className="mt-4 min-h-11 rounded-xl border border-emerald-200/25 px-4 text-xs font-semibold text-emerald-200">
            Show all research
          </button>
        </div>
      ) : filteredArtifacts.length > 0 ? (
        <div className="mt-6 space-y-3">
          {filteredArtifacts.map((artifact) => (
            <article id={"research-artifact-" + artifact.id} key={artifact.id} className="min-w-0 scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
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
              {resolveResearchLinks(artifact, artifacts).length > 0 && (
                <div className="mt-3 rounded-xl border border-emerald-300/15 bg-black/10 p-3">
                  <p className="text-[11px] font-semibold text-emerald-200">Explicitly linked research material</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {resolveResearchLinks(artifact, artifacts).map((related) => (
                      <a key={related.id} href={"#research-artifact-" + related.id}
                        className="max-w-full truncate rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/75 hover:border-emerald-200/30 hover:text-emerald-200">
                        {related.artifact_type}: {related.title}
                      </a>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-white/35">Recorded association — not independent verification.</p>
                </div>
              )}
              {validResearchSourceUrl(artifact.provenance?.source_url) && (
                <a
                  href={validResearchSourceUrl(artifact.provenance?.source_url) ?? "#research-record"}
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
      </div>

      <div className="converge-evidence-stage" id="evidence-review-panel" role="tabpanel" aria-labelledby="evidence-review-tab" hidden={workspaceStage !== "review"}>
        <div className="converge-evidence-stage-intro">
          <div><p className="converge-evidence-kicker">STEP 02 · EXAMINE</p><h3>Evidence review</h3>
            <p>Connect exact supporting or contradicting passages to claims, then ask another researcher to record an independent assessment.</p></div>
        </div>
      {!loading && !loadError && (
        <SourceVerificationPanel key={topicId} topicId={topicId} participantId={participantId} artifacts={artifacts}
          edges={reviewRecords.edges} events={verifications} loading={verificationLoading || reviewLoading}
          error={verificationError || reviewError} onRefresh={async () => { await Promise.all([loadVerifications(),loadReviewRecords()]); }} />
      )}
      {!loading && !loadError && (
        <ResearchEvidenceReviewPanel
          topicId={topicId}
          participantId={participantId}
          artifacts={artifacts}
          edges={reviewRecords.edges}
          reviews={reviewRecords.reviews}
          loading={reviewLoading}
          error={reviewError}
          onRefresh={loadReviewRecords}
        />
      )}

      </div>

      <div className="converge-evidence-stage" id="evidence-outcome-panel" role="tabpanel" aria-labelledby="evidence-outcome-tab" hidden={workspaceStage !== "outcome"}>
        <div className="converge-evidence-stage-intro">
          <div><p className="converge-evidence-kicker">STEP 03 · CONCLUDE</p><h3>Research outcome</h3>
            <p>Connect conclusions to evidence, record human decisions and export an outcome that others can inspect.</p></div>
        </div>
      {!loading && !loadError && (
        <ResearchLineagePanel
          topicId={topicId}
          topicTitle={topicTitle}
          topicQuestion={topicQuestion}
          participantId={participantId}
          artifacts={artifacts}
          onArtifactUpdated={(updated) => setArtifacts((current) => current.map((item) => item.id === updated.id ? updated : item))}
          onCreateDecision={recordHumanDecision}
          evidenceEdges={reviewRecords.edges}
          reviewEvents={reviewRecords.reviews}
          sourceVerifications={verifications}
          verificationUnavailable={verificationLoading || Boolean(verificationError || reviewError)}
        />
      )}

      </div>
    </section>
  );
}
