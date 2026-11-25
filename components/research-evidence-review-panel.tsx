"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  reviewSnapshotIsCurrent,
  type EvidenceEdge,
  type EvidenceRelation,
  type ResearchArtifact,
  type ReviewEvent,
  type ReviewVerdict,
} from "@/lib/research-outcome";

type Props = {
  topicId: string;
  participantId: string;
  artifacts: ResearchArtifact[];
  edges: EvidenceEdge[];
  reviews: ReviewEvent[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
};

const relations: Array<{ id: EvidenceRelation; label: string }> = [
  { id: "SUPPORTS", label: "Supports this claim" },
  { id: "CONTRADICTS", label: "Contradicts this claim" },
  { id: "CONTEXT", label: "Provides context" },
];
const verdicts: Array<{ id: ReviewVerdict; label: string }> = [
  { id: "SUPPORTED", label: "Supported by recorded material" },
  { id: "DISPUTED", label: "Disputed" },
  { id: "INCONCLUSIVE", label: "Inconclusive" },
  { id: "REQUIRES_REVISION", label: "Needs revision" },
];
const inputStyle = "min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#0c1b13] px-3 py-2 text-sm text-white outline-none focus:border-emerald-200/60";
const actionStyle = "min-h-11 rounded-xl bg-emerald-300 px-4 text-xs font-semibold text-[#0b1710] disabled:cursor-not-allowed disabled:opacity-45";

export function ResearchEvidenceReviewPanel({ topicId, participantId, artifacts, edges, reviews, loading, error, onRefresh }: Props) {
  const claims = useMemo(() => artifacts.filter((a) => a.artifact_type === "CLAIM"), [artifacts]);
  const sources = useMemo(() => artifacts.filter((a) => a.artifact_type === "SOURCE" || a.artifact_type === "EVIDENCE"), [artifacts]);
  const [claimId, setClaimId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [relation, setRelation] = useState<EvidenceRelation>("SUPPORTS");
  const [passage, setPassage] = useState("");
  const [locator, setLocator] = useState("");
  const [note, setNote] = useState("");
  const [verdict, setVerdict] = useState<ReviewVerdict>("INCONCLUSIVE");
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState<"edge" | "review" | null>(null);
  const [message, setMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (claims.length && !claims.some((claim) => claim.id === claimId)) setClaimId(claims[0].id);
  }, [claims, claimId]);
  useEffect(() => {
    if (sources.length && !sources.some((source) => source.id === sourceId)) setSourceId(sources[0].id);
  }, [sources, sourceId]);

  const claim = claims.find((item) => item.id === claimId);
  const source = sources.find((item) => item.id === sourceId);
  const claimEdges = edges.filter((edge) => edge.claim_artifact_id === claimId);
  const claimReviews = reviews.filter((review) => review.claim_artifact_id === claimId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const authorIsReviewer = Boolean(claim && claim.created_by_participant_id === participantId);
  const claimCountWithQuotedEvidence = claims.filter((item) =>
    edges.some((edge) => edge.claim_artifact_id === item.id && edge.relation === "SUPPORTS")).length;

  async function submit(action: "edge" | "review", payload: Record<string, unknown>) {
    setSaving(action);
    setMessage("");
    try {
      const response = await fetch("/api/topics/" + encodeURIComponent(topicId) + "/evidence-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, claimId, ...payload }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "The review action could not be completed.");
      await onRefresh();
      if (action === "edge") {
        setPassage("");
        setNote("");
        setLocator("");
        setMessage("Quoted evidence relationship saved. It is not independently verified.");
      } else {
        setRationale("");
        setMessage("Independent review recorded against a snapshot of this claim and its evidence.");
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to record evidence review.");
    } finally {
      setSaving(null);
    }
  }

  function addEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claimId || !sourceId || !passage.trim()) return;
    void submit("edge", { evidenceId: sourceId, relation, passage: passage.trim(), locator: locator.trim(), note: note.trim() });
  }
  function addReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claimId || authorIsReviewer || rationale.trim().length < 40) return;
    void submit("review", { verdict, rationale: rationale.trim() });
  }

  return (
    <section className="mt-5 rounded-2xl border border-emerald-300/20 bg-[#12241a] p-4 sm:p-6"
      aria-labelledby="converge-evidence-review-heading">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-emerald-200/75">EVIDENCE REVIEW ENGINE</p>
        <h3 id="converge-evidence-review-heading" className="mt-1 text-xl font-semibold">Review the reasoning, not just the answer</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
          Record exact quoted passages supporting or challenging a claim, then request an independent human assessment.
          A copied passage is only verified against the saved Converge material, not its original external publication.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
        <span className="rounded-lg border border-white/10 px-3 py-2">{claimCountWithQuotedEvidence}/{claims.length} claims have quoted support</span>
        <span className="rounded-lg border border-white/10 px-3 py-2">{edges.length} evidence relationship(s)</span>
        <span className="rounded-lg border border-white/10 px-3 py-2">{reviews.length} peer review event(s)</span>
        <button type="button" onClick={() => void onRefresh()} disabled={loading || Boolean(saving)}
          className="min-h-9 rounded-lg border border-white/15 px-3 font-semibold text-emerald-200 disabled:opacity-50">
          Refresh record
        </button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/[.04] p-3 text-xs text-amber-100">
        {error} The existing research record is still available.
      </p>}
      {loading && <p role="status" className="mt-3 text-xs text-white/50">Loading evidence review history…</p>}
      {!loading && !error && claims.length === 0 &&
        <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/55">Save a CLAIM in this research room to begin the review.</p>}

      {claims.length > 0 && (
        <>
          <label className="mt-5 block text-xs font-semibold text-white/80">
            Claim under investigation
            <select value={claimId} onChange={(event) => { setClaimId(event.target.value); setMessage(""); }}
              className={inputStyle + " mt-2"}>
              {claims.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
            </select>
          </label>
          {claim && <p className="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-6 text-white/70">{claim.content}</p>}

          <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
            <form onSubmit={addEvidence} className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-black/10 p-4">
              <h4 className="text-sm font-semibold">1. Record a supporting or contradicting passage</h4>
              <p className="text-xs leading-5 text-white/50">Choose an existing Source or Evidence artifact. Quote a passage that already appears in its saved text.</p>
              {sources.length ? <>
                <label className="block text-xs text-white/70">
                  Saved evidence material
                  <select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setPassage(""); }}
                    className={inputStyle + " mt-1.5"}>
                    {sources.map((item) => <option key={item.id} value={item.id}>{item.artifact_type}: {item.title}</option>)}
                  </select>
                </label>
                {source && <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-[#091810] p-3">
                  <p className="text-[11px] font-semibold text-emerald-200">Saved material (select and copy an exact passage)</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-white/65">{source.content}</p>
                  <a href={"#research-artifact-" + source.id} className="mt-3 inline-block text-xs text-emerald-200 hover:underline">Inspect the saved source</a>
                </div>}
                <label className="block text-xs text-white/70">
                  Relationship
                  <select value={relation} onChange={(event) => setRelation(event.target.value as EvidenceRelation)}
                    className={inputStyle + " mt-1.5"}>
                    {relations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-white/70">
                  Exact quoted passage (16–1600 characters)
                  <textarea required minLength={16} maxLength={1600} rows={3} value={passage}
                    onChange={(event) => setPassage(event.target.value)}
                    className={inputStyle + " mt-1.5 resize-y"} placeholder="Paste an exact quote from the saved material…" />
                </label>
                <label className="block text-xs text-white/70">
                  Passage locator (optional)
                  <input maxLength={160} value={locator} onChange={(event) => setLocator(event.target.value)}
                    className={inputStyle + " mt-1.5"} placeholder="Page 12, paragraph 3, table 2…" />
                </label>
                <label className="block text-xs text-white/70">
                  Reason this passage matters (optional)
                  <textarea maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)}
                    className={inputStyle + " mt-1.5 resize-y"} placeholder="Explain why it supports, contradicts or qualifies the claim." />
                </label>
                <button type="submit" disabled={Boolean(saving) || loading || Boolean(error) || !claimId || passage.trim().length < 16}
                  className={actionStyle}>{saving === "edge" ? "Saving relationship…" : "Save quoted relationship"}</button>
              </> : <p className="text-xs text-amber-100">Add a SOURCE or EVIDENCE artifact above before linking passages.</p>}
            </form>

            <form onSubmit={addReview} className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-black/10 p-4">
              <h4 className="text-sm font-semibold">2. Independent human assessment</h4>
              <p className="text-xs leading-5 text-white/50">
                A different research participant must assess the claim. Reviews are appended to the history, never used to edit the author's material.
              </p>
              {authorIsReviewer && <p className="rounded-lg border border-amber-200/20 p-3 text-xs text-amber-100">
                You authored this claim. Ask another participant to record the independent review.
              </p>}
              <label className="block text-xs text-white/70">
                Review verdict
                <select value={verdict} onChange={(event) => setVerdict(event.target.value as ReviewVerdict)}
                  className={inputStyle + " mt-1.5"}>
                  {verdicts.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="block text-xs text-white/70">
                Explain the assessment (40–3000 characters)
                <textarea required minLength={40} maxLength={3000} rows={5} value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  className={inputStyle + " mt-1.5 resize-y"}
                  placeholder="Which evidence supports or contradicts this claim? What limitations remain?…" />
              </label>
              <p className="text-xs leading-5 text-white/45">
                A supported verdict requires an explicitly linked supporting passage. It is a reviewer judgment, not an automated validation or formal peer review certification.
              </p>
              <button type="submit" disabled={Boolean(saving) || loading || Boolean(error) || authorIsReviewer || rationale.trim().length < 40}
                className={actionStyle}>{saving === "review" ? "Recording review…" : "Record independent review"}</button>
            </form>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4">
            <h4 className="text-sm font-semibold">3. Evidence and peer-review history</h4>
            <p className="mt-1 text-xs text-white/45">Each relationship is a recorded association. Reviews remain attributed to their snapshot even after a claim changes.</p>
            {claimEdges.length ? <div className="mt-3 space-y-2">
              {claimEdges.map((edge) => {
                const item = artifacts.find((a) => a.id === edge.evidence_artifact_id);
                return <div key={edge.id} className="rounded-lg border border-white/10 p-3">
                  <p className="text-xs font-semibold text-emerald-200">{edge.relation} · {item?.title ?? "Former source"}</p>
                  <blockquote className="mt-2 border-l-2 border-emerald-300/35 pl-3 text-xs leading-5 text-white/75">“{edge.passage}”</blockquote>
                  {edge.locator && <p className="mt-2 text-[11px] text-white/45">Locator: {edge.locator}</p>}
                  {edge.note && <p className="mt-1 text-xs text-white/60">{edge.note}</p>}
                  <p className="mt-1 text-[11px] text-white/40">{new Date(edge.created_at).toLocaleString()}</p>
                </div>;
              })}
            </div> : <p className="mt-3 text-xs text-white/50">No quoted evidence is connected to this claim yet.</p>}
            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-white/80">{claimReviews.length} review event(s)</p>
              <button type="button" onClick={() => setShowHistory((value) => !value)}
                aria-expanded={showHistory} className="min-h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-emerald-200">
                {showHistory ? "Hide reviews" : "Show reviews"}
              </button>
            </div>
            {showHistory && <div className="mt-3 space-y-2">
              {claimReviews.length ? claimReviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-200">{review.verdict.replaceAll("_", " ")}</span>
                    <span className="text-[11px] text-white/45">{new Date(review.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-white/45">
                    {reviewSnapshotIsCurrent(review, artifacts, edges) ? "Review matches currently saved claim and evidence snapshot" : "Historical review — related claim or evidence has changed"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/75">{review.rationale}</p>
                  <p className="mt-2 text-[11px] text-white/40">Reviewer account: {review.reviewer_id ?? "deleted account"}</p>
                </article>
              )) : <p className="text-xs text-white/50">No independent review events yet.</p>}
            </div>}
          </div>
        </>
      )}
      {message && <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-emerald-300/15 px-3 py-2 text-xs text-emerald-100">{message}</p>}
    </section>
  );
}
