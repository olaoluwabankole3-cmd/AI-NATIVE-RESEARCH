import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = load("app/topics/[id]/page.tsx");
const room = load("components/research-room.tsx");
const css = load("app/research-evidence-workspace.css");
const layout = load("app/layout.tsx");

test("Evidence and Discussion use one accessible tab switcher at every viewport", () => {
  assert.match(page, /role="tablist" aria-label="Research room views"/);
  assert.match(page, /aria-selected=\{mobileSection === "discussion"\}/);
  assert.match(page, /aria-selected=\{mobileSection === "evidence"\}/);
  assert.match(page, /data-mobile-tab=\{mobileSection\}/);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*\.converge-room-tabbar \{\s*display: flex !important/);
  assert.match(css, /data-mobile-tab="discussion"\] > \.converge-room-evidence/);
  assert.match(css, /data-mobile-tab="evidence"\] > \.converge-room-discussion/);
  assert.match(css, /data-mobile-tab="evidence"\] > \.converge-room-evidence/);
});

test("Evidence workspace is not fixed and no longer reserves 300px right sidebar", () => {
  assert.match(css, /main\.converge-app-page\.figma-topic \.converge-room-evidence \{[\s\S]*?position: static !important/);
  assert.match(css, /width: 100% !important/);
  assert.match(css, /height: auto !important/);
  assert.match(css, /overflow: visible !important/);
  assert.match(css, /@media \(min-width: 1280px\) \{[\s\S]*?\.converge-topic-workspace > \.py-7 \{[\s\S]*?margin: 0 0 0 368px !important/);
  assert.doesNotMatch(css, /width:\s*300px/);
  assert.doesNotMatch(css, /right:\s*0;/);
  assert.match(css, /converge-evidence-overview/);
  assert.match(css, /converge-evidence-steps/);
  assert.match(css, /@media \(max-width: 767px\)/);
});

test("research material, peer review and outcome stages retain the existing functions", () => {
  for (const stage of ["materials", "review", "outcome"]) {
    assert.match(room, new RegExp('workspaceStage === "' + stage + '"'));
    assert.match(room, new RegExp('hidden=\\{workspaceStage !== "' + stage + '"\\}'));
  }
  assert.match(room, /aria-label="Evidence workflow steps"/);
  assert.match(room, /ResearchLineagePanel/);
  assert.match(room, /ResearchEvidenceReviewPanel/);
  assert.match(room, /handleGenerateSynthesis/);
  assert.match(room, /handleCreate/);
  assert.match(room, /recordHumanDecision/);
  assert.match(room, /Download Markdown outcome|ResearchLineagePanel/);
  assert.match(room, /\.from\("research_artifacts"\)/);
  assert.match(room, /\.select\("id, topic_id, created_by_participant_id/);
});

test("deep links to saved artifacts reopen Evidence and the materials stage", () => {
  assert.match(page, /hash\.startsWith\("#research-artifact-"\)/);
  assert.match(page, /setMobileSection\("evidence"\)/);
  assert.match(room, /window\.addEventListener\("hashchange", openLinkedArtifact\)/);
  assert.match(room, /setWorkspaceStage\("materials"\)/);
  assert.match(room, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(room, /id=\{"research-artifact-" \+ artifact\.id\}/);
});

test("legacy Figma CSS overrides are loaded last without touching public pages", () => {
  assert.ok(layout.lastIndexOf('import "./research-evidence-workspace.css";') >
    layout.lastIndexOf('import "./community-desktop-repair.css";'));
  assert.match(css, /main\.converge-app-page\.figma-topic/);
  assert.doesNotMatch(css, /\.figma-research(?!-room)|\.figma-conversation|\.sign-in|\.marketing/);
});
