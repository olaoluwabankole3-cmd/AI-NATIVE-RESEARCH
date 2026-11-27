import type { EvidenceEdge, ResearchArtifact, ReviewEvent } from "./research-outcome";
import type { SourceVerification } from "./source-verification";

export type GraphRelation = "SUPPORTS" | "CONTRADICTS" | "CONTEXT" | "ASSOCIATION" | "REVIEW" | "DECISION" | "SYNTHESIS";
export type GraphNode = { id: string; relation: GraphRelation; title: string; artifact?: ResearchArtifact; edge?: EvidenceEdge; review?: ReviewEvent; verifications: SourceVerification[] };

export function claimGraph(topicId: string, claimId: string, artifacts: readonly ResearchArtifact[], edges: readonly EvidenceEdge[], reviews: readonly ReviewEvent[], verifications: readonly SourceVerification[]) {
  const local = artifacts.filter(a => a.topic_id === topicId);
  const claim = local.find(a => a.id === claimId && a.artifact_type === "CLAIM");
  const evidence: GraphNode[] = [], outcomes: GraphNode[] = [];
  if (!claim) return {claim, evidence, outcomes};
  const sources = new Map(local.filter(a => a.artifact_type === "SOURCE" || a.artifact_type === "EVIDENCE").map(a => [a.id,a]));
  const seen = new Set<string>();
  for (const edge of edges) {
    if (edge.topic_id !== topicId || edge.claim_artifact_id !== claim.id || !["SUPPORTS","CONTRADICTS","CONTEXT"].includes(edge.relation)) continue;
    const a = sources.get(edge.evidence_artifact_id);
    if (!a) continue;
    seen.add(a.id);
    evidence.push({id:"edge:"+edge.id, relation:edge.relation,title:a.title,artifact:a,edge,verifications:verifications.filter(v=>v.topic_id===topicId && v.source_artifact_id===a.id && (!v.edge_id || v.edge_id===edge.id))});
  }
  const associations = Array.isArray(claim.provenance?.linked_artifact_ids) ? claim.provenance.linked_artifact_ids : [];
  for (const id of new Set(associations)) {
    const a = sources.get(id);
    if (!a || seen.has(id)) continue;
    evidence.push({id:"source:"+id,relation:"ASSOCIATION",title:a.title,artifact:a,verifications:verifications.filter(v=>v.topic_id===topicId && v.source_artifact_id===id && !v.edge_id)});
  }
  for (const review of reviews.filter(r=>r.topic_id===topicId && r.claim_artifact_id===claim.id)) {
    outcomes.push({id:"review:"+review.id,relation:"REVIEW",title:review.verdict.replaceAll("_"," "),review,verifications:[]});
  }
  for (const a of local) {
    if (!["DECISION","SYNTHESIS"].includes(a.artifact_type) || a.provenance?.generated ||
      !Array.isArray(a.provenance?.linked_artifact_ids) || !a.provenance.linked_artifact_ids.includes(claim.id)) continue;
    outcomes.push({id:"artifact:"+a.id,relation:a.artifact_type==="DECISION"?"DECISION":"SYNTHESIS",title:a.title,artifact:a,verifications:[]});
  }
  return {claim,evidence,outcomes};
}
