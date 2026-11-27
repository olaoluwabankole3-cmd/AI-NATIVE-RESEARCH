import type { EvidenceEdge, ResearchArtifact, ReviewEvent } from "./research-outcome";
import type { SourceVerification } from "./source-verification";
export type OutcomeRecord = {topic:{id:string; title:string; body:string}; artifacts:ResearchArtifact[]; edges:EvidenceEdge[]; reviews:ReviewEvent[]; verifications:SourceVerification[]};
export type OutcomeSections = {methodology:string; limitations:string; recommendations:string; openQuestions:string; findingIds:string[]};
export type OutcomeVersion = {id:string; topic_id:string; version_no:number; submitted_by:string|null; created_at:string; digest:string; sections:OutcomeSections; snapshot:OutcomeRecord; report:string};
export type OutcomeDecision = {id:string; topic_id:string; version_id:string; reviewer_id:string|null; verdict:"APPROVED"|"CHANGES_REQUESTED"; rationale:string; created_at:string};
export function outcomeStatus(version:OutcomeVersion, decisions:readonly OutcomeDecision[]) {
  const records=decisions.filter(d=>d.topic_id===version.topic_id && d.version_id===version.id && (!d.reviewer_id || !version.submitted_by || d.reviewer_id!==version.submitted_by));
  if(records.some(d=>d.verdict==="CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
  if(records.some(d=>d.verdict==="APPROVED")) return "APPROVED";
  return "UNDER_REVIEW";
}
export function canonical(value:unknown):string {
  if(value===null || typeof value!=="object") return JSON.stringify(value)??"null";
  if(Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
  const obj=value as Record<string,unknown>;
  return "{"+Object.keys(obj).sort().map(k=>JSON.stringify(k)+":"+canonical(obj[k])).join(",")+"}";
}
export function eligibleFindings(record:OutcomeRecord) {
  const {topic,artifacts,edges,reviews}=record;
  return artifacts.filter(a=>a.topic_id===topic.id && a.artifact_type==="CLAIM" &&
    edges.some(e=>e.topic_id===topic.id && e.claim_artifact_id===a.id && e.relation==="SUPPORTS" && artifacts.some(s=>s.id===e.evidence_artifact_id && s.topic_id===topic.id && ["SOURCE","EVIDENCE"].includes(s.artifact_type))) &&
    reviews.some(r=>r.topic_id===topic.id && r.claim_artifact_id===a.id && r.verdict==="SUPPORTED" && r.reviewer_id && currentReview(r,artifacts,edges)));
}
// Keep this pure and compatible with Node's type-stripping test runner.
function currentReview(review:ReviewEvent, artifacts:ResearchArtifact[], edges:EvidenceEdge[]) {
  const claim=artifacts.find(a=>a.id===review.claim_artifact_id && a.topic_id===review.topic_id);
  const state=review.snapshot?.claim;
  if(!claim||!state||claim.title!==state.title||claim.content!==state.content||claim.updated_at!==state.updated_at||!Array.isArray(review.snapshot?.edges))return false;
  const live=edges.filter(e=>e.topic_id===review.topic_id && e.claim_artifact_id===claim.id);
  return live.length===review.snapshot.edges.length && review.snapshot.edges.every(c=>{
    const e=live.find(e=>e.id===c.id && e.evidence_artifact_id===c.evidence_id);
    const s=artifacts.find(a=>a.id===c.evidence_id&&a.topic_id===review.topic_id);
    return !!e&&!!s&&e.relation===c.relation&&e.passage===c.passage&&e.locator===c.locator&&s.title===c.source_title&&(s.updated_at??null)===c.source_updated_at;
  });
}
export function approvedExport(version:OutcomeVersion, decisions:readonly OutcomeDecision[]) {
  const status=outcomeStatus(version,decisions);
  const events=decisions.filter(d=>d.topic_id===version.topic_id&&d.version_id===version.id&&(!d.reviewer_id || !version.submitted_by || d.reviewer_id!==version.submitted_by));
  return ["# Research outcome — version "+version.version_no,"","Review status: "+status,"Version ID: "+version.id,"Snapshot SHA-256: "+version.digest,"Submitted by: "+(version.submitted_by??"deleted account"),"Submitted at: "+version.created_at,"","Approval concerns this frozen report only, not external source truth or unanimous agreement.","","## Review decisions",...events.map(d=>"- "+d.verdict+" · "+(d.reviewer_id??"deleted account")+" · "+d.created_at+"\n  "+d.rationale),"",version.report].join("\n");
}
