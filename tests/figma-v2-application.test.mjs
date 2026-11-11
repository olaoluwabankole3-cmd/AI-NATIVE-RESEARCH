import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Converge V2 remains scoped to signed-in application", () => {
  const layout = read("app/layout.tsx");
  const css = read("app/application-redesign.css");
  assert.match(layout, /import "\.\/application-redesign\.css"/);
  assert.match(css, /converge-app-page/);
  assert.match(css, /@media \(min-width: 1280px\)/);
  assert.match(css, /converge-app-header/);
  assert.match(css, /converge-mobile-dock/);
  assert.doesNotMatch(css, /\.converge-landing\s*\{/);
});

test("approved Converge brand, accessible desktop navigation and Discover dock survive", () => {
  const header = read("components/site-header.tsx");
  for (const route of ['"/communities"', '"/people"', '"/messages"', '"/agents"', '"/notifications"'])
    assert.ok(header.includes(route), route + " remains navigable");
  assert.match(header, /converge-header-lockup\.svg/);
  assert.match(header, /converge-symbol-mint\.svg/);
  assert.match(header, /isActiveDestination\(pathname, item\.href\)/);
  assert.match(header, /aria-label="Mobile primary navigation"/);
  assert.match(header, /converge-mobile-more-panel/);
  assert.match(header, /handleSignOut/);
});

test("research discovery keeps working filters, search, topics and community creation", () => {
  const page = read("app/communities/page.tsx");
  assert.match(page, /converge-research-discovery/);
  assert.match(page, /Search communities and topics/);
  assert.match(page, /aria-pressed=\{filter === item\.id\}/);
  assert.match(page, /converge-topic-card__action/);
  assert.match(page, /handleCreate/);
  assert.match(page, /aria-label="Quick navigation"/);
});

test("research room retains accessible mobile discussion/evidence views and AI participation", () => {
  const page = read("app/topics/[id]/page.tsx");
  const record = read("components/research-room.tsx");
  assert.match(page, /converge-room-layout/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /aria-selected=\{mobileSection === "discussion"\}/);
  assert.match(page, /aria-selected=\{mobileSection === "evidence"\}/);
  assert.match(page, /role="tabpanel"/);
  assert.match(page, /handleAddAgent\(agent\)/);
  assert.match(page, /handleReply/);
  assert.match(record, /Generate synthesis/);
  assert.match(record, /Add artifact/);
});

test("messaging keeps requests, permission checks and uses real data in sidebar", () => {
  const inbox = read("app/messages/page.tsx");
  const thread = read("app/messages/[conversationId]/page.tsx");
  const rail = read("components/conversation-rail.tsx");
  assert.match(inbox, /converge-inbox-controls/);
  assert.match(inbox, /matchesSearch/);
  for (const action of ['"accept"', '"ignore"', '"block"']) assert.ok(inbox.includes(action));
  assert.match(thread, /ConversationRail/);
  assert.match(thread, /converge-chat-grid/);
  assert.match(thread, /blockedBetween/);
  assert.match(thread, /respondToMessageRequest/);
  assert.match(thread, /sendMessage/);
  assert.match(rail, /direct_conversations/);
  assert.match(rail, /\.from\("profiles"\)/);
  assert.doesNotMatch(rail, /service.role|service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("specialist browser does not send private prompt fields to client", () => {
  const page = read("app/agents/page.tsx");
  const browser = read("components/specialist-directory.tsx");
  assert.match(page, /SpecialistDirectory/);
  assert.match(browser, /converge-specialist-directory/);
  assert.match(browser, /aria-pressed=\{selected\?\.id === agent\.id\}/);
  assert.doesNotMatch(browser, /systemPrompt|system_prompt|SUPABASE_SERVICE_ROLE_KEY/);
});

test("moderation and notifications retain real actions and filtered views", () => {
  const members = read("app/communities/[slug]/members/page.tsx");
  const settings = read("app/communities/[slug]/settings/page.tsx");
  const notice = read("app/notifications/page.tsx");
  assert.match(members, /filteredMembers/);
  assert.match(members, /filteredBans/);
  assert.match(members, /moderate_community_member/);
  assert.match(settings, /id="community-requests"/);
  assert.match(settings, /#delete-community/);
  assert.match(notice, /Mark all as read/);
  assert.match(notice, /role="tablist"/);
  assert.match(notice, /is_read/);
});

test("existing account deletion confirmation remains protected", () => {
  const settings = read("app/settings/page.tsx");
  assert.match(settings, /handleDeleteAccount/);
  assert.match(settings, /deletePhrase !== "DELETE"/);
  assert.match(settings, /emailConfirmation/);
  assert.match(settings, /Permanently delete account/);
});
