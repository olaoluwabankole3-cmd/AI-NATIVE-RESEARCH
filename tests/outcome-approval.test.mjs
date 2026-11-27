import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canonical,eligibleFindings,outcomeStatus,approvedExport} from "../lib/outcome-approval.ts";
const claim={id:"c",topic_id:"t",artifact_type:"CLAIM",title:"Claim",content:"Text",updated_at:"date"};
const source={id:"s",topic_id:"t",artifact_type:"SOURCE",title:"Source",updated_at:"date"};
const edge={id:"e",topic_id:"t",claim_artifact_id:"c",evidence_artifact_id:"s",relation:"SUPPORTS",passage:"A quoted passage",locator:"p1"};
const review={id:"r",topic_id:"t",claim_artifact_id:"c",reviewer_id:"reviewer",verdict:"SUPPORTED",snapshot:{claim:{title:"Claim",content:"Text",updated_at:"date"},edges:[{id:"e",evidence_id:"s",relation:"SUPPORTS",passage:"A quoted passage",locator:"p1",source_title:"Source",source_updated_at:"date"}]}};
const record={topic:{id:"t"},artifacts:[claim,source],edges:[edge],reviews:[review],verifications:[]};
const version={id:"v",topic_id:"t",version_no:1,submitted_by:"author",digest:"hash",created_at:"date",report:"Frozen report"};
const decision=(reviewer_id,verdict,version_id="v",topic_id="t")=>({reviewer_id,verdict,version_id,topic_id,created_at:"date",rationale:"Reasoned verdict"});
test("canonical digest input is independent of JSON key ordering",()=>assert.equal(canonical({b:[{z:1,a:2}],a:3}),canonical({a:3,b:[{a:2,z:1}]})));
test("only claims with supporting passage and current independent supported review are eligible",()=>{
 assert.deepEqual(eligibleFindings(record).map(a=>a.id),["c"]);
 for(const variant of [{reviews:[]},{reviews:[{...review,verdict:"DISPUTED"}]},{reviews:[{...review,reviewer_id:null}]},{edges:[]},{artifacts:[{...claim,content:"Edited"},source]},{artifacts:[claim,{...source,topic_id:"other"}]},{edges:[{...edge,passage:"Edited"}]},{edges:[{...edge,relation:"CONTRADICTS"}]},{edges:[edge,{...edge,id:"e2"}]}]) assert.deepEqual(eligibleFindings({...record,...variant}),[]);
});
test("approval is version scoped, independent, and requests for changes take precedence",()=>{
 assert.equal(outcomeStatus(version,[]),"UNDER_REVIEW");
 assert.equal(outcomeStatus(version,[decision("author","APPROVED"),decision("r","APPROVED","other"),decision("r","APPROVED","v","other")]),"UNDER_REVIEW");
 assert.equal(outcomeStatus(version,[decision("r","APPROVED")]),"APPROVED");
 assert.equal(outcomeStatus(version,[decision("r","APPROVED"),decision("r2","CHANGES_REQUESTED")]),"CHANGES_REQUESTED");
 assert.equal(outcomeStatus(version,[decision(null,"APPROVED")]),"APPROVED");
});
test("export uses frozen version, digest and only its own decisions",()=>{
 const text=approvedExport(version,[decision("r","APPROVED"),{...decision("r2","CHANGES_REQUESTED","other"),rationale:"Excluded rationale"}]);
 assert.match(text,/Review status: APPROVED/);assert.match(text,/Snapshot SHA-256: hash/);assert.match(text,/Frozen report/);assert.doesNotMatch(text,/Excluded rationale/);
});
test("server and schema enforce authorization, digest, append-only records and same-topic review",()=>{
 const api=readFileSync(new URL("../app/api/topics/[id]/outcome-approval/route.ts",import.meta.url),"utf8");
 const sql=readFileSync(new URL("../supabase/migrations/20261127144439_research_outcome_approval_engine.sql",import.meta.url),"utf8");
 assert.match(api,/auth\.auth\.getUser/);assert.match(api,/access\.canParticipate/);assert.match(api,/participant_type", "HUMAN"/);
 assert.match(api,/eligibleFindings\(snapshot\)/);assert.match(api,/digest!==expected/);assert.match(api,/version\.submitted_by===user/);
 assert.match(sql,/foreign key\(topic_id,version_id\)/);assert.match(sql,/unique\(version_id,reviewer_id\)/);assert.match(sql,/author_id=new\.reviewer_id/);assert.match(sql,/grant select,insert/);assert.match(sql,/security invoker/);assert.match(sql,/enable row level security/);
});
