import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("Conversation header keeps core calls while putting profile and blocking in overflow", () => {
  const chat = read("app/messages/[conversationId]/page.tsx");
  assert.match(chat, /startCall\("audio"\)/);
  assert.match(chat, /startCall\("video"\)/);
  assert.match(chat, /summary aria-label="Conversation options"/);
  assert.match(chat, /View member profile/);
  assert.match(chat, /toggleBlock\(\)/);
});

test("Composer announces sent and failed states, preserves drafts and supports keyboard", () => {
  const chat = read("app/messages/[conversationId]/page.tsx");
  assert.match(chat, /setSendFeedback\("sent"\)/);
  assert.match(chat, /setSendFeedback\("failed"\)/);
  assert.match(chat, /Message sent/);
  assert.match(chat, /your draft is preserved/);
  assert.match(chat, /requestSubmit\(\)/);
  assert.match(chat, /event\.nativeEvent\.isComposing/);
  assert.match(chat, /event\.shiftKey/);
  assert.match(chat, /threadUnavailable && !messages\.length/);
  assert.match(chat, /Message sent, but the conversation could not refresh/);
});

test("Inbox has live previews, search and accessible clear and refresh controls", () => {
  const inbox = read("app/messages/page.tsx");
  assert.match(inbox, /converge-inbox-search-field/);
  assert.match(inbox, /aria-label="Clear conversation search"/);
  assert.match(inbox, /converge-inbox-counts/);
  assert.match(inbox, /void loadInbox\(viewerId, true\)/);
  assert.match(inbox, /converge-inbox-updates-/);
  assert.match(inbox, /direct_messages/);
  assert.match(inbox, /direct_conversations/);
});

test("Call screen keeps camera, microphone, hangup and TURN probe accessible", () => {
  const room = read("app/calls/[callId]/page.tsx");
  assert.match(room, /converge-call-network-details/);
  assert.match(room, /Connection details/);
  assert.match(room, /Test TURN relay/);
  assert.match(room, /toggleCamera/);
  assert.match(room, /toggleMute/);
  assert.match(room, /switchCamera/);
  assert.match(room, /finish\("ended"\)/);
  assert.match(room, /ref=\{remoteVideoRef\}/);
  assert.match(room, /ref=\{localVideoRef\}/);
});

test("Communication icon set stays decorative, accessible and independent of new dependencies", () => {
  const icon = read("components/communication-icon.tsx");
  assert.match(icon, /aria-hidden="true"/);
  assert.match(icon, /name: CommunicationIconName/);
  assert.match(icon, /focusable="false"/);
  assert.match(icon, /phone:/);
  assert.match(icon, /video:/);
});
