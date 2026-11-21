import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const api = read("app/api/communities/[id]/call/route.ts");
const provider = read("lib/community-calls.ts");
const callPage = read("app/communities/[slug]/call/page.tsx");
const communityPage = read("app/communities/[slug]/page.tsx");
const card = read("components/community-call-card.tsx");

test("group call endpoints require current server-side membership and ban checks", () => {
  assert.match(api, /auth\.auth\.getUser\(\)/);
  assert.match(api, /getCommunityAccess\(admin, id, user\.id\)/);
  assert.match(api, /if \(!access\.canParticipate\)/);
  assert.match(api, /getCommunityAccess/);
  assert.match(api, /if \(ctx\.status !== 200\)/);
  assert.match(api, /can join this community call/);
});

test("meeting tokens are created by the server and are scoped to a private, fixed community room", () => {
  assert.match(provider, /process\.env\.DAILY_API_KEY/);
  assert.doesNotMatch(provider, /NEXT_PUBLIC_DAILY_API_KEY/);
  assert.match(provider, /room_name: room\.name/);
  assert.match(provider, /privacy: "private"/);
  assert.match(provider, /room\.privacy !== "private"/);
  assert.match(provider, /room\.name !== roomName/);
  assert.match(provider, /eject_at_token_exp: true/);
  assert.match(provider, /enforce_unique_user_ids: true/);
  assert.match(api, /"Cache-Control": "no-store"/);
  assert.match(api, /"Referrer-Policy": "no-referrer"/);
});

test("public communities do not confer group call access to nonmembers", () => {
  assert.match(api, /if \(!access\.canParticipate\)/);
  assert.doesNotMatch(api, /access\.canRead\s*\)/);
});

test("only current owners or moderators can end an entire group call", () => {
  assert.match(api, /if \(!ctx\.access\.isOwner\)/);
  assert.match(api, /roleRow\.role !== "OWNER"/);
  assert.match(api, /roleRow\.role !== "MODERATOR"/);
  assert.match(api, /endCommunityCall\(id\)/);
  assert.match(callPage, /window\.confirm\("End this community call for everyone/);
});

test("community page exposes group calls only to current members and shows live presence", () => {
  assert.match(communityPage, /currentIsMember && !isBanned && <CommunityCallCard/);
  assert.match(card, /20{3}/);
  assert.match(card, /Join call/);
  assert.match(card, /Start call/);
  assert.match(card, /status\.configured/);
});

test("embedded group media stays in a protected community route, leaving unloads iframe", () => {
  assert.match(callPage, /method: "POST"/);
  assert.match(callPage, /method: "DELETE"/);
  assert.match(callPage, /<iframe/);
  assert.match(callPage, /allow="microphone; camera; autoplay; fullscreen; display-capture"/);
  assert.match(callPage, /referrerPolicy="no-referrer"/);
  assert.match(callPage, /Back to community/);
});

test("group calls do not change the one-to-one voice/video implementation", () => {
  assert.match(read("app/calls/[callId]/page.tsx"), /RTCPeerConnection/);
  assert.match(read("app/api/calls/ice/route.ts"), /voiceCallsEnabled/);
});
