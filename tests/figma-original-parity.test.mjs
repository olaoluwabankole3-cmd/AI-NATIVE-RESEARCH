import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Figma phase-one styling is scoped to the five mapped routes, not every application page", () => {
  const layout = read("app/layout.tsx");
  const css = read("app/figma-parity.css");
  assert.match(layout, /import "\.\/application-refinement\.css";\s*import "\.\/figma-parity\.css";/);
  assert.match(css, /main\.converge-app-page\.converge-figma/);
  assert.match(css, /#0b1110/);
  assert.match(css, /#a6e6bd/);
  assert.match(css, /#294334/);
  assert.match(css, /@media\s*\(max-width:767px\)/);
  assert.match(css, /@media\s*\(min-width:1280px\)/);
  for (const page of ["app/communities/page.tsx", "app/messages/page.tsx",
    "app/agents/page.tsx", "app/profile/page.tsx", "app/settings/page.tsx"]) {
    assert.match(read(page), /converge-figma/, page + " must opt in to Figma styling");
  }
});

test("Mobile Figma navigation keeps the existing routes, live unread notifications and account actions", () => {
  const header = read("components/site-header.tsx");
  assert.match(header, /figma-dock-glyph/);
  assert.match(header, /isActiveDestination/);
  assert.match(header, /\/communities/);
  assert.match(header, /\/messages/);
  assert.match(header, /\/agents/);
  assert.match(header, /unreadNotifications/);
  assert.match(header, /handleSignOut/);
  const css = read("app/figma-parity.css");
  assert.match(css, /height:calc\(82px \+ env\(safe-area-inset-bottom\)\)/);
});

test("Research Figma All/Joined/Explore tabs use actual community_members data", () => {
  const page = read("app/communities/page.tsx");
  assert.match(page, /communityView/);
  assert.match(page, /joinedCommunityIds/);
  assert.match(page, /\.from\("community_members"\)/);
  assert.match(page, /select\("community_id"\)/);
  assert.match(page, /figma-research-mobile-tabs/);
  assert.match(page, /aria-pressed=\{communityView === tab\.value\}/);
  assert.match(page, /handleCreate/);
  assert.match(page, /\/topics\/\$\{topic\.id\}/);
  assert.match(page, /figma-research-workspace/);
  assert.doesNotMatch(page, /Tomi Adeyemi|AI & Society|Paper on LLM/i);
});

test("Inbox Figma parity retains real authenticated messaging and request moderation", () => {
  const page = read("app/messages/page.tsx");
  assert.match(page, /figma-messages-recent/);
  assert.match(page, /figma-message-row/);
  assert.match(page, /figma-messages-privacy/);
  assert.match(page, /\.from\("direct_conversations"\)/);
  assert.match(page, /\.from\("direct_messages"\)/);
  assert.match(page, /respond_direct_message_request/);
  assert.match(page, /handleRequestAction/);
  assert.match(page, /converge-inbox-updates-/);
  assert.match(page, /href="\/calls"/);
  assert.doesNotMatch(page, /Tomi Adeyemi|Nil A/i);
});

test("Agent Figma cards show live specialist data and role filters", () => {
  const page = read("app/agents/page.tsx");
  const list = read("components/specialist-directory.tsx");
  assert.match(page, /getRegisteredAgents/);
  assert.match(page, /AI specialists/);
  assert.match(list, /figma-specialty-filters/);
  assert.match(list, /setSpecialty/);
  assert.match(list, /setSelectedId/);
  assert.match(list, /View full specialist profile/);
  assert.match(list, /converge-directory-management/);
  assert.doesNotMatch(list, /Tomi Adeyemi/);
});

test("Profile Figma composition preserves saved data, privacy modes and advanced fields", () => {
  const page = read("app/profile/page.tsx");
  assert.match(page, /onSubmit=\{handleSave\}/);
  assert.match(page, /onChange=\{handleAvatarChange\}/);
  assert.match(page, /figma-profile-advanced/);
  for (const field of ["display_name", "username", "headline", "bio", "organization",
    "location", "website_url", "interests", "profile_visibility"]) {
    assert.ok(page.includes('update("' + field + '"') || page.includes("form." + field),
      "profile field missing: " + field);
  }
  for (const visibility of ["public", "members", "private"]) assert.ok(page.includes('value: "' + visibility + '"'));
  assert.match(page, /figma-profile-save/);
});

test("Settings Figma screen keeps account deletion challenge and working destinations intact", () => {
  const page = read("app/settings/page.tsx");
  assert.match(page, /figma-account-mobile-bar/);
  assert.match(page, /figma-settings-rows/);
  assert.match(page, /figma-settings-danger/);
  assert.match(page, /onSubmit=\{handleDeleteAccount\}/);
  assert.match(page, /DELETE/);
  assert.match(page, /\/api\/account\/delete/);
  assert.match(page, /currentSettings\.map/);
  assert.match(page, /plannedSettings\.map/);
});
