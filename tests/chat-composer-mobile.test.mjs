import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const topic = read("app/topics/[id]/page.tsx");
const dm = read("app/messages/[conversationId]/page.tsx");
const community = read("app/communities/[slug]/page.tsx");
const refinements = read("app/application-refinement.css");
const css = read("app/mobile-chat-refinement.css");
const layout = read("app/layout.tsx");

test("topic composer remains anchored on mobile instead of legacy static form", () => {
  assert.match(css, /form\.converge-topic-reply:has\(#topic-reply\)\s*\{[^}]*position:fixed !important/);
  assert.match(css, /bottom:var\(--converge-topic-keyboard-inset,0px\) !important/);
  assert.match(refinements, /\.converge-app-page:not\(\.figma-topic\) \.converge-room-discussion form:has\(#topic-reply\)/);
  assert.doesNotMatch(refinements, /@media \(max-width:900px\)\s*\{\s*\.converge-app-page \.converge-room-discussion form:has\(#topic-reply\)/);
  assert.match(css, /converge-topic-workspace > \.py-7\s*\{[^}]*padding-bottom:calc\(125px/);
  assert.match(layout, /import "\.\/mobile-chat-refinement\.css"/);
});

test("topic reply input is one-line, auto-grows and retains real send handler", () => {
  assert.match(topic, /onSubmit=\{handleReply\}/);
  assert.match(topic, /rows=\{1\}/);
  assert.match(topic, /ref=\{replyTextareaRef\}/);
  assert.match(topic, /resizeReplyTextarea\(event\.currentTarget\)/);
  assert.match(topic, /Math\.min\(Math\.max\(input\.scrollHeight, 44\), 120\)/);
  assert.match(topic, /setReply\(""\)/);
  assert.match(topic, /disabled=\{posting \|\| !reply\.trim\(\)\}/);
  assert.match(topic, /aria-label=\{posting \? "Posting reply" : "Send reply"\}/);
  assert.match(topic, /--converge-topic-keyboard-inset/);
});

test("community chat labels, dynamic member replies and AI replies remain intact", () => {
  assert.match(topic, /converge-topic-messages/);
  assert.match(topic, /converge-topic-message/);
  assert.match(topic, /post\.agent\?\.name/);
  assert.match(topic, /post\.profile\?\.display_name/);
  assert.match(topic, /post\.body/);
  assert.match(topic, /converge-topic-post-time/);
  assert.match(topic, /post\.participant\?\.participant_type === "AGENT"/);
  assert.match(topic, /setMobileSection\("evidence"\)/);
  assert.match(topic, /setShowAgentPicker/);
  assert.match(css, /data-agent="true"/);
  assert.match(css, /data-own="true"/);
});

test("personal messaging retains request, send and calling functionality", () => {
  assert.match(dm, /onSubmit=\{sendMessage\}/);
  assert.match(dm, /onKeyDown=\{handleComposerKeyDown\}/);
  assert.match(dm, /rows=\{1\}/);
  assert.match(dm, /resizeMessageInput\(event\.currentTarget\)/);
  assert.match(dm, /requestStatus === "ACCEPTED" && !blockedBetween/);
  assert.match(dm, /startCall\("audio"\)/);
  assert.match(dm, /startCall\("video"\)/);
  assert.match(css, /main\.figma-conversation \.converge-chat-composer textarea#message-body/);
  assert.match(css, /main\.figma-conversation \.converge-chat-composer button\[type="submit"\]/);
});

test("community overview remains a working community, not a static mock", () => {
  assert.match(community, /converge-community-chat/);
  assert.match(community, /<CommunityCallCard/);
  assert.match(community, /handleJoinPublic/);
  assert.match(community, /handleCreateTopic/);
  assert.match(community, /href=\{"\/topics\/" \+ topic\.id\}/);
  assert.match(css, /main\.converge-community-chat/);
});

test("navigation, research evidence and protected reply behavior remain untouched", () => {
  assert.match(topic, /if \(!currentParticipantId \|\| !topic\)/);
  assert.match(topic, /\/api\/topics\/\$\{topic\.id\}\/replies/);
  assert.match(topic, /converge-room-evidence/);
  assert.match(css, /data-mobile-tab="evidence"/);
  assert.doesNotMatch(css, /main\.converge-app-page:(?!has)/);
});
