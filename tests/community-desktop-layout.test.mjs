import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const page = read("app/communities/page.tsx");
const css = read("app/community-desktop-repair.css");
const legacy = read("app/figma-parity.css");
const layout = read("app/layout.tsx");

test("community hub has one primary column and a separate desktop inspector", () => {
  assert.match(page, /figma-research-container[\s\S]*<div className="converge-research-primary">/);
  const first = page.indexOf('<div className="converge-research-primary">');
  const directory = page.indexOf('id="communities-directory"');
  const aside = page.indexOf('<aside className="figma-research-workspace"');
  assert.ok(first > 0 && directory > first && aside > directory,
    "community rows, topics and directory must be in primary column before the inspector");
  assert.match(page, /converge-community-landing/);
  assert.match(page, /converge-research-discovery/);
  assert.match(page, /converge-research-board/);
  assert.match(page, /converge-topic-list/);
});

test("desktop CSS replaces old overlapping absolute panels with normal document flow", () => {
  assert.match(legacy, /position:\s*absolute;\s*top:\s*0;\s*left:\s*0/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /\.figma-research-container\s*\{\s*position:\s*relative !important;\s*display:\s*grid !important/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(238px,\s*278px\)/);
  assert.match(css, /\.converge-research-primary\s*\{\s*display:\s*flex !important/);
  assert.match(css, /\.converge-page-intro\s*\{\s*position:\s*relative !important/);
  assert.match(css, /\.converge-research-discovery\s*\{\s*position:\s*relative !important/);
  assert.match(css, /\.figma-research-mobile-tabs\s*\{\s*position:\s*relative !important/);
  assert.match(css, /\.figma-research-spaces\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.figma-research-workspace\s*\{\s*position:\s*sticky !important/);
  assert.match(css, /top:\s*22px !important/);
});

test("desktop styles are loaded LAST so Figma legacy desktop positions cannot win", () => {
  assert.match(layout, /import "\.\/community-workspace\.css";\s*import "\.\/community-desktop-repair\.css";/);
  assert.match(css, /\.converge-page-intro button\s*\{\s*display:\s*inline-flex !important/);
  assert.match(css, /\.figma-research-title-desktop\s*\{\s*display:\s*inline !important/);
  assert.match(css, /\.converge-community-landing\s*\{\s*margin:\s*0 !important/);
});

test("tablet and mobile preserve the established Figma interaction flow", () => {
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /@media \(min-width: 1024px\) and \(max-width: 1179px\)/);
  assert.match(css, /\.converge-research-primary\s*\{\s*display:\s*contents/);
  assert.match(css, /\.figma-research-workspace\s*\{\s*display:\s*none !important/);
  assert.match(page, /aria-pressed=\{communityView === tab.value\}/);
  assert.match(page, /handleCreate/);
  assert.match(page, /Community directory/);
  assert.match(page, /\/topics\/\$\{topic\.id\}/);
});

test("no site-wide marketing, authentication or conversation CSS was added", () => {
  assert.doesNotMatch(css, /(^|\s)(body|html|header|aside|main)\s*\{/m);
  assert.doesNotMatch(css, /\.figma-topic|\.figma-conversation|\.marketing|\.sign-in|\.sign-up/);
});
