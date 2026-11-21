import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const topic = read("app/topics/[id]/page.tsx");
const dm = read("app/messages/[conversationId]/page.tsx");
const css = read("app/mobile-chat-refinement.css");

// Run the actual pure chat-time code, rather than assuming timestamps by regex.
const transpiled = ts.transpileModule(read("lib/chat-time.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { chatTime, chatDayLabel, sameChatDay } = await import(
  "data:text/javascript;base64," + Buffer.from(transpiled).toString("base64")
);

test("chat timestamps use the viewer's calendar date, including midnight", () => {
  const today = new Date(2026, 10, 21, 14, 30);
  const sameDay = new Date(2026, 10, 21, 8, 3);
  const previousDay = new Date(2026, 10, 20, 23, 59);
  assert.equal(sameChatDay(today.toISOString(), sameDay.toISOString()), true);
  assert.equal(sameChatDay(today.toISOString(), previousDay.toISOString()), false);
  assert.equal(chatDayLabel(sameDay.toISOString(), today), "Today");
  assert.equal(chatDayLabel(previousDay.toISOString(), today), "Yesterday");
  assert.equal(chatDayLabel(new Date(2026, 10, 18).toISOString(), today), "Wednesday");
  assert.match(chatDayLabel(new Date(2025, 10, 18).toISOString(), today), /2025/);
  assert.match(chatTime(today.toISOString()), /:/);
  assert.equal(chatTime("bad timestamp"), "");
  assert.equal(sameChatDay("invalid", today.toISOString()), false);
});

test("research topics retain authors, distinguish AI members and group by day", () => {
  assert.match(topic, /import \{ chatDayLabel, chatTime, sameChatDay \} from "@\/lib\/chat-time"/);
  assert.match(topic, /<Fragment key=\{post\.id\}>/);
  assert.match(topic, /!sameChatDay\(posts\[index - 1\]\.created_at, post\.created_at\)/);
  assert.match(topic, /<time dateTime=\{post\.created_at\}/);
  assert.match(topic, /profile: viewerProfile \?\? undefined/);
  assert.match(topic, /post\.agent \? post\.agent\.name\.split/);
  assert.match(topic, /data-agent=\{post\.participant\?\.participant_type === "AGENT"/);
  assert.match(topic, /setMobileSection\("evidence"\)/);
});

test("Android and iOS viewport changes only shift a focused topic composer", () => {
  assert.match(topic, /document\.activeElement === replyTextareaRef\.current/);
  assert.match(topic, /window\.innerHeight - viewport\.height - viewport\.offsetTop/);
  assert.match(topic, /focused && hiddenByKeyboard > 100/);
  assert.match(topic, /addEventListener\("orientationchange"/);
  assert.match(topic, /addEventListener\("focusin"/);
  assert.match(topic, /addEventListener\("focusout"/);
  assert.match(topic, /onKeyDown=\{handleReplyKeyDown\}/);
  assert.match(topic, /event\.nativeEvent\.isComposing/);
  assert.match(topic, /pointer: coarse/);
  assert.match(css, /data-keyboard-open="true"/);
  assert.match(css, /converge-topic-keyboard-inset/);
});

test("topic posting can be retried and a send takes the user to the latest reply", () => {
  assert.match(topic, /onSubmit=\{handleReply\}/);
  assert.match(topic, /const requestId = replyRequestRef\.current\?\.body === trimmedReply/);
  assert.match(topic, /setPosting\(true\)/);
  assert.match(topic, /setReply\(""\)/);
  assert.match(topic, /jumpToLatestTopic\(\)/);
  assert.match(topic, /className="converge-topic-jump-latest"/);
  assert.match(topic, /aria-busy=\{posting\}/);
  assert.match(topic, /className="converge-topic-publishing-status"/);
  assert.match(css, /converge-topic-messages-end/);
});

test("private chats preserve scroll position while reading old messages", () => {
  assert.match(dm, /shouldStickToBottomRef/);
  assert.match(dm, /viewport\.scrollHeight - viewport\.scrollTop - viewport\.clientHeight < 110/);
  assert.match(dm, /if \(shouldStickToBottomRef\.current \|\| forceScrollAfterSendRef\.current\)/);
  assert.match(dm, /onScroll=\{trackMessageScroll\}/);
  assert.match(dm, /showJumpToLatest && <button/);
  assert.match(dm, /onClick=\{scrollToLatest\}/);
  assert.doesNotMatch(dm, /\[messages\]\);\s*\/\/.*scrollIntoView/);
  assert.match(css, /overscroll-behavior-y:contain/);
});

test("DM send states clear optimistically and restore a failed message draft", () => {
  assert.match(dm, /const submittedDraft = draft/);
  assert.match(dm, /setDraft\(""\);\s*setSending\(true\)/);
  assert.match(dm, /setDraft\(\(current\) => current \? submittedDraft \+ "\\n" \+ current : submittedDraft\)/);
  assert.match(dm, /setSendFeedback\("sent"\)/);
  assert.match(dm, /setSendFeedback\("failed"\)/);
  assert.match(dm, /forceScrollAfterSendRef\.current = true/);
  assert.match(dm, /aria-label=\{sending \? "Sending message" : "Send message"\}/);
  assert.match(dm, /<span className="converge-chat-sending">Sending message/);
  assert.match(dm, /onSubmit=\{sendMessage\}/);
  assert.match(dm, /canSend \? <form/);
});

test("DM timestamps and message requests stay functional, including calling", () => {
  assert.match(dm, /<Fragment key=\{message\.id\}>/);
  assert.match(dm, /!sameChatDay\(messages\[index - 1\]\.created_at, message\.created_at\)/);
  assert.match(dm, /<time dateTime=\{message\.created_at\}/);
  assert.match(dm, /startCall\("audio"\)/);
  assert.match(dm, /startCall\("video"\)/);
  assert.match(dm, /respondToMessageRequest\("accept"\)/);
  assert.match(dm, /respondToMessageRequest\("ignore"\)/);
  assert.match(dm, /blockedBetween/);
  assert.match(css, /converge-chat-time/);
});
