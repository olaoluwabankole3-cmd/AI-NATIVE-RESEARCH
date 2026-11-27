import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claimGraph } from "../lib/evidence-graph.ts";
const artifact=(id,artifact_type,provenance={},topic_id="t")=>({id,artifact_type,provenance,topic_id,title:id});
const c=artifact("c","CLAIM",{linked_artifact_ids:["s","s2","foreign","ai"],context_artifact_ids:["s3"]});
const s=artifact("s","SOURCE"),s2=artifact("s2","EVIDENCE"),s3=artifact("s3","SOURCE"),d=artifact("d","DECISION",{linked_artifact_ids:["c"]}),ai=artifact("ai","SYNTHESIS",{generated:true,linked_artifact_ids:["c"]}),foreign=artifact("foreign","SOURCE",{},"other");
const artifacts=[c,s,s2,s3,d,ai,foreign];
const edge=(id,relation,evidence_artifact_id="s",topic_id="t",claim_artifact_id="c")=>({id,relation,evidence_artifact_id,topic_id,claim_artifact_id});
const review={id:"r",topic_id:"t",claim_artifact_id:"c",verdict:"SUPPORTED"};
const verify=(id,edge_id,topic_id="t",source_artifact_id="s")=>({id,edge_id,topic_id,source_artifact_id});
test("graph separates supporting, contradictory and contextual passages from untyped associations",()=>{
 const g=claimGraph("t","c",artifacts,[edge("e","SUPPORTS"),edge("e2","CONTRADICTS"),edge("e3","CONTEXT")],[review],[]);
 assert.deepEqual(g.evidence.map(n=>n.relation),["SUPPORTS","CONTRADICTS","CONTEXT","ASSOCIATION"]);
 assert.deepEqual(g.outcomes.map(n=>n.relation),["REVIEW","DECISION"]);
 assert.equal(g.evidence.some(n=>n.artifact.id==="s3"),false);
 assert.equal(g.outcomes.some(n=>n.artifact?.id==="ai"),false);
});
test("graph excludes other topics, missing sources, invalid relations and unrelated claims",()=>{
 const g=claimGraph("t","c",artifacts,[edge("x","SUPPORTS","foreign"),edge("y","SUPPORTS","s","other"),edge("z","SUPPORTS","s","t","different"),edge("u","BOGUS"),edge("v","SUPPORTS","missing")],[{...review,topic_id:"other"}],[]);
 assert.deepEqual(g.evidence.map(n=>n.artifact.id),["s","s2"]);
 assert.deepEqual(g.outcomes.map(n=>n.id),["artifact:d"]);
 assert.deepEqual(claimGraph("t","s",artifacts,[],[],[]).evidence,[]);
});
test("source and passage assessments are attached only to matching source, topic and edge",()=>{
 const g=claimGraph("t","c",artifacts,[edge("e","SUPPORTS")],[],[verify("v",null),verify("v2","e"),verify("v3","wrong"),verify("v4","e","other"),verify("v5","e","t","s2")]);
 assert.deepEqual(g.evidence[0].verifications.map(v=>v.id),["v","v2"]);
});
test("workspace uses real records, accessible selection, stale checks and no synthetic data",()=>{
 const room=readFileSync(new URL("../components/research-room.tsx",import.meta.url),"utf8");
 const panel=readFileSync(new URL("../components/evidence-graph-panel.tsx",import.meta.url),"utf8");
 assert.match(room,/reviewView === "graph"/);
 assert.match(room,/edges=\{reviewRecords.edges\}/);
 assert.match(room,/verifications=\{verifications\}/);
 assert.match(panel,/aria-pressed/);
 assert.match(panel,/verificationIsCurrent/);
 assert.match(panel,/reviewSnapshotIsCurrent/);
 assert.match(panel,/overflow-x-auto/);
 assert.match(panel,/Some review or verification records are unavailable/);
 assert.match(panel,/Potential duplicate source URL/);
});
