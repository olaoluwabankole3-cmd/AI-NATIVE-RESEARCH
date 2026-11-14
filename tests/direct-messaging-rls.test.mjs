import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20261114113202_fix_recursive_direct_message_insert_rls.sql", import.meta.url),
  "utf8",
);

test("direct message INSERT policy uses a private definer helper instead of recursive self-query", () => {
  assert.match(sql, /create schema if not exists private/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /from public\.direct_messages m/);
  const policy = sql.slice(sql.lastIndexOf('create policy "Participants can send direct messages"'));
  assert.match(policy, /private\.can_send_direct_message\(conversation_id,sender_id\)/);
  assert.doesNotMatch(policy, /from public\.direct_messages/);
});

test("messaging send permissions still require own identity, accepted conversation or first pending message", () => {
  assert.match(sql, /p_sender_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /p_sender_id in \(c\.user_low_id, c\.user_high_id\)/);
  assert.match(sql, /c\.request_status = 'ACCEPTED'/);
  assert.match(sql, /c\.request_status = 'PENDING' and c\.created_by = p_sender_id/);
  assert.match(sql, /not exists \(select 1 from public\.direct_messages m/);
  assert.match(sql, /char_length\(btrim\(body\)\) between 1 and 5000/);
});

test("both directions of block are checked and helper is not exposed to anonymous users", () => {
  assert.match(sql, /from public\.user_blocks b/);
  assert.match(sql, /b\.blocker_id = p_sender_id and b\.blocked_id/);
  assert.match(sql, /b\.blocked_id = p_sender_id and b\.blocker_id/);
  assert.match(sql, /revoke all on schema private from public, anon/);
  assert.match(sql, /revoke all on function private\.can_send_direct_message\(uuid,uuid\) from public, anon/);
  assert.match(sql, /grant execute on function private\.can_send_direct_message\(uuid,uuid\) to authenticated/);
});

test("repair never rewrites or deletes message, conversation, or call rows", () => {
  assert.doesNotMatch(sql, /\b(?:delete|truncate|drop table|drop schema|alter table)\b/i);
  assert.match(sql, /drop policy "Participants can send direct messages"/);
  assert.match(sql, /notify pgrst, 'reload schema'/);
});
