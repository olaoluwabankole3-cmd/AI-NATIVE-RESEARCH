/** Pure permission decisions for callers using a privileged database client.
 * Database RLS remains authoritative for direct browser operations.
 */
export function deriveCommunityPermissions(
  community: { visibility: "PUBLIC" | "PRIVATE"; created_by: string; members_can_create_topics: boolean },
  userId: string,
  hasMembership: boolean,
  isBanned: boolean,
) {
  const isOwner = community.created_by === userId;
  const isMember = !isBanned && (isOwner || hasMembership);
  const canRead = !isBanned && (community.visibility === "PUBLIC" || isMember);
  const canParticipate = isMember;
  const canCreateTopic = isMember && (isOwner || community.members_can_create_topics);
  return { isOwner, isMember, canRead, canParticipate, canCreateTopic };
}
