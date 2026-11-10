-- Restrict mutation RPCs to signed-in sessions.
-- These functions validate auth.uid(), are not triggers, and are not called from RLS policies.
-- Supabase's default grants included explicit anon EXECUTE privileges despite earlier
-- revokes from PUBLIC. Preserve authenticated and service_role privileges.
-- Idempotent and does not modify application data.

revoke execute on function public.block_user(uuid) from anon;
revoke execute on function public.create_organization(text, text, text, text, text, text, text) from anon;
revoke execute on function public.leave_organization(uuid) from anon;
revoke execute on function public.manage_organization_member(uuid, uuid, text) from anon;
revoke execute on function public.moderate_community_member(uuid, uuid, text, text) from anon;
revoke execute on function public.remove_connection(uuid) from anon;
revoke execute on function public.request_organization_membership(uuid) from anon;
revoke execute on function public.respond_connection_request(uuid, text) from anon;
revoke execute on function public.respond_direct_message_request(uuid, text) from anon;
revoke execute on function public.send_connection_request(uuid) from anon;
revoke execute on function public.start_direct_conversation(uuid) from anon;
revoke execute on function public.toggle_follow_user(uuid) from anon;
revoke execute on function public.unblock_user(uuid) from anon;
