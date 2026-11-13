import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261110204800_one_to_one_voice_calls.sql");

test("voice calls require participant-only RLS with no client INSERT or UPDATE", () => {
  assert.match(sql, /alter table public\.voice_calls enable row level security/i);
  assert.match(sql, /revoke all on public\.voice_calls from public,anon,authenticated/i);
  assert.match(sql, /grant select on public\.voice_calls to authenticated/i);
  assert.match(sql, /caller_id = \(select auth\.uid\(\)\) or callee_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete) on (?:table )?public\.voice_calls to authenticated/i);
});

test("starting a voice call requires accepted DM and checks two-way blocking", () => {
  assert.match(sql, /c\.request_status='ACCEPTED'/);
  assert.match(sql, /v_actor in \(c\.user_low_id,c\.user_high_id\)/);
  assert.match(sql, /from public\.user_blocks b/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /already on another Converge call/);
});

test("only the actual callee can answer an unexpired incoming call", () => {
  assert.match(sql, /v_actor is distinct from v_call\.callee_id/);
  assert.match(sql, /v_call\.ring_expires_at < now\(\)/);
  assert.match(sql, /v_call\.status <> 'ringing'/);
});

test("only a participant may negotiate audio, with one immutable offer and answer", () => {
  assert.match(sql, /v_actor not in \(v_call\.caller_id,v_call\.callee_id\)/);
  assert.match(sql, /v_actor <> v_call\.caller_id or v_call\.offer_sdp is not null/);
  assert.match(sql, /v_actor <> v_call\.callee_id or v_call\.offer_sdp is null/);
  assert.match(sql, /char_length\(p_sdp\) not between 30 and 65536/);
});

test("blocking ends active calls, drops SDP, and clears stale abandoned calls", () => {
  assert.match(sql, /create trigger stop_voice_calls_on_block/i);
  assert.match(sql, /status='ended',ended_at=now\(\)/);
  assert.match(sql, /offer_sdp=null,answer_sdp=null/);
  assert.match(sql, /caller_seen_at < now\(\) - interval '75 seconds'/);
  assert.match(sql, /status='missed',ended_at=now\(\)/);
});

test("call mutator functions are never available to anonymous accounts", () => {
  for (const signature of [
    "start_voice_call(uuid)", "answer_voice_call(uuid)",
    "publish_voice_call_sdp(uuid,text,text)",
    "heartbeat_voice_call(uuid)", "finish_voice_call(uuid,text)",
  ]) {
    assert.ok(sql.includes("revoke execute on function public." + signature + " from public,anon"),
      "Anonymous must not execute " + signature);
  }
});

test("microphone and media are never uploaded or recorded", () => {
  const page = read("app/calls/[callId]/page.tsx");
  assert.match(page, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(page, /new RTCPeerConnection/);
  assert.match(page, /localStreamRef\.current\?\.getTracks\(\)\.forEach/);
  assert.match(page, /"publish_voice_call_sdp"/);
  assert.doesNotMatch(page, /MediaRecorder|\.upload\(|recordedBlob|\.from\("audio_recordings"\)/);
});

test("call controls require accepted unblocked conversation", () => {
  const messages = read("app/messages/[conversationId]/page.tsx");
  assert.match(messages, /requestStatus === "ACCEPTED" && !blockedBetween/);
  assert.match(messages, /supabase\.rpc\("start_voice_call"/);
});

test("incoming call UI validates identity server-side before accepting or declining", () => {
  const alert = read("components/incoming-voice-call.tsx");
  assert.match(alert, /"answer_voice_call"/);
  assert.match(alert, /"finish_voice_call"/);
  assert.match(alert, /callee_id/);
  assert.match(alert, /aria-label="Incoming voice call"/);
});

test("temporary TURN credentials never expose secret via a client environment variable", () => {
  const route = read("app/api/calls/ice/route.ts");
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /process\.env\.TURN_SHARED_SECRET/);
  assert.match(route, /createHmac\("sha1"/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_TURN_SHARED_SECRET/);
  assert.match(route, /"Cache-Control": "private, no-store/);
});

test("voice calling is disabled until database and relay release gates are satisfied", () => {
  const config = read("lib/voice-calls-config.ts");
  const layout = read("app/layout.tsx");
  const api = read("app/api/calls/ice/route.ts");
  const header = read("components/site-header.tsx");
  const messages = read("app/messages/[conversationId]/page.tsx");
  assert.match(config, /NEXT_PUBLIC_CONVERGE_CALLS_ENABLED === "true"/);
  assert.match(layout, /voiceCallsEnabled && <IncomingVoiceCall \/>/);
  assert.match(api, /if \(!voiceCallsEnabled\)/);
  assert.match(api, /status: 503/);
  assert.match(header, /\{ href: "\/calls", label: "Calls", icon: "calls" \}/);
  assert.match(messages, /voiceCallsEnabled \?/);
});

test("Calls is discoverable without enabling unfinished WebRTC or database queries", () => {
  const header = read("components/site-header.tsx");
  const inbox = read("app/messages/page.tsx");
  const thread = read("app/messages/[conversationId]/page.tsx");
  const history = read("app/calls/page.tsx");
  assert.match(header, /\{ href: "\/calls", label: "Calls", icon: "calls" \}/);
  assert.match(inbox, /href="\/calls"/);
  assert.match(inbox, /Setup/);
  assert.match(thread, /href="\/calls"/);
  assert.match(thread, /Voice calls — setup in progress/);
  assert.match(history, /if \(voiceCallsEnabled\) return <CallsPageEnabled \/>/);
  assert.match(history, /starting and receiving calls isn't available yet/);
  assert.match(read("app/api/calls/ice/route.ts"), /status: 503/);
});
