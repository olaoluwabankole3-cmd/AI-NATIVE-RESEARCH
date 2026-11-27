import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourceUrl, quoteMatches, verificationIsCurrent, duplicateSources, verificationAppendix } from "../lib/source-verification.ts";

const source = { id:"s1", topic_id:"t1", artifact_type:"SOURCE", title:"Original publication", content:"A documented passage.", updated_at:"2026-11-27", provenance:{source_url:"https://example.org/report#p1"} };
const edge = { id:"e1", topic_id:"t1", evidence_artifact_id:"s1", passage:"A documented passage.", locator:"Page 1" };
const event = { id:"v1", topic_id:"t1", source_artifact_id:"s1", edge_id:"e1", verdict:"ORIGIN_CHECKED", reviewer_id:"r1", created_at:"2026-11-27", rationale:"Reviewed the original and found this passage.", publisher:"Example", publication_date:"2026", original_url:"https://example.org/report", original_excerpt:"A documented passage.", quote_match:true, snapshot:{title:source.title,updated_at:source.updated_at,saved_url:"https://example.org/report",passage:edge.passage,locator:edge.locator} };

test("source links reject dangerous schemes and credentials, and remove fragment only", () => {
  assert.equal(sourceUrl("javascript:alert(1)"),null);
  assert.equal(sourceUrl("https://user:secret@example.org"),null);
  assert.equal(sourceUrl("https://example.org/report?edition=2#page"),"https://example.org/report?edition=2");
});
test("passage checks require meaningful exact matching, with normalized whitespace", () => {
  assert.equal(quoteMatches("A documented passage.","Intro: A documented\n passage. End"),true);
  assert.equal(quoteMatches("A documented passage.","A fabricated passage."),false);
  assert.equal(quoteMatches("a documented passage.","A documented passage."),false);
  assert.equal(quoteMatches("short","short"),false);
});
test("verification snapshots fail closed when source or edge changes or is in another topic", () => {
  assert.equal(verificationIsCurrent(event,source,[edge]),true);
  assert.equal(verificationIsCurrent(event,{...source,updated_at:"later"},[edge]),false);
  assert.equal(verificationIsCurrent(event,{...source,topic_id:"other"},[edge]),false);
  assert.equal(verificationIsCurrent(event,source,[{...edge,locator:"Page 2"}]),false);
  assert.equal(verificationIsCurrent(event,source,[]),false);
});
test("duplicate references are topic-scoped and do not merge distinct editions", () => {
  assert.deepEqual(duplicateSources(source,[source,{...source,id:"s2"},{...source,id:"s3",topic_id:"other"},{...source,id:"s4",provenance:{source_url:"https://example.org/report?edition=2"}}]).map(a=>a.id),["s2"]);
});
test("exports distinguish manual attestations, unverified materials and unavailable history", () => {
  const result = verificationAppendix("t1",[source,{...source,id:"s2",title:"Unchecked source"}],[edge],[event],true);
  assert.match(result,/Human attestations only/);
  assert.match(result,/Verification history could not be loaded/);
  assert.match(result,/No recorded source assessment/);
  assert.match(result,/Potential duplicate source URL/);
  assert.match(result,/Match against submitted excerpt: matched/);
  assert.match(result,/Reviewer: r1/);
});
test("API and migration enforce authorized human-only, same-topic append-only access", () => {
  const api=readFileSync(new URL("../app/api/topics/[id]/source-verification/route.ts",import.meta.url),"utf8");
  const sql=readFileSync(new URL("../supabase/migrations/20261127143648_research_source_verification_engine.sql",import.meta.url),"utf8");
  assert.match(api,/auth\.auth\.getUser/);
  assert.match(api,/access\.canParticipate/);
  assert.match(api,/participant_type", "HUMAN"/);
  assert.match(api,/source\.created_by_participant_id === participant/);
  assert.match(api,/edge\.created_by === user/);
  assert.match(api,/payload\.attested !== true/);
  assert.match(api,/quoteMatches\(passage, excerpt\)/);
  assert.doesNotMatch(api,/fetch\(/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/grant select, insert .* to service_role/);
  assert.match(sql,/foreign key \(topic_id,source_artifact_id,edge_id\)/);
});
