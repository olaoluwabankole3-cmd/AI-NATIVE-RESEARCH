import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeAuthDestination } from "../lib/auth/destination.ts";

const origin = "https://ai-native-research-qfeh.vercel.app";
const sql = (filename) => readFileSync(new URL("../supabase/migrations/" + filename, import.meta.url), "utf8");

test("community and message notification URLs stay inside Converge", () => {
  for (const path of [
    "/communities/test-space/settings",
    "/communities/test-space",
    "/messages/00000000-0000-0000-0000-000000000000",
    "/notifications",
  ]) {
    assert.equal(safeAuthDestination(path, origin, "/notifications"), path);
  }
});

test("untrusted notification links cannot escape the application", () => {
  for (const path of [
    "https://other.invalid/",
    "//other.invalid/path",
    "/\\other.invalid/",
    "\\other.invalid",
    "javascript:alert(1)",
    "",
  ]) {
    assert.equal(safeAuthDestination(path, origin, "/notifications"), "/notifications");
  }
});

test("community approvals are explicitly guarded against active bans", () => {
  const source = sql("20261110162933_reject_banned_community_join_approvals.sql");
  assert.match(source, /if p_decision = 'APPROVED' then/i);
  assert.match(source, /from public\.community_bans/i);
  assert.match(source, /Cannot approve a blocked community member/i);
  assert.match(source, /v_community\.created_by is distinct from auth\.uid\(\)/i);
});

test("new community and accepted-message notifications require real transitions", () => {
  const source = sql("20261110163057_notify_community_requests_and_message_acceptance.sql");
  for (const kind of [
    "community_join_request",
    "community_join_approved",
    "community_join_rejected",
    "message_request_accepted",
  ]) assert.ok(source.includes(kind), "missing notification type: " + kind);
  assert.match(source, /old\.status='PENDING' and new\.status in \('APPROVED','REJECTED'\)/i);
  assert.match(source, /old\.request_status <> 'PENDING' or new\.request_status <> 'ACCEPTED'/i);
});

test("moderation and message requests reject empty actions", () => {
  const source = sql("20261110163357_validate_moderation_actions_and_block_pending_applicants.sql");
  assert.match(source, /p_action is null or p_action not in \('REMOVE','BLOCK','UNBLOCK'\)/i);
  assert.match(source, /p_action is null or p_action not in \('accept','ignore'\)/i);
  assert.match(source, /v_actor_role='OWNER' and exists/i);
  assert.match(source, /status='PENDING'/i);
});

test("notification updates are restricted to the read flag", () => {
  const source = sql("20261110163620_restrict_notification_updates_to_read_status.sql");
  assert.match(source, /revoke insert, update on table public\.notifications from anon, authenticated/i);
  assert.match(source, /grant update \(is_read\) on public\.notifications to authenticated/i);
});
