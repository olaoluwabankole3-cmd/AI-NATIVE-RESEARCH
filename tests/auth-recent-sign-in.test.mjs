import test from "node:test";
import assert from "node:assert/strict";
import { isRecentSignIn } from "../lib/auth/recent-sign-in.ts";

const now = Date.parse("2026-11-10T12:00:00Z");
test("an interactive sign-in just now permits protected account actions", () => {
  assert.equal(isRecentSignIn("2026-11-10T12:00:00Z", now), true);
  assert.equal(isRecentSignIn("2026-11-10T11:50:00Z", now), true);
});
test("sign-ins older than fifteen minutes require reauthentication", () => {
  assert.equal(isRecentSignIn("2026-11-10T11:44:59Z", now), false);
  assert.equal(isRecentSignIn("2026-11-02T13:53:08Z", now), false);
});
test("invalid, missing and future sign-in times are rejected", () => {
  assert.equal(isRecentSignIn("", now), false);
  assert.equal(isRecentSignIn(undefined, now), false);
  assert.equal(isRecentSignIn("invalid", now), false);
  assert.equal(isRecentSignIn("2026-11-10T12:00:01Z", now), false);
});
test("strict boundary is inclusive", () => {
  assert.equal(isRecentSignIn("2026-11-10T11:45:00Z", now), true);
});
