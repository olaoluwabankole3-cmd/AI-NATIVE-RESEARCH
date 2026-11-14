import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Converge navigation separates research, people, messages and AI expertise without hiding workspaces", () => {
  const nav = read("components/site-header.tsx");
  for (const destination of ['/communities', '/people', '/messages', '/agents', '/notifications', '/workspaces', '/calls', '/organizations', '/network']) {
    assert.ok(nav.includes('"' + destination + '"'), destination + " route must remain reachable");
  }
  assert.match(nav, /label: "AI experts"/);
  assert.match(nav, /label: "AI specialists"/);
  assert.match(nav, /converge-more-destination-copy/);
  assert.match(nav, /moreDescriptions\[link\.href\]/);
  assert.match(nav, /if \(href === "\/people"\) return pathname\.startsWith\("\/people"\) \|\| pathname\.startsWith\("\/u\/"\)/);
  assert.match(nav, /aria-label="Mobile primary navigation"/);
});

test("Research home leads people from questions to communities and AI specialists using real routes", () => {
  const hub = read("app/communities/page.tsx");
  assert.match(hub, /converge-research-quick-nav/);
  assert.match(hub, /Topics/);
  assert.match(hub, /Communities/);
  assert.match(hub, /AI specialists/);
  assert.match(hub, /href="#converge-topic-list"/);
  assert.match(hub, /href="#communities-directory"/);
  assert.match(hub, /href="\/agents"/);
  assert.match(hub, /Search communities and topics/);
  assert.match(hub, /Explore spaces/);
  assert.match(hub, /Community directory/);
  assert.match(hub, /handleCreate/);
});

test("Research evidence record filters saved material without changing persistence or provenance", () => {
  const room = read("components/research-room.tsx");
  assert.match(room, /artifactFilter/);
  assert.match(room, /artifactSearch/);
  assert.match(room, /filteredArtifacts\.map\(\(artifact\)/);
  assert.match(room, /Filter research artifacts by type/);
  assert.match(room, /Search the research record/);
  assert.match(room, /Clear filters/);
  assert.match(room, /No matching research material/);
  assert.match(room, /role="status" aria-live="polite"/);
  assert.match(room, /\.from\("research_artifacts"\)/);
  assert.match(room, /aria-label="Loading research artifacts"/);
  assert.match(room, /Retry loading/);
  assert.match(room, /id="research-artifact-title"/);
  assert.match(room, /Source ↗/);
});

test("Research discussions explain how conversation relates to saved evidence and synthesis", () => {
  const topic = read("app/topics/[id]/page.tsx");
  assert.match(topic, /Research workflow:/);
  assert.match(topic, /save sources in Evidence/);
  assert.match(topic, /role="tablist" aria-label="Research room views"/);
  assert.match(topic, /aria-selected=\{mobileSection === "evidence"\}/);
  assert.match(topic, /<ResearchRoom/);
});
