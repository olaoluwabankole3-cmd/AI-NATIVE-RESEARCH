import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Original detail-screen CSS loads after Phase 1, strictly scoped to topic and conversation", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /import "\.\/figma-parity\.css";\s*import "\.\/figma-parity-phase2\.css";/);
  const css = read("app/figma-parity-phase2.css");
  for (const cls of ["figma-topic", "figma-conversation", "figma-topic-evidence-peek", "figma-chat-privacy", "figma-topic-mobile-menu"]) {
    assert.ok(css.includes(cls), cls);
  }
  for (const color of ["#0b1110", "#0e1914", "#14231b", "#a6e6bd", "#294334"]) {
    assert.ok(css.includes(color), color);
  }
  assert.match(css, /@media\s*\(max-width:767px\)/);
  assert.match(css, /@media\s*\(min-width:1280px\)/);
  assert.doesNotMatch(css, /\.sign-in|\.sign-up|marketing|home-page/);
});

test("Research topic matches original mobile hierarchy without losing authorization, reply or evidence", () => {
  const src = read("app/topics/[id]/page.tsx");
  assert.match(src, /converge-figma figma-topic/);
  assert.match(src, /figma-topic-mobile-heading/);
  assert.match(src, /figma-topic-eyebrow/);
  assert.match(src, /figma-topic-evidence-peek/);
  assert.match(src, /setMobileSection\("evidence"\)/);
  assert.match(src, /role="tab"/);
  assert.match(src, /onSubmit=\{handleReply\}/);
  assert.match(src, /handleAddAgent\(agent\)/);
  assert.match(src, /handleDeleteTopic\(\)/);
  assert.match(src, /<ResearchRoom topicId=\{topic.id\} participantId=\{currentParticipantId\}/);
  assert.match(src, /isCommunityMember && currentParticipantId/);
  assert.match(src, /topic\.body && <details className="figma-topic-mobile-body"/);
  assert.doesNotMatch(src, /Tomi Adeyemi|Amara Okafor|Cities & clean power/);
});

test("Private thread keeps real Supabase messages, requests, block controls and audio/video", () => {
  const src = read("app/messages/[conversationId]/page.tsx");
  assert.match(src, /converge-figma figma-conversation/);
  assert.match(src, /figma-chat-avatar/);
  assert.match(src, /figma-chat-private-subtitle/);
  assert.match(src, /figma-chat-privacy/);
  assert.match(src, /figma-chat-mobile-call-actions/);
  assert.match(src, /\.from\("direct_conversations"\)/);
  assert.match(src, /\.from\("direct_messages"\)/);
  assert.match(src, /onSubmit=\{sendMessage\}/);
  assert.match(src, /respondToMessageRequest\("accept"\)/);
  assert.match(src, /respondToMessageRequest\("ignore"\)/);
  assert.match(src, /respondToMessageRequest\("block"\)/);
  assert.match(src, /startCall\("audio"\)/);
  assert.match(src, /startCall\("video"\)/);
  assert.match(src, /toggleBlock\(\)/);
  assert.doesNotMatch(src, /Tomi Adeyemi|Amara Okafor|Perfect, thank you!/);
});

test("Original mobile composer remains fixed and sends are real actions", () => {
  const css = read("app/figma-parity-phase2.css");
  assert.match(css, /figma-topic \.converge-room-discussion form\.converge-topic-reply\s*\{\s*position:fixed/);
  assert.match(css, /figma-conversation \.converge-chat-composer/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  const topic = read("app/topics/[id]/page.tsx");
  const chat = read("app/messages/[conversationId]/page.tsx");
  assert.match(topic, /disabled=\{posting \|\| !reply.trim\(\)\}/);
  assert.match(chat, /disabled=\{!draft.trim\(\) \|\| sending/);
  assert.match(chat, /Your draft is preserved/);
});
