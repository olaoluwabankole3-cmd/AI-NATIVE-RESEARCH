import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const api = read("app/api/communities/[id]/call/route.ts");
const provider = read("lib/community-calls.ts");
const callPage = read("app/communities/[slug]/call/page.tsx");
const communityPage = read("app/communities/[slug]/page.tsx");
const card = read("components/community-call-card.tsx");
const migration = read("supabase/migrations/20261121120000_community_realtimekit_call_mapping.sql");
const uiLoader = read("public/cloudflare-realtimekit-loader.js");

test("group call endpoints revalidate server-side membership and bans", () => {
  assert.match(api, /auth\.auth\.getUser\(\)/);
  assert.match(api, /getCommunityAccess\(admin, id, user\.id\)/);
  assert.match(api, /if \(!access\.canParticipate\)/);
  assert.match(api, /if \(ctx\.status !== 200/);
  assert.match(api, /Only approved, unbanned community members/);
});

test("Cloudflare API token is server-only and is not confused with existing TURN credentials", () => {
  assert.match(provider, /process\.env\.CLOUDFLARE_REALTIMEKIT_API_TOKEN/);
  assert.match(provider, /api\.cloudflare\.com\/client\/v4\/accounts\//);
  assert.match(provider, /Authorization: "Bearer " \+ token/);
  assert.doesNotMatch(provider, /DAILY_API_KEY|api\.daily\.co/);
  assert.doesNotMatch(provider, /CLOUDFLARE_TURN_API_TOKEN|NEXT_PUBLIC_CLOUDFLARE_REALTIMEKIT_API_TOKEN/);
  assert.match(api, /"Cache-Control": "no-store"/);
  assert.match(api, /"Referrer-Policy": "no-referrer"/);
});

test("Cloudflare meeting records are server-private in Supabase", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.community_group_call_rooms from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /create policy .* authenticated/i);
  assert.match(api, /startOrFindMeeting/);
  assert.match(api, /meetingRow/);
  assert.match(api, /"community_group_call_rooms"/);
});

test("Cloudflare meeting disables recording and transcripts to control cost", () => {
  assert.match(provider, /record_on_start: false/);
  assert.match(provider, /transcribe_on_end: false/);
  assert.match(provider, /summarize_on_end: false/);
  assert.match(provider, /live_stream_on_start: false/);
  assert.match(provider, /MAX_PARTICIPANTS = 10/);
  assert.match(provider, /MAX_MEETING_MINUTES = 30/);
  assert.match(provider, /TOKEN_LIFETIME_MINUTES = 35/);
  assert.match(provider, /token: \{ expires_on: expiresOn \}/);
  assert.match(api, /session\.expired/);
  assert.match(api, /terminate\(ctx\.admin/);
});

test("reusable URLs are not exposed and public communities do not grant nonmembers call access", () => {
  assert.doesNotMatch(api, /joinUrl/);
  assert.match(api, /authToken/);
  assert.match(api, /if \(!access\.canParticipate\)/);
  assert.doesNotMatch(api, /access\.canRead\s*\)/);
});

test("only current owners or moderators may kick everyone", () => {
  assert.match(api, /if \(!ctx\.access\.isOwner\)/);
  assert.match(api, /roleRow\?\.role !== "OWNER"/);
  assert.match(api, /roleRow\?\.role !== "MODERATOR"/);
  assert.match(provider, /active-session\/kick-all/);
  assert.match(provider, /status: "INACTIVE"/);
});

test("community page displays live presence card to approved members", () => {
  assert.match(communityPage, /currentIsMember && !isBanned && <div id="community-call"[^>]*><CommunityCallCard/);
  assert.match(card, /20000/);
  assert.match(card, /Join call/);
  assert.match(card, /Start call/);
  assert.match(card, /status\.configured/);
});

test("Cloudflare browser UI uses version pinned official SDK web components", () => {
  assert.match(callPage, /@cloudflare\/realtimekit@2\.0\.4\/dist\/browser\.js/);
  assert.match(uiLoader, /@cloudflare\/realtimekit-ui@2\.0\.3\/loader\/index\.es2017\.js/);
  assert.match(callPage, /customElements\.whenDefined\("rtk-meeting"\)/);
  assert.match(callPage, /authToken/);
  assert.match(callPage, /defaults: \{ audio: false, video: false \}/);
  assert.match(callPage, /<CloudflareGroupRoom authToken=\{view\.authToken\}/);
  assert.match(callPage, /meetingRef\.current\.leave\(\)/);
});

test("live group call client disconnects after membership or ban revocation", () => {
  assert.match(callPage, /result\.status === 401 \|\| result\.status === 403 \|\| result\.status === 404/);
  assert.match(callPage, /setView\(null\)/);
  assert.match(callPage, /meetingRef\.current\.leave\(\)/);
});

test("group calling does not change private voice/video call path", () => {
  assert.match(read("app/calls/[callId]/page.tsx"), /RTCPeerConnection/);
  assert.match(read("app/api/calls/ice/route.ts"), /voiceCallsEnabled/);
});
