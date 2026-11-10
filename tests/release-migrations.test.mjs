import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const exactLiveMigrationFiles = [
  "20261028184719_community_privacy_join_requests_and_owned_agents.sql",
  "20261028184849_community_access_review_rpc_and_legacy_activity_privacy.sql",
  "20261028185924_community_topic_owner_and_creator_policy_hardening.sql",
  "20261028190327_community_access_integrity_hardening.sql",
  "20261029122046_account_and_content_deletion.sql",
  "20261029123757_community_moderation_and_message_requests.sql",
  "20261029124214_preserve_message_requests_when_blocking.sql",
  "20261110143258_restrict_anonymous_mutation_rpcs.sql",
  "20261110144258_restrict_anonymous_helpers_and_trigger_functions.sql",
  "20261110151451_deduplicate_auth_user_profile_trigger.sql",
  "20261110153051_restrict_users_blocked_to_request_participants.sql",
  "20261110162933_reject_banned_community_join_approvals.sql",
  "20261110163057_notify_community_requests_and_message_acceptance.sql",
  "20261110163357_validate_moderation_actions_and_block_pending_applicants.sql",
  "20261110163620_restrict_notification_updates_to_read_status.sql",
];

test("all previously applied dated Supabase migrations are recorded in source", () => {
  for (const filename of exactLiveMigrationFiles) {
    const url = new URL("../supabase/migrations/" + filename, import.meta.url);
    assert.ok(existsSync(url), "Missing applied migration: " + filename);
    assert.ok(readFileSync(url, "utf8").trim().length > 20, "Empty migration: " + filename);
  }
  assert.equal(exactLiveMigrationFiles.length, 15);
});

test("production release pins patched Next.js and a reproducible dependency graph", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  for (const name of ["next", "eslint-config-next", "@supabase/ssr", "@supabase/supabase-js"]) {
    const expected = pkg.dependencies?.[name] || pkg.devDependencies?.[name];
    assert.match(expected, /^\d+\.\d+\.\d+$/, "Expected exact version for " + name);
    assert.equal(lock.packages["node_modules/" + name].version, expected);
  }
  assert.equal(pkg.dependencies.next, "16.4.6");
});
