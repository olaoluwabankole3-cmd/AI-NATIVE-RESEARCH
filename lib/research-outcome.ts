/**
 * Converge research-record lineage and export.
 *
 * Explicit "linked_artifact_ids" record human-authored connections.
 * Existing agent "context_artifact_ids" mean material presented to a model;
 * they MUST NOT be presented as verified citations or supporting evidence.
 * This module deliberately makes no claims about source truthfulness.
 */
export type ResearchArtifactType = "CLAIM" | "EVIDENCE" | "SOURCE" | "SYNTHESIS" | "DECISION";

export type ResearchProvenance = {
  source_url?: string;
  note?: string;
  generated?: boolean;
  generated_by_agent_name?: string;
  provider?: string;
  model?: string;
  context_artifact_ids?: string[];
  context_post_count?: number;
  linked_artifact_ids?: string[];
};

export type ResearchArtifact = {
  id: string;
  topic_id: string;
  created_by_participant_id: string | null;
  artifact_type: ResearchArtifactType;
  title: string;
  content: string;
  provenance: ResearchProvenance;
  created_at: string;
  updated_at?: string;
};

export type EvidenceRelation = "SUPPORTS" | "CONTRADICTS" | "CONTEXT";
export type ReviewVerdict = "SUPPORTED" | "DISPUTED" | "INCONCLUSIVE" | "REQUIRES_REVISION";

export type EvidenceEdge = {
  id: string;
  topic_id: string;
  claim_artifact_id: string;
  evidence_artifact_id: string;
  relation: EvidenceRelation;
  passage: string;
  locator: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type ReviewSnapshot = {
  snapshot_version: number;
  claim: { title: string; content: string; updated_at: string };
  edges: Array<{
    id: string;
    evidence_id: string;
    relation: EvidenceRelation;
    passage: string;
    locator: string;
    source_title: string;
    source_updated_at: string | null;
  }>;
};

export type ReviewEvent = {
  id: string;
  topic_id: string;
  claim_artifact_id: string;
  reviewer_id: string | null;
  verdict: ReviewVerdict;
  rationale: string;
  snapshot: ReviewSnapshot;
  created_at: string;
};

export function reviewSnapshotIsCurrent(
  review: ReviewEvent,
  artifacts: readonly ResearchArtifact[],
  edges: readonly EvidenceEdge[],
): boolean {
  const claim = artifacts.find((a) => a.topic_id === review.topic_id && a.id === review.claim_artifact_id);
  if (!claim || !review.snapshot?.claim || !Array.isArray(review.snapshot?.edges)) return false;
  const state = review.snapshot.claim;
  if (claim.title !== state.title || claim.content !== state.content || (claim.updated_at ?? "") !== state.updated_at) return false;
  const activeEdges = edges.filter((e) => e.topic_id === review.topic_id && e.claim_artifact_id === review.claim_artifact_id);
  if (activeEdges.length !== review.snapshot.edges.length) return false;
  const index = new Map(activeEdges.map((e) => [e.id, e]));
  return review.snapshot.edges.every((captured) => {
    const live = index.get(captured.id);
    const source = artifacts.find((a) => a.topic_id === review.topic_id && a.id === captured.evidence_id);
    return Boolean(live && source && live.relation === captured.relation &&
      live.passage === captured.passage && live.locator === captured.locator &&
      source.title === captured.source_title &&
      (source.updated_at ?? null) === captured.source_updated_at);
  });
}

export function buildEvidenceReviewAppendix(input: {
  topicId: string;
  artifacts: readonly ResearchArtifact[];
  edges: readonly EvidenceEdge[];
  reviews: readonly ReviewEvent[];
  origin: string;
}): string {
  const { topicId, origin } = input;
  const artifacts = input.artifacts.filter((a) => a.topic_id === topicId);
  const edges = input.edges.filter((e) => e.topic_id === topicId);
  const reviews = input.reviews.filter((r) => r.topic_id === topicId);
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const root = new URL("/topics/" + encodeURIComponent(topicId), origin).href;
  const out: string[] = [
    "## Passage-level evidence and independent peer reviews",
    "",
    "> Evidence relationships reflect researcher assertions, not automatic fact checking.",
    "> Reviewer verdicts are human opinions tied to a recorded snapshot, not formal certification.",
    "",
  ];
  const claims = artifacts.filter((a) => a.artifact_type === "CLAIM");
  if (!claims.length) out.push("_No claims have been recorded._", "");
  for (const claim of claims) {
    out.push("### Claim: " + claim.title.replace(/[\r\n]+/g, " "), "");
    const linked = edges.filter((e) => e.claim_artifact_id === claim.id);
    if (!linked.length) out.push("- No passage-level supporting or contradicting evidence recorded.", "");
    for (const edge of linked) {
      const source = byId.get(edge.evidence_artifact_id);
      if (!source) continue;
      out.push(
        "- **" + edge.relation + "** — [" + source.artifact_type + ": " +
          source.title.replace(/[\r\n]+/g, " ").replace(/[\[\]]/g, "") +
          "](" + root + "#research-artifact-" + encodeURIComponent(source.id) + ")",
        "  - Quoted passage (from a saved record, not independently verified): “" + edge.passage + "”",
        ...(edge.locator ? ["  - Locator: " + edge.locator] : []),
        ...(edge.note ? ["  - Researcher's note: " + edge.note] : []),
        "",
      );
    }
    const recorded = reviews.filter((r) => r.claim_artifact_id === claim.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!recorded.length) out.push("- No independent human review has been recorded.", "");
    for (const review of recorded) {
      out.push(
        "- **Peer review: " + review.verdict.replaceAll("_", " ") + "**" +
          " (" + review.created_at + "; " +
          (reviewSnapshotIsCurrent(review, artifacts, edges) ? "current snapshot" : "snapshot now superseded") + ")",
        "  - Reviewer account: " + (review.reviewer_id || "deleted account"),
        "  - Rationale: " + review.rationale,
        "",
      );
    }
  }
  return out.join("\n");
}

const linkLimit = 20;
const urlProtocols = new Set(["https:", "http:"]);

export function validResearchSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!urlProtocols.has(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveResearchLinks(
  subject: ResearchArtifact,
  all: readonly ResearchArtifact[],
): ResearchArtifact[] {
  const linked = subject.provenance?.linked_artifact_ids;
  if (!Array.isArray(linked)) return [];
  const byId = new Map(all.filter((a) => a.topic_id === subject.topic_id && a.id !== subject.id)
    .map((a) => [a.id, a]));
  const seen = new Set<string>();
  return linked.slice(0, linkLimit).flatMap((id) => {
    if (typeof id !== "string" || seen.has(id)) return [];
    seen.add(id);
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export function normalizeResearchLinks(
  candidateIds: readonly string[],
  subject: ResearchArtifact,
  all: readonly ResearchArtifact[],
): string[] {
  const available = new Set(all.filter((a) => a.topic_id === subject.topic_id && a.id !== subject.id)
    .map((a) => a.id));
  return Array.from(new Set(candidateIds.filter((id) => available.has(id)))).slice(0, linkLimit);
}

export function summarizeResearchRecord(artifacts: readonly ResearchArtifact[]) {
  const claims = artifacts.filter((a) => a.artifact_type === "CLAIM");
  const decisions = artifacts.filter((a) => a.artifact_type === "DECISION" && !a.provenance?.generated);
  const sources = artifacts.filter((a) => a.artifact_type === "SOURCE");
  const evidence = artifacts.filter((a) => a.artifact_type === "EVIDENCE");
  const syntheses = artifacts.filter((a) => a.artifact_type === "SYNTHESIS");
  const linkedClaims = claims.filter((claim) => resolveResearchLinks(claim, artifacts)
    .some((a) => a.artifact_type === "SOURCE" || a.artifact_type === "EVIDENCE"));
  const linkedDecisions = decisions.filter((decision) => resolveResearchLinks(decision, artifacts).length);
  return {
    claims: claims.length,
    evidence: evidence.length,
    sources: sources.length,
    syntheses: syntheses.length,
    decisions: decisions.length,
    linkedClaims: linkedClaims.length,
    unlinkedClaims: claims.length - linkedClaims.length,
    linkedDecisions: linkedDecisions.length,
    readyForHumanReview: claims.length > 0 && (sources.length + evidence.length) > 0,
  };
}

export function buildResearchOutcomeMarkdown(input: {
  topicId: string;
  title: string;
  question: string;
  artifacts: readonly ResearchArtifact[];
  origin: string;
  generatedAt?: Date;
  edges?: readonly EvidenceEdge[];
  reviews?: readonly ReviewEvent[];
}): string {
  const { topicId, title, question, origin } = input;
  const artifacts = input.artifacts.filter((a) => a.topic_id === topicId);
  const stats = summarizeResearchRecord(artifacts);
  const generatedAt = input.generatedAt ?? new Date();
  const root = new URL("/topics/" + encodeURIComponent(topicId), origin).href;
  const line = (v: string) => v.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
  const text = (v: string) => v.trim() || "Not recorded";
  const anchor = (a: ResearchArtifact) => root + "#research-artifact-" + encodeURIComponent(a.id);
  const reference = (a: ResearchArtifact) =>
    "- [" + line(a.artifact_type + ": " + a.title).replace(/[[\]]/g, "") + "](" + anchor(a) + ")";
  const describe = (a: ResearchArtifact) => {
    const supporting = resolveResearchLinks(a, artifacts);
    const provider = a.provenance?.generated
      ? "AI-assisted (" + line(a.provenance.generated_by_agent_name || "unnamed agent") + "; " +
        line(a.provenance.provider || "provider not recorded") + "; " +
        line(a.provenance.model || "model not recorded") + ")"
      : "Human-authored or recorded material";
    const source = validResearchSourceUrl(a.provenance?.source_url);
    return [
      "### " + line(a.title),
      "",
      "- Artifact: " + a.id,
      "- Origin: " + provider,
      "- Recorded: " + a.created_at,
      "- [Open artifact in Converge](" + anchor(a) + ")",
      ...(source ? ["- External source (user-provided, not independently verified): " + source] : []),
      "",
      text(a.content),
      "",
      "**Explicitly linked material:**",
      ...(supporting.length ? supporting.map(reference) : ["- None recorded"]),
      ...(a.provenance?.generated ? [
        "",
        "_Agent context supplied to a model is not evidence validation or human endorsement._",
      ] : []),
      "",
    ].join("\n");
  };
  const byType = (type: ResearchArtifactType) => artifacts.filter((a) => a.artifact_type === type)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const describeGroup = (type: ResearchArtifactType) => {
    const items = byType(type);
    return items.length ? items.map(describe).join("\n") : "_None recorded._\n";
  };
  const gaps = [
    ...(stats.claims === 0 ? ["- No claims have been recorded."] : []),
    ...(stats.unlinkedClaims > 0
      ? ["- " + stats.unlinkedClaims + " claim(s) have no explicitly linked source or evidence artifact."]
      : []),
    ...(stats.decisions === 0 ? ["- No human-authored decision is recorded."] : []),
    ...(stats.decisions > stats.linkedDecisions
      ? ["- " + (stats.decisions - stats.linkedDecisions) + " decision(s) have no explicit artifact links."]
      : []),
  ];
  if (!gaps.length) gaps.push("- Links exist, but the accuracy and completeness of the underlying evidence have not been independently verified.");
  return [
    "# Converge research outcome — " + line(title),
    "",
    "**Record status:** " + (stats.decisions ? "Contains human-authored decisions; NOT independently verified" : "Working draft; no human decision recorded"),
    "**Generated (UTC):** " + generatedAt.toISOString(),
    "**Topic:** [" + line(title).replace(/[[\]]/g, "") + "](" + root + ")",
    "",
    "> This export reflects currently accessible saved artifacts. It does not certify source accuracy,",
    "> verify AI claims, imply unanimous agreement, or constitute peer review.",
    "",
    "## Research question",
    text(question),
    "",
    "## Record summary",
    "- Claims: " + stats.claims,
    "- Claims explicitly linked to source or evidence artifacts: " + stats.linkedClaims + "/" + stats.claims,
    "- Sources: " + stats.sources,
    "- Evidence: " + stats.evidence,
    "- AI/human syntheses: " + stats.syntheses,
    "- Human-authored decisions: " + stats.decisions,
    "",
    "## Claims and their recorded connections",
    describeGroup("CLAIM"),
    "",
    "## Evidence",
    describeGroup("EVIDENCE"),
    "",
    "## Sources",
    describeGroup("SOURCE"),
    "",
    "## Syntheses and AI contributions",
    describeGroup("SYNTHESIS"),
    "",
    "## Human decisions and next actions",
    byType("DECISION").filter((a) => !a.provenance?.generated).length
      ? byType("DECISION").filter((a) => !a.provenance?.generated).map(describe).join("\n")
      : "_No human-authored decision recorded._\n",
    "",
    "## Open evidence gaps and limitations",
    ...gaps,
    "",
    "## Traceability and scope",
    "Links connect saved items within this research topic. An explicit link records a",
    "researcher's association between items, **not verification that the relationship is true**.",
    "AI context metadata is shown separately from explicit research links.",
    "Access to the linked Converge artifacts remains subject to community permissions.",
    "",
    buildEvidenceReviewAppendix({
      topicId, artifacts, edges: input.edges ?? [], reviews: input.reviews ?? [], origin,
    }),
    "",
  ].join("\n");
}
