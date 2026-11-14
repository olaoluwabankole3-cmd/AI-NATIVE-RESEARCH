import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("research navigation uses readable shortcuts instead of three cramped feature cards", () => {
  const hub = read("app/communities/page.tsx");
  assert.match(hub, /converge-research-quick-nav/);
  assert.match(hub, /aria-label="Quick navigation"/);
  assert.match(hub, /href="#converge-topic-list"/);
  assert.match(hub, /href="#communities-directory"/);
  assert.match(hub, /href="\/agents"/);
  assert.doesNotMatch(hub, /converge-research-start__link/);
  assert.doesNotMatch(hub, /sm:grid-cols-3/);
});

test("profile privacy choices are full-width, semantic radios without cropped words", () => {
  const page = read("app/profile/page.tsx");
  assert.match(page, /fieldset className="converge-profile-visibility/);
  assert.match(page, /Who can view your profile/);
  assert.match(page, /name="profile_visibility"/);
  assert.match(page, /checked=\{form\.profile_visibility === option\.value\}/);
  assert.match(page, /update\("profile_visibility", option\.value\)/);
  for (const value of ["public", "members", "private"]) {
    assert.match(page, new RegExp('value: "' + value + '"'));
  }
  assert.doesNotMatch(page, /sm:grid-cols-3/);
});

test("inbox keeps working search and refresh with flatter list hierarchy", () => {
  const page = read("app/messages/page.tsx");
  const icons = read("components/communication-icon.tsx");
  const css = read("app/application-refinement.css");
  assert.match(page, /aria-label="Refresh conversations"/);
  assert.match(page, /name="refresh"/);
  assert.match(icons, /refresh:/);
  assert.match(page, /converge-inbox-search-field/);
  assert.match(css, /converge-inbox-list > div/);
  assert.match(css, /background:transparent !important/);
  assert.doesNotMatch(page, /className="ml-auto min-h-9.*>Refresh<\/button>/);
});

test("AI directory keeps filtering and admin access without duplicate prominent CTAs", () => {
  const page = read("app/agents/page.tsx");
  const directory = read("components/specialist-directory.tsx");
  assert.match(page, /Explore AI specialists by expertise/);
  assert.doesNotMatch(page, /Back to communities/);
  assert.match(directory, /href="\/admin\/agents"/);
  assert.match(directory, /converge-directory-management/);
  assert.match(directory, /converge-specialist-directory__item/);
  assert.match(directory, /setSelectedId\(agent\.id\)/);
});

test("topic reply no longer obscures posts on mobile and retains submit permission guards", () => {
  const topic = read("app/topics/[id]/page.tsx");
  const css = read("app/application-refinement.css");
  assert.match(topic, /onSubmit=\{handleReply\}/);
  assert.match(topic, /rows=\{3\}/);
  assert.match(topic, /disabled=\{posting \|\| !reply\.trim\(\)\}/);
  assert.match(topic, /converge-topic-reply/);
  assert.match(css, /form:has\(#topic-reply\)/);
  assert.match(css, /position:static !important/);
  assert.doesNotMatch(topic, /Posting as you\./);
});
