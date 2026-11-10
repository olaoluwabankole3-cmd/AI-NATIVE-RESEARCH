-- Stage 1 follow-up: keep trigger functions private and deny anonymous access
-- to helpers used only by authenticated RLS or client workflows.
-- No data mutation or function-body replacement.
--
-- Trigger invocation is not gated by a session's EXECUTE grant. We retain
-- postgres and service_role EXECUTE for administrative diagnostics.
-- Removing PUBLIC also closes inherited default grants.

revoke execute on function public.add_community_owner_membership() from public, anon, authenticated;
revoke execute on function public.bump_direct_conversation_activity() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
revoke execute on function public.notify_activity_comment() from public, anon, authenticated;
revoke execute on function public.notify_activity_like() from public, anon, authenticated;
revoke execute on function public.notify_connection_request_event() from public, anon, authenticated;
revoke execute on function public.notify_direct_message() from public, anon, authenticated;
revoke execute on function public.notify_topic_reply() from public, anon, authenticated;

-- The relevant RLS policies are scoped to authenticated, not anon.
revoke execute on function public.can_manage_community(uuid) from anon;
revoke execute on function public.can_manage_organization_asset(text) from anon;
revoke execute on function public.is_organization_owner(uuid) from anon;
revoke execute on function public.users_blocked(uuid, uuid) from anon;

-- Retain anon EXECUTE on:
-- public.get_profile_social_summary(uuid): public profile stats are presented to visitors.
-- public.is_organization_admin(uuid): referenced by an anon-visible membership SELECT policy.
