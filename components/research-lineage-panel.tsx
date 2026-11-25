"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildResearchOutcomeMarkdown,
  normalizeResearchLinks,
  resolveResearchLinks,
  summarizeResearchRecord,
  type EvidenceEdge,
  type ReviewEvent,
  type ResearchArtifact,
} from "@/lib/research-outcome";

type Props = {
  topicId: string;
  topicTitle: string;
  topicQuestion: string;
  participantId: string;
  artifacts: ResearchArtifact[];
  evidenceEdges: EvidenceEdge[];
  reviewEvents: ReviewEvent[];
  onArtifactUpdated: (artifact: ResearchArtifact) => void;
  onCreateDecision: () => void;
};

export function ResearchLineagePanel({
  topicId, topicTitle, topicQuestion, participantId, artifacts, evidenceEdges, reviewEvents,
  onArtifactUpdated, onCreateDecision,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcomePreview, setOutcomePreview] = useState("");
  const stats = useMemo(() => summarizeResearchRecord(artifacts), [artifacts]);
  const editable = artifacts.filter((a) =>
    (a.artifact_type === "CLAIM" || a.artifact_type === "DECISION" || a.artifact_type === "SYNTHESIS") &&
    !a.provenance?.generated);
  const activeArtifact = artifacts.find((a) => a.id === editingId);
  const candidates = artifacts.filter((a) => a.topic_id === topicId && a.id !== editingId);
  function toggleOutcomePreview() {
    if (showOutcome) {
      setShowOutcome(false);
      return;
    }
    setOutcomePreview(buildResearchOutcomeMarkdown({
      topicId, title: topicTitle, question: topicQuestion, artifacts, edges: evidenceEdges, reviews: reviewEvents,
      origin: window.location.origin, generatedAt: new Date(),
    }));
    setShowOutcome(true);
  }

  function startEditing(artifact: ResearchArtifact) {
    setEditingId(artifact.id);
    setSelectedIds(resolveResearchLinks(artifact, artifacts).map((item) => item.id));
    setMessage("");
  }

  function toggleLink(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 20 ? [...current, id] : current);
  }

  async function saveLinks() {
    if (!activeArtifact || saving) return;
    if (activeArtifact.created_by_participant_id !== participantId || activeArtifact.provenance?.generated) {
      setMessage("Only the original human author can edit this item's explicit links.");
      return;
    }
    const linked = normalizeResearchLinks(selectedIds, activeArtifact, artifacts);
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.from("research_artifacts")
        .update({
          provenance: { ...activeArtifact.provenance, linked_artifact_ids: linked },
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeArtifact.id)
        .eq("topic_id", topicId)
        .eq("created_by_participant_id", participantId)
        .eq("updated_at", activeArtifact.updated_at ?? activeArtifact.created_at)
        .select("id, topic_id, created_by_participant_id, artifact_type, title, content, provenance, created_at, updated_at")
        .single();
      if (error || !data) throw new Error("Could not save these links. The record may have changed; reload and retry.");
      onArtifactUpdated(data as ResearchArtifact);
      setEditingId(null);
      setSelectedIds([]);
      setMessage("Linked material saved. Links record associations, not independent source verification.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save links.");
    } finally {
      setSaving(false);
    }
  }

  async function copyOutcome() {
    try {
      const report = buildResearchOutcomeMarkdown({
        topicId, title: topicTitle, question: topicQuestion, artifacts, edges: evidenceEdges, reviews: reviewEvents,
        origin: window.location.origin, generatedAt: new Date(),
      });
      await navigator.clipboard.writeText(report);
      setMessage("Current research outcome copied. This is a draft, not a verified report.");
    } catch {
      setMessage("Copying was blocked by the browser. Use Download Markdown instead.");
    }
  }

  function downloadOutcome() {
    const report = buildResearchOutcomeMarkdown({
      topicId, title: topicTitle, question: topicQuestion, artifacts, edges: evidenceEdges, reviews: reviewEvents,
      origin: window.location.origin, generatedAt: new Date(),
    });
    const filename = (topicTitle.toLowerCase().normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "research") + "-outcome.md";
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setMessage("Downloaded a point-in-time research outcome. Verify the sources before sharing.");
  }

  return (
    <div className="converge-lineage mt-6 rounded-2xl border border-emerald-300/20 bg-[#12251b] p-4 sm:p-6" aria-labelledby="converge-lineage-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-emerald-300/80">RESEARCH INTELLIGENCE</p>
          <h3 id="converge-lineage-heading" className="mt-1 text-xl font-semibold text-white">Evidence connections & outcome</h3>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-white/55">
            Link claims and decisions to saved evidence or sources. AI context is recorded separately; links do not verify a source.
          </p>
        </div>
        <button type="button" onClick={onCreateDecision}
          className="min-h-10 rounded-xl border border-emerald-200/30 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-200/10">
          + Record a human decision
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Research record coverage">
        {[
          { number: stats.claims, label: "Claims" },
          { number: stats.linkedClaims + "/" + stats.claims, label: "Claims with linked evidence" },
          { number: stats.sources + stats.evidence, label: "Sources & evidence" },
          { number: stats.decisions, label: "Human decisions" },
        ].map((item) => <div key={item.label} className="rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="text-xl font-semibold text-emerald-100">{item.number}</div>
          <p className="mt-1 text-[11px] leading-4 text-white/50">{item.label}</p>
        </div>)}
      </div>

      {stats.unlinkedClaims > 0 && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[.035] px-3 py-2 text-xs text-amber-100/85">
        {stats.unlinkedClaims} claim(s) need an explicit link to a source or evidence item. A recorded link is not proof of validity.
      </p>}
      {!stats.decisions && <p className="mt-3 text-xs text-white/50">
        This record has no human decision yet. An AI synthesis alone does not approve a finding.
      </p>}

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Traceability links</h4>
          <span className="text-[11px] text-white/40">Only authors can revise their own saved links</span>
        </div>
        {editable.length ? <div className="mt-3 space-y-2">
          {editable.map((artifact) => {
            const links = resolveResearchLinks(artifact, artifacts);
            return <div key={artifact.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">{artifact.artifact_type}</p>
                <a href={"#research-artifact-" + artifact.id} className="mt-1 block truncate text-xs font-semibold text-white hover:text-emerald-200">{artifact.title}</a>
                <p className="mt-1 text-[11px] text-white/45">
                  {links.length ? links.map((item) => item.artifact_type + ": " + item.title).join(" · ") : "No explicitly linked material"}
                </p>
              </div>
              {artifact.created_by_participant_id === participantId && <button type="button"
                aria-expanded={editingId === artifact.id} onClick={() => editingId === artifact.id ? setEditingId(null) : startEditing(artifact)}
                className="min-h-9 flex-none rounded-lg border border-emerald-200/25 px-3 text-xs font-semibold text-emerald-200">
                {editingId === artifact.id ? "Cancel" : "Connect"}
              </button>}
            </div>;
          })}
        </div> : <p className="mt-3 text-xs text-white/50">Record a claim or human decision to connect it to other materials.</p>}
      </div>

      {activeArtifact && <div className="mt-4 rounded-xl border border-emerald-300/25 bg-[#162e20] p-4" aria-label="Connect supporting research materials">
        <h4 className="text-sm font-semibold text-white">Connect material to “{activeArtifact.title}”</h4>
        <p className="mt-2 text-xs text-white/55">Choose up to 20 saved items from this research topic. A link is a recorded association—not evidence verification.</p>
        <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
          {candidates.length ? candidates.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3 text-sm">
              <input type="checkbox" checked={selectedIds.includes(item.id)} disabled={saving}
                onChange={() => toggleLink(item.id)} className="mt-1 accent-emerald-300" />
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-emerald-200/70">{item.artifact_type}</span>
                <span className="mt-1 block break-words text-xs text-white/85">{item.title}</span>
              </span>
            </label>
          )) : <p className="text-xs text-white/50">Save another source, evidence item or claim first.</p>}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditingId(null)} disabled={saving} className="min-h-10 rounded-xl px-3 text-xs text-white/60">Cancel</button>
          <button type="button" onClick={() => void saveLinks()} disabled={saving}
            className="min-h-10 rounded-xl bg-emerald-300 px-4 text-xs font-semibold text-[#07110f] disabled:opacity-50">{saving ? "Saving…" : "Save links"}</button>
        </div>
      </div>}

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-white">Research outcome · Draft export</h4>
            <p className="mt-1 text-[11px] text-white/50">Includes claims, exact quoted evidence, independent review history, AI provenance, human decisions, gaps and traceable item links.</p>
          </div>
          <button type="button" onClick={toggleOutcomePreview}
            aria-expanded={showOutcome} aria-controls="converge-outcome-preview"
            className="min-h-10 rounded-xl border border-white/15 px-4 text-xs font-semibold text-white/80">
            {showOutcome ? "Hide preview" : "Preview report"}
          </button>
        </div>
        {showOutcome && <div id="converge-outcome-preview" className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/15 p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-6 text-white/65">
            {outcomePreview.slice(0, 11000)}
            {outcomePreview.length > 11000 ? "\n\n… Preview truncated. Download for the complete outcome." : ""}
          </pre>
          <p className="mt-3 text-[11px] text-white/40">This is a point-in-time preview. Close and reopen it to refresh changes; downloads use the current live record and timestamp.</p>
        </div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={downloadOutcome} disabled={!artifacts.length}
            className="min-h-11 rounded-xl bg-emerald-300 px-4 text-xs font-semibold text-[#0b1710] disabled:opacity-40">
            Download Markdown outcome
          </button>
          <button type="button" onClick={() => void copyOutcome()} disabled={!artifacts.length}
            className="min-h-11 rounded-xl border border-emerald-300/20 px-4 text-xs font-semibold text-emerald-200 disabled:opacity-40">
            Copy report
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-white/40">Exports are local snapshots of currently accessible research records. Nothing is published automatically.</p>
      </div>
      {message && <p className="mt-3 rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-100" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}
