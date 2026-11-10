import test from "node:test";
import assert from "node:assert/strict";
import { safeAuthDestination, authDestinationFromSearch } from "../lib/auth/destination.ts";

const origin = "https://ai-native-research-qfeh.vercel.app";

test("canonical redirect and legacy next preserve intended in-app paths", () => {
  assert.equal(authDestinationFromSearch("?redirect=%2Fsettings", origin), "/settings");
  assert.equal(authDestinationFromSearch("?next=%2Fmessages%2Fabc", origin), "/messages/abc");
  assert.equal(authDestinationFromSearch("?next=%2Forganizations%2Fteam", origin), "/organizations/team");
  assert.equal(authDestinationFromSearch("?next=%2Foauth%2Fconsent%3Fauthorization_id%3D123", origin), "/oauth/consent?authorization_id=123");
});

test("redirect takes precedence over legacy next", () => {
  assert.equal(authDestinationFromSearch("?next=%2Fpeople&redirect=%2Fnetwork", origin), "/network");
});

test("keeps same-origin queries and fragments", () => {
  assert.equal(safeAuthDestination("/topics/1?tab=posts#latest", origin), "/topics/1?tab=posts#latest");
});

test("rejects missing and off-site destinations", () => {
  for (const target of [null, "", "https://evil.example", "//evil.example/", "/\\evil.example/", "\\evil.example"]) {
    assert.equal(safeAuthDestination(target, origin), "/communities");
  }
});

test("malicious query parameters fall back to the app", () => {
  assert.equal(authDestinationFromSearch("?next=https%3A%2F%2Fevil.example", origin), "/communities");
  assert.equal(authDestinationFromSearch("?redirect=%2F%2Fevil.example", origin), "/communities");
});
