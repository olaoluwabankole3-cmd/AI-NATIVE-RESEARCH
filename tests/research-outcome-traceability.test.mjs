import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("lib/research-outcome.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  validResearchSourceUrl, resolveResearchLinks, normalizeResearchLinks,
  summarizeResearchRecord, buildResearchOutcomeMarkdown,
} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const root = "21fdfb43-3f48-478a-972b-341341341341";
const otherTopic = "50fdfb43-3f48-478a-972b-341341341341";
const item = (id, artifact_type, overrides={}) => ({
  id, topic_id:root, artifact_type, title:artifact_type+" example", content:"Recorded information.",
  created_by_participant_id:"participant-a",
  provenance: {}, created_at:"2026-11-23T10:00:00.000Z",
  ...overrides,
});
const claim=item("claim-1","CLAIM",{title:"Claim one",content:"This is the test claim.",
  provenance:{linked_artifact_ids:["source-1","evidence-1","source-1","cross-topic","missing"],
    context_artifact_ids:["AI_CONTEXT_NOT_A_CITATION"]}});
const source=item("source-1","SOURCE",{title:"Reference A",provenance:{source_url:"https://example.org/paper?x=1"}});
const evidence=item("evidence-1","EVIDENCE",{title:"Observed data"});
const decision=item("decision-1","DECISION",{title:"Review decision",content:"Proceed with a small pilot.",
  provenance:{linked_artifact_ids:["claim-1","source-1"]}});
const ai=item("agent-1","SYNTHESIS",{title:"AI synthesis",content:"An AI hypothesis.",
  created_by_participant_id:"agent-participant",provenance:{generated:true,
    generated_by_agent_name:"Critical Reviewer",provider:"groq",model:"example-model",
    context_artifact_ids:["claim-1"]}});
const cross=item("cross-topic","SOURCE",{topic_id:otherTopic,title:"Private unrelated topic"});
const records=[claim,source,evidence,decision,ai,cross];

test("source URLs accept only safe HTTP and HTTPS links without embedded credentials", () => {
  assert.equal(validResearchSourceUrl(" https://example.org/path "), "https://example.org/path");
  assert.equal(validResearchSourceUrl("http://example.org/"), "http://example.org/");
  for (const unsafe of ["javascript:alert(1)", "data:text/html,a", "file:///etc/passwd",
    "mailto:owner@example.org", "https://user:secret@example.org", "not a url", ""]) {
    assert.equal(validResearchSourceUrl(unsafe), null, unsafe);
  }
});

test("research links do not conflate AI context with explicit supporting material", () => {
  assert.deepEqual(resolveResearchLinks(claim,records).map((x)=>x.id),["source-1","evidence-1"]);
  assert.deepEqual(resolveResearchLinks(ai,records),[]);
  assert.deepEqual(normalizeResearchLinks(["cross-topic","claim-1","source-1","source-1"],claim,records),["source-1"]);
  assert.deepEqual(resolveResearchLinks(item("lonely","CLAIM",{provenance:{context_artifact_ids:["source-1"]}}),records),[]);
});

test("claims and human decisions get cautious, explainable coverage metrics", () => {
  const stats=summarizeResearchRecord(records);
  assert.equal(stats.claims,1);
  assert.equal(stats.sources,2); // complete input also contains another topic; UI passes topic-scoped data
  assert.equal(stats.evidence,1);
  assert.equal(stats.syntheses,1);
  assert.equal(stats.decisions,1);
  assert.equal(stats.linkedClaims,1);
  assert.equal(stats.linkedDecisions,1);
  assert.equal(stats.unlinkedClaims,0);
  assert.equal(summarizeResearchRecord([claim]).unlinkedClaims,1);
});

test("export contains question, human decision, AI attribution, open links and caution about truth claims", () => {
  const md=buildResearchOutcomeMarkdown({
    topicId:root,title:"How should AI participate?",question:"What can we verify?",artifacts:records,
    origin:"https://ai-native-research-qfeh.vercel.app",generatedAt:new Date("2026-11-23T12:00:00.000Z"),
  });
  assert.match(md,/Research question\nWhat can we verify\?/);
  assert.match(md,/Human decisions and next actions/);
  assert.match(md,/Proceed with a small pilot/);
  assert.match(md,/Critical Reviewer; groq; example-model/);
  assert.match(md,/AI context supplied to a model is not evidence validation/);
  assert.match(md,/https:\/\/example\.org\/paper\?x=1/);
  assert.match(md,/\/topics\/21fdfb43-3f48-478a-972b-341341341341#research-artifact-source-1/);
  assert.doesNotMatch(md,/Private unrelated topic/);
  assert.doesNotMatch(md,/AI_CONTEXT_NOT_A_CITATION/);
  assert.match(md,/not independently verified/);
  assert.match(md,/Generated \(UTC\):\*\* 2026-11-23T12:00:00\.000Z/);
});

test("empty research returns a draft with explicit gaps rather than fabricated findings", () => {
  const md=buildResearchOutcomeMarkdown({
    topicId:root,title:"Unanswered",question:"Is there evidence?",artifacts:[],
    origin:"https://example.org",generatedAt:new Date("2026-11-23"),
  });
  assert.match(md,/Working draft; no human decision recorded/);
  assert.match(md,/No claims have been recorded/);
  assert.match(md,/No human-authored decision is recorded/);
  assert.doesNotMatch(md,/Approved research outcome/);
});

test("Research Room writes links through existing RLS-gated artifact table and checks source URL", () => {
  const ui=read("components/research-room.tsx");
  const panel=read("components/research-lineage-panel.tsx");
  const topic=read("app/topics/[id]/page.tsx");
  assert.match(ui,/validResearchSourceUrl\(trimmedSourceUrl\)/);
  assert.match(ui,/linked_artifact_ids: linkedIds/);
  assert.match(ui,/research_artifacts"\)\s*\.insert/);
  assert.match(ui,/ResearchLineagePanel/);
  assert.match(ui,/onCreateDecision=\{recordHumanDecision\}/);
  assert.match(ui,/id=\{"research-artifact-" \+ artifact\.id\}/);
  assert.match(topic,/topicTitle=\{topic\.title\} topicQuestion=\{topic\.body\}/);
  assert.match(panel,/\.eq\("topic_id", topicId\)/);
  assert.match(panel,/\.eq\("created_by_participant_id", participantId\)/);
  assert.match(panel,/\.eq\("updated_at", activeArtifact\.updated_at/);
  assert.match(panel,/normalizeResearchLinks\(selectedIds, activeArtifact, artifacts\)/);
  assert.match(panel,/Download Markdown outcome/);
  assert.match(panel,/navigator\.clipboard\.writeText/);
  assert.match(panel,/URL\.createObjectURL/);
  assert.doesNotMatch(panel,/NEXT_PUBLIC_.*SERVICE_ROLE_KEY/);
});
