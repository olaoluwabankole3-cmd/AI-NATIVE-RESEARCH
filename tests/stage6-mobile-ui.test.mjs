import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Converge branding and mobile dock remain intact", () => {
  const nav = read("components/site-header.tsx");
  assert.match(nav, /converge-header-lockup\.svg/);
  assert.match(nav, /aria-label="Mobile primary navigation"/);
  assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(nav, /converge-mobile-dock__badge/);
});

test("mobile dialog supports Escape, trapped tab focus and focus restoration", () => {
  const nav = read("components/site-header.tsx");
  assert.match(nav, /aria-modal="true"/);
  assert.match(nav, /event\.key === "Escape"/);
  assert.match(nav, /event\.key !== "Tab"/);
  assert.match(nav, /mobileMenuTriggerRef\.current\?\.focus\(\)/);
  assert.match(nav, /document\.body\.style\.overflow = previousOverflow/);
});

test("communities have phone navigation, accessible filters and network recovery", () => {
  const page = read("app/communities/page.tsx");
  assert.match(page, /aria-label="Quick navigation"/);
  assert.match(page, /id="converge-topic-list"/);
  assert.match(page, /id="communities-directory"/);
  assert.match(page, /aria-label="Filter topics"/);
  assert.match(page, /aria-pressed=\{filter === item\.id\}/);
  assert.match(page, /Could not load research spaces/);
  assert.match(page, /setCreating\(false\)/);
});

test("topic loading and error views retain site navigation", () => {
  const page = read("app/topics/[id]/page.tsx");
  assert.match(page, /aria-label="Loading topic"/);
  assert.match(page, /Topic unavailable/);
  assert.match(page, /aria-label="Topic sections"/);
  assert.match(page, /id="topic-discussion"/);
  assert.match(page, /htmlFor="topic-reply"/);
});

test("research room provides meaningful loading, recovery and draft preservation", () => {
  const page = read("components/research-room.tsx");
  assert.match(page, /id="research-record"/);
  assert.match(page, /aria-label="Loading research artifacts"/);
  assert.match(page, /Retry loading/);
  assert.match(page, /Your draft is preserved/);
  assert.match(page, /id="research-artifact-title"/);
  assert.match(page, /setSaving\(false\)/);
});

test("messaging supports narrow viewports, retries and a message length hint", () => {
  const inbox = read("app/messages/page.tsx");
  const conversation = read("app/messages/[conversationId]/page.tsx");
  const css = read("app/globals.css");
  assert.match(inbox, /Retry inbox/);
  assert.match(inbox, /converge-message-request-actions/);
  assert.match(conversation, /converge-chat-messages/);
  assert.match(conversation, /converge-chat-composer/);
  assert.match(conversation, /draft\.length\.toLocaleString\(\)/);
  assert.match(conversation, /aria-describedby="converge-message-composer-help"/);
  assert.match(css, /100dvh - 250px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
