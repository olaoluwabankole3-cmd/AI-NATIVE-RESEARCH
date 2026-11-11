import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Focused mobile detail routes own navigation and do not show the global dock", () => {
  const nav = read("components/site-header.tsx");
  const css = read("app/application-refinement.css");
  assert.match(nav, /isFocusedMobileRoute/);
  assert.match(nav, /(?:messages\|topics)/);
  assert.match(nav, /!isFocusedMobileRoute/);
  assert.match(nav, /converge-app-header--focused/);
  assert.match(css, /converge-app-header--focused/);
  assert.match(css, /\.converge-mobile-dock/);
  assert.match(css, /max-width: 1023px/);
});

test("Mobile chat scrolls inside messages; composer follows the actual visual viewport", () => {
  const chat = read("app/messages/[conversationId]/page.tsx");
  const css = read("app/application-refinement.css");
  assert.match(chat, /messagesViewportRef\.current/);
  assert.match(chat, /viewport\.scrollTop = viewport\.scrollHeight/);
  assert.doesNotMatch(chat, /bottomRef\\.current\\?\\.scrollIntoView/);
  assert.match(chat, /window\.visualViewport/);
  assert.match(chat, /visualViewport|visual-viewport|converge-chat-visible-height/);
  assert.match(css, /var\(--converge-chat-visible-height,100dvh\)/);
  assert.match(css, /\.converge-chat-thread/);
  assert.match(css, /min-height: 0 !important/);
  assert.match(chat, /window\.confirm/);
  assert.match(chat, /blockedBetween/);
  assert.match(chat, /respondToMessageRequest/);
});

test("Mobile requests open a dedicated decision screen, with no overlapping empty states", () => {
  const inbox = read("app/messages/page.tsx");
  const css = read("app/application-refinement.css");
  assert.match(inbox, /converge-request-review/);
  assert.match(inbox, /href=\{`\/messages\/\$\{conversation.id\}\`\}/);
  assert.match(inbox, /inboxView === "all" && !search\.trim\(\)/);
  assert.match(inbox, /setLoading\(true\)/);
  assert.match(css, /converge-request-row \.converge-message-request-actions/);
  for (const action of ['"accept"', '"ignore"', '"block"']) assert.ok(inbox.includes(action));
});

test("Research is a functional feed rather than explanatory cards", () => {
  const hub = read("app/communities/page.tsx");
  const topic = read("app/topics/[id]/page.tsx");
  const css = read("app/application-refinement.css");
  assert.match(hub, /Search communities and topics/);
  assert.match(hub, /setSearch\(" "\.trim\(\)\)|setSearch\(""\)/);
  assert.match(hub, /converge-topic-card/);
  assert.match(hub, /handleCreate/);
  assert.doesNotMatch(hub, /How Converge works|Better thinking is a team sport|Built for shared inquiry/);
  assert.match(topic, /converge-mobile-topic-back/);
  assert.match(topic, /converge-room-participants/);
  assert.match(topic, /aria-selected=\{mobileSection === "discussion"\}/);
  assert.match(topic, /aria-selected=\{mobileSection === "evidence"\}/);
  assert.match(topic, /handleAddAgent/);
  assert.match(topic, /handleReply/);
  assert.match(css, /converge-room-discussion form:has\(#topic-reply\)/);
});

test("Specialist mobile selection has a working back control and preserves permissions", () => {
  const dir = read("components/specialist-directory.tsx");
  const css = read("app/application-refinement.css");
  assert.match(dir, /data-mobile-view=\{mobileView\}/);
  assert.match(dir, /setMobileView\("detail"\)/);
  assert.match(dir, /setMobileView\("list"\)/);
  assert.match(css, /data-mobile-view="list"/);
  assert.match(css, /data-mobile-view="detail"/);
  assert.doesNotMatch(dir, /SUPABASE_SERVICE_ROLE_KEY|system_prompt/);
});

test("People, org, network, research keep actions without decorative stats", () => {
  for (const page of ["app/people/page.tsx","app/organizations/page.tsx","app/network/page.tsx"]) {
    const content = read(page);
    assert.match(content, /converge-directory-summary/);
    assert.doesNotMatch(content, /stat\.note|item\.note/);
  }
  const people = read("app/people/page.tsx");
  assert.match(people, /handleFollow/);
  assert.match(people, /handleConnect/);
  assert.match(people, /handleMessage/);
  assert.match(read("app/organizations/page.tsx"), /handleCreate/);
});
