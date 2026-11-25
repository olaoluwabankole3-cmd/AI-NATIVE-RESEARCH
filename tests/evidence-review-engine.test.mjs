import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("lib/research-outcome.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { reviewSnapshotIsCurrent, buildEvidenceReviewAppendix, buildResearchOutcomeMarkdown } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const topicId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const artifact = (id, artifact_type, content, overrides = {}) => ({
  id, topic_id: topicId, artifact_type, title: id, content,
  created_by_participant_id: "human-author", provenance: {},
  updated_at: "2026-11-25T12:00:00Z", created_at: "2026-11-25T11:00:00Z",
  ...overrides,
});
const claim = artifact("claim-a", "CLAIM", "Initial research claim.");
const source = artifact("source-a", "SOURCE", "A directly quoted factual sentence in the saved research notes.");
const evidence = artifact("evidence-a", "EVIDENCE", "Counterevidence: the original estimate had important caveats.");
const edges = [
  { id:"edge-1",topic_id:topicId,claim_artifact_id:claim.id,evidence_artifact_id:source.id,
    relation:"SUPPORTS",passage:"A directly quoted factual sentence",locator:"Paragraph 1",note:"Interpret carefully",
    created_by:"human-author",created_at:"2026-11-25T12:15:00Z" },
  { id:"edge-2",topic_id:topicId,claim_artifact_id:claim.id,evidence_artifact_id:evidence.id,
    relation:"CONTRADICTS",passage:"Counterevidence: the original estimate",locator:"",note:"",
    created_by:"human-reviewer",created_at:"2026-11-25T12:16:00Z" },
];
const review = {
  id:"review-1",topic_id:topicId,claim_artifact_id:claim.id,reviewer_id:"human-reviewer",
  verdict:"INCONCLUSIVE",rationale:"The quoted source has a narrow scope and contradictory evidence remains unresolved.",
  created_at:"2026-11-25T13:00:00Z",
  snapshot:{snapshot_version:1,claim:{title:claim.title,content:claim.content,updated_at:claim.updated_at},
    edges:[
      {id:"edge-1",evidence_id:source.id,relation:"SUPPORTS",passage:edges[0].passage,
        locator:"Paragraph 1",source_title:source.title,source_updated_at:source.updated_at},
      {id:"edge-2",evidence_id:evidence.id,relation:"CONTRADICTS",passage:edges[1].passage,
        locator:"",source_title:evidence.title,source_updated_at:evidence.updated_at},
    ]},
};

test("independent review snapshot is current only when claim and all cited materials are unchanged", () => {
  assert.equal(reviewSnapshotIsCurrent(review, [claim,source,evidence],edges),true);
  assert.equal(reviewSnapshotIsCurrent(review, [{...claim,content:"Revised claim"},source,evidence],edges),false);
  assert.equal(reviewSnapshotIsCurrent(review, [claim,{...source,updated_at:"later"},evidence],edges),false);
  assert.equal(reviewSnapshotIsCurrent(review, [claim,source,evidence],edges.slice(0,1)),false);
  assert.equal(reviewSnapshotIsCurrent(review, [claim,source,evidence],[
    ...edges, {...edges[0],id:"edge-3",relation:"CONTEXT"}]),false);
  assert.equal(reviewSnapshotIsCurrent(review, [claim,source,evidence],[
    {...edges[0],passage:"Updated quote"},edges[1]]),false);
});

test("Markdown appendix displays both sides of research evidence and dated human verdict without claiming verification", () => {
  const appendix = buildEvidenceReviewAppendix({
    topicId, artifacts:[claim,source,evidence],edges,reviews:[review],origin:"https://converge.example",
  });
  assert.match(appendix,/\*\*SUPPORTS\*\*/);
  assert.match(appendix,/\*\*CONTRADICTS\*\*/);
  assert.match(appendix,/directly quoted factual sentence/);
  assert.match(appendix,/INCONCLUSIVE/);
  assert.match(appendix,/human-reviewer/);
  assert.match(appendix,/not automatic fact checking/);
  assert.match(appendix,/current snapshot/);
  assert.match(appendix,/research-artifact-source-a/);
  const stale = buildEvidenceReviewAppendix({topicId,artifacts:[{...claim,content:"Changed"},source,evidence],edges,reviews:[review],origin:"https://converge.example"});
  assert.match(stale,/snapshot now superseded/);
});

test("report includes independently reviewed evidence without mixing other topics or pretending results", () => {
  const md = buildResearchOutcomeMarkdown({
    topicId, title:"Research pilot",question:"How should we interpret the evidence?",
    artifacts:[claim,source,evidence,artifact("foreign","SOURCE","PRIVATE",{topic_id:otherId})],
    edges:[...edges,{...edges[0],id:"foreign-edge",topic_id:otherId}],
    reviews:[review,{...review,id:"foreign-review",topic_id:otherId}],
    origin:"https://converge.example",generatedAt:new Date("2026-11-25T14:00:00Z"),
  });
  assert.match(md,/Passage-level evidence and independent peer reviews/);
  assert.match(md,/INCONCLUSIVE/);
  assert.doesNotMatch(md,/PRIVATE|foreign-edge|foreign-review/);
  assert.match(md,/not formal certification/i);
});

test("server API uses authenticated participation and never exposes direct client service-role access", () => {
  const api = read("app/api/topics/[id]/evidence-review/route.ts");
  assert.match(api,/auth\.getUser\(\)/);
  assert.match(api,/getTopicCommunityAccess\(admin, topicId, user\.id\)/);
  assert.match(api,/!access\.canParticipate/);
  assert.match(api,/\.eq\("participant_type", "HUMAN"\)/);
  assert.match(api,/claim\.created_by_participant_id === participant!\.id/);
  assert.match(api,/normalizeQuote\(evidence\.content\)\.includes\(normalizeQuote\(passage\)\)/);
  assert.match(api,/\.eq\("topic_id", topicId\)/);
  assert.match(api,/payload\.action === "edge"/);
  assert.match(api,/payload\.action === "review"/);
  assert.match(api,/verdict === "SUPPORTED"/);
  assert.doesNotMatch(api,/\bservice_role\b\s*=\s*["']/);
});

test("database migration prevents cross-topic links and browser direct table access", () => {
  const ddl = read("supabase/migrations/20261125222724_evidence_review_engine_20261125.sql");
  assert.match(ddl,/foreign key \(topic_id, claim_artifact_id\)/);
  assert.match(ddl,/foreign key \(topic_id, evidence_artifact_id\)/);
  assert.match(ddl,/alter table public\.research_evidence_edges enable row level security/);
  assert.match(ddl,/alter table public\.research_review_events enable row level security/);
  assert.match(ddl,/revoke all on public\.research_review_events from public, anon, authenticated, service_role/);
  assert.match(ddl,/grant select, insert on public\.research_review_events to service_role/);
  assert.doesNotMatch(ddl,/create policy/);
});

test("the existing research room and export connect to the review UX without replacing old features", () => {
  const room = read("components/research-room.tsx");
  const panel = read("components/research-evidence-review-panel.tsx");
  const lineage = read("components/research-lineage-panel.tsx");
  assert.match(room,/ResearchEvidenceReviewPanel/);
  assert.match(room,/ResearchLineagePanel/);
  assert.match(room,/\/evidence-review/);
  assert.match(panel,/Record independent review/);
  assert.match(panel,/Save quoted relationship/);
  assert.match(panel,/authorIsReviewer/);
  assert.match(panel,/reviewSnapshotIsCurrent/);
  assert.match(lineage,/edges: evidenceEdges, reviews: reviewEvents/);
  assert.match(lineage,/Download Markdown outcome/);
});
