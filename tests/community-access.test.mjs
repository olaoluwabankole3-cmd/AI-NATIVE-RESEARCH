import test from "node:test";
import assert from "node:assert/strict";
import { deriveCommunityPermissions } from "../lib/community-permissions.ts";

const publicSpace = { visibility: "PUBLIC", created_by: "owner", members_can_create_topics: true };
const privateSpace = { visibility: "PRIVATE", created_by: "owner", members_can_create_topics: false };

test("a community owner can manage their space", () => {
  assert.deepEqual(deriveCommunityPermissions(privateSpace,"owner",false,false), {
    isOwner:true,isMember:true,canRead:true,canParticipate:true,canCreateTopic:true,
  });
});

test("a public guest can read but cannot participate", () => {
  const x=deriveCommunityPermissions(publicSpace,"visitor",false,false);
  assert.equal(x.canRead,true);assert.equal(x.isMember,false);assert.equal(x.canParticipate,false);assert.equal(x.canCreateTopic,false);
});

test("a private-community outsider cannot read or participate", () => {
  const x=deriveCommunityPermissions(privateSpace,"visitor",false,false);
  assert.equal(x.canRead,false);assert.equal(x.canParticipate,false);assert.equal(x.canCreateTopic,false);
});

test("community member respects disabled topic creation", () => {
  const x=deriveCommunityPermissions(privateSpace,"member",true,false);
  assert.equal(x.isMember,true);assert.equal(x.canRead,true);assert.equal(x.canCreateTopic,false);
});

test("a banned member is denied access even if stale membership exists", () => {
  const x=deriveCommunityPermissions(publicSpace,"member",true,true);
  assert.equal(x.isMember,false);assert.equal(x.canRead,false);assert.equal(x.canParticipate,false);assert.equal(x.canCreateTopic,false);
});

test("a banned owner is denied participation in inconsistent database state", () => {
  const x=deriveCommunityPermissions(publicSpace,"owner",true,true);
  assert.equal(x.isOwner,true);assert.equal(x.canRead,false);assert.equal(x.canParticipate,false);assert.equal(x.canCreateTopic,false);
});
