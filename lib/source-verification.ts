import type { EvidenceEdge, ResearchArtifact } from "./research-outcome";

export type SourceVerdict = "ORIGIN_CHECKED" | "QUESTIONABLE" | "UNREACHABLE";
export type SourceVerification = {
  id: string; topic_id: string; source_artifact_id: string; edge_id: string | null;
  reviewer_id: string | null; verdict: SourceVerdict; rationale: string;
  publisher: string; publication_date: string; original_url: string; original_excerpt: string;
  quote_match: boolean | null; created_at: string;
  snapshot: { title: string; updated_at: string | null; saved_url: string | null; passage: string | null; locator: string | null };
};

export function sourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}
export function quoteMatches(passage: string, excerpt: string): boolean {
  const normalize = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
  const quote = normalize(passage);
  return quote.length >= 16 && normalize(excerpt).includes(quote);
}
export function verificationIsCurrent(event: SourceVerification, source: ResearchArtifact, edges: readonly EvidenceEdge[]): boolean {
  if (event.topic_id !== source.topic_id || event.source_artifact_id !== source.id ||
      event.snapshot.title !== source.title || event.snapshot.updated_at !== (source.updated_at ?? null) ||
      event.snapshot.saved_url !== sourceUrl(source.provenance?.source_url)) return false;
  if (!event.edge_id) return true;
  const edge = edges.find(e => e.id === event.edge_id && e.topic_id === source.topic_id && e.evidence_artifact_id === source.id);
  return !!edge && edge.passage === event.snapshot.passage && edge.locator === event.snapshot.locator;
}
export function duplicateSources(source: ResearchArtifact, artifacts: readonly ResearchArtifact[]) {
  const url = sourceUrl(source.provenance?.source_url);
  return url ? artifacts.filter(a => a.id !== source.id && a.topic_id === source.topic_id &&
    ["SOURCE", "EVIDENCE"].includes(a.artifact_type) && sourceUrl(a.provenance?.source_url) === url) : [];
}
export function verificationAppendix(topicId: string, artifacts: readonly ResearchArtifact[], edges: readonly EvidenceEdge[], events: readonly SourceVerification[], unavailable: boolean): string {
  const lines = ["", "## Source verification register", "", "Human attestations only. Passage matching uses reviewer-supplied text, not an independently retrieved publication. A match does not establish truth.", ""];
  if (unavailable) lines.push("Verification history could not be loaded; do not infer that sources have been checked.", "");
  for (const a of artifacts.filter(a => a.topic_id === topicId && ["SOURCE", "EVIDENCE"].includes(a.artifact_type))) {
    lines.push("### " + a.title.replace(/[\r\n]/g, " "), "");
    const records = events.filter(e => e.topic_id === topicId && e.source_artifact_id === a.id);
    if (!records.length) lines.push("- No recorded source assessment.", "");
    if (duplicateSources(a, artifacts).length) lines.push("- Potential duplicate source URL; not independent corroboration.", "");
    for (const e of records) {
      lines.push("- " + e.verdict + " — " + (verificationIsCurrent(e, a, edges) ? "current snapshot" : "historical snapshot") + " — " + e.created_at,
        "  - Reviewer: " + (e.reviewer_id ?? "deleted account"),
        "  - Original reference: " + e.original_url,
        "  - Publisher/date: " + e.publisher + " / " + (e.publication_date || "not recorded"),
        "  - Rationale: " + e.rationale,
        ...(e.edge_id ? ["  - Evidence relationship: " + e.edge_id, "  - Quote: " + e.snapshot.passage, "  - Locator: " + (e.snapshot.locator || "not recorded"), "  - Match against submitted excerpt: " + (e.quote_match === null ? "not checked" : e.quote_match ? "matched" : "not matched"), "  - Submitted excerpt: " + e.original_excerpt] : []), "");
    }
  }
  return lines.join("\n");
}
