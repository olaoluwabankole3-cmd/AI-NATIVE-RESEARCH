import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const hub = read("app/communities/page.tsx");
const community = read("app/communities/[slug]/page.tsx");
const css = read("app/community-workspace.css");
const layout = read("app/layout.tsx");

test("research home promotes real joined/owned communities and preserves browse/create", () => {
  assert.match(hub, /converge-community-landing/);
  assert.match(hub, /setJoinedCommunityIds\(\[\.\.\.new Set/);
  assert.match(hub, /community\.created_by === user\.id/);
  assert.match(hub, /from\("community_members"\)\.select\("community_id"\)/);
  assert.match(hub, /joinedCommunityIds\.includes\(community\.id\)/);
  assert.match(hub, /communityConversationMap\.get\(community\.id\)/);
  assert.match(hub, /community\.visibility === "PRIVATE" && !joined/);
  assert.match(hub, /"Private · Approval required"/);
  assert.match(hub, /setCommunityView\(communityView === "EXPLORE" \? "JOINED" : "EXPLORE"\)/);
  assert.match(hub, /handleCreate/);
  assert.match(hub, /converge-research-quick-nav/);
  assert.match(hub, /converge-topic-card/);
});

test("community highlights are from actual owner-authored topics, not invented announcements", () => {
  assert.match(community, /const organizerTopic = useMemo/);
  assert.match(community, /topic\.created_by === community\?\.created_by/);
  assert.match(community, /!privateLocked && organizerTopic/);
  assert.match(community, /FROM THE COMMUNITY OWNER/);
  assert.match(community, /organizerTopic\.title/);
  assert.match(community, /organizerTopic\.body/);
  assert.doesNotMatch(community, /fakeAnnouncements|hardcodedAnnouncements/);
});

test("community conversation rows sort by real accessible latest posts", () => {
  assert.match(community, /from\("posts"\)/);
  assert.match(community, /select\("topic_id, body, created_at"\)/);
  assert.match(community, /\.in\("topic_id", loadedTopics\.slice\(0, 100\)/);
  assert.match(community, /latestReplyByTopic\[topic\.id\]/);
  assert.match(community, /const activityTime = recentReply\?\.created_at \?\? topic\.created_at/);
  assert.match(community, /new Date\(bTime\)\.getTime\(\) - new Date\(aTime\)\.getTime\(\)/);
  assert.match(community, /converge-community-conversation__preview/);
  assert.match(community, /recentReply\?\.body \|\| topic\.body/);
  assert.match(community, /postgres_changes/);
  assert.match(community, /allowedTopicIds\.has\(post\.topic_id\)/);
});

test("public and private membership gates are unchanged for viewing and joining", () => {
  assert.match(community, /const privateLocked = Boolean\(isBanned \|\|/);
  assert.match(community, /communityData\.visibility === "PUBLIC" \|\| member/);
  assert.match(community, /setIsBanned\(banned\)/);
  assert.match(community, /!privateLocked && <div className="grid/);
  assert.match(community, /!privateLocked && organizerTopic/);
  assert.match(community, /handleJoinPublic/);
  assert.match(community, /handleRequestAccess/);
  assert.match(community, /joinRequest\?\.status === "PENDING"/);
  assert.match(community, /CommunityCallCard communityId=\{community\.id\}/);
});

test("conversation navigation and owner/moderator management stay actionable", () => {
  for (const value of ["ALL", "RESEARCH", "DISCUSSION"]) {
    assert.match(community, new RegExp('setFilter\\("' + value + '"\\)'));
  }
  assert.match(community, /id="community-conversations"/);
  assert.match(community, /converge-community-section-nav/);
  assert.match(community, /id="community-call"/);
  assert.match(community, /converge-community-manage-menu/);
  assert.match(community, /\/members"/);
  assert.match(community, /\/settings"/);
  assert.match(community, /handleDeleteTopic\(topic\)/);
  assert.match(community, /handleCreateTopic/);
  assert.match(community, /members_can_create_topics/);
  assert.match(community, /aria-controls="create-topic-form"/);
});

test("redesign styles are scoped and preserve the existing chat and landing pages", () => {
  assert.match(layout, /import "\.\/mobile-chat-refinement\.css";\s*import "\.\/community-workspace\.css"/);
  assert.match(css, /main\.figma-research \.converge-community-landing/);
  assert.match(css, /main\.converge-community-chat \.converge-community-head/);
  assert.match(css, /main\.converge-community-chat \.converge-community-conversation__link/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /@media \(max-width:380px\)/);
  assert.doesNotMatch(css, /\.sign-in|\.sign-up|\.marketing|\.figma-conversation|\.figma-topic/);
});
