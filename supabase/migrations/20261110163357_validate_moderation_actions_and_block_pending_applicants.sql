-- Stage 4: disallow null moderation actions and let the OWNER block pending
-- private-community applicants. Moderators still manage only regular members.
-- Also disallow null direct-message request responses.
-- No existing membership, ban, message or request records are modified.

do $guard$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='moderate_community_member'
      and p.prosecdef and pg_get_functiondef(p.oid) like '%Only current community members can be blocked here.%'
  ) then raise exception 'Unexpected community moderation function; abort'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='respond_direct_message_request'
      and p.prosecdef and pg_get_functiondef(p.oid) like '%This message request is no longer pending.%'
  ) then raise exception 'Unexpected direct message request function; abort'; end if;
end
$guard$;

create or replace function public.moderate_community_member(
  p_community_id uuid, p_user_id uuid, p_action text, p_reason text default null
)
returns text
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_community_owner uuid;
  v_actor_role text;
  v_target_role public.community_member_role;
begin
  if v_actor is null then raise exception 'Sign in to manage community members.'; end if;
  if p_community_id is null or p_user_id is null or p_user_id=v_actor then
    raise exception 'Choose another community member.';
  end if;
  if p_action is null or p_action not in ('REMOVE','BLOCK','UNBLOCK') then
    raise exception 'Invalid community moderation action.';
  end if;

  select c.created_by into v_community_owner
  from public.communities c where c.id=p_community_id;
  if not found then raise exception 'Community not found.'; end if;

  if v_community_owner=v_actor then
    v_actor_role:='OWNER';
  else
    select cm.role::text into v_actor_role
    from public.community_members cm
    where cm.community_id=p_community_id and cm.user_id=v_actor;
  end if;
  if v_actor_role is null or v_actor_role not in ('OWNER','MODERATOR') then
    raise exception 'Only community owners and moderators can manage members.';
  end if;
  if p_user_id=v_community_owner then
    raise exception 'The community owner cannot be removed or blocked.';
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_user_id) then
    raise exception 'Member not found.';
  end if;

  select cm.role into v_target_role
  from public.community_members cm
  where cm.community_id=p_community_id and cm.user_id=p_user_id;

  if v_actor_role='MODERATOR'
     and v_target_role is distinct from 'MEMBER'::public.community_member_role then
    raise exception 'Moderators can only remove or block regular members.';
  end if;

  if p_action='REMOVE' then
    if v_target_role is null then
      raise exception 'This person is not a member of the community.';
    end if;
    delete from public.community_members
    where community_id=p_community_id and user_id=p_user_id
      and role <> 'OWNER'::public.community_member_role;
    return 'REMOVED';

  elsif p_action='BLOCK' then
    if v_target_role is null and not (
      v_actor_role='OWNER' and exists (
        select 1 from public.community_join_requests r
        where r.community_id=p_community_id and r.user_id=p_user_id
          and r.status='PENDING'
      )
    ) then
      raise exception 'Only current members or pending applicants can be blocked here.';
    end if;

    insert into public.community_bans (community_id,user_id,banned_by,reason)
    values (
      p_community_id,p_user_id,v_actor,
      nullif(left(btrim(coalesce(p_reason,'')),500),'')
    ) on conflict (community_id,user_id) do update
      set banned_by=excluded.banned_by,reason=excluded.reason,created_at=now();

    delete from public.community_members
    where community_id=p_community_id and user_id=p_user_id
      and role <> 'OWNER'::public.community_member_role;

    update public.community_join_requests
      set status='REJECTED',reviewed_by=v_actor,
          reviewed_at=now(),updated_at=now()
    where community_id=p_community_id and user_id=p_user_id and status='PENDING';

    return 'BLOCKED';

  else
    if v_actor_role <> 'OWNER' then
      raise exception 'Only the community owner can lift a community block.';
    end if;
    delete from public.community_bans
    where community_id=p_community_id and user_id=p_user_id;
    return 'UNBLOCKED';
  end if;
end;
$fn$;

create or replace function public.respond_direct_message_request(
  p_conversation_id uuid, p_action text
)
returns text
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_conversation public.direct_conversations%rowtype;
  v_status text;
begin
  if v_user_id is null then raise exception 'Sign in to respond to message requests.'; end if;
  if p_action is null or p_action not in ('accept','ignore') then
    raise exception 'Invalid message request action.';
  end if;

  select * into v_conversation from public.direct_conversations c
    where c.id=p_conversation_id for update;
  if not found then raise exception 'Message request not found.'; end if;
  if v_user_id not in (v_conversation.user_low_id,v_conversation.user_high_id) then
    raise exception 'You cannot access this message request.';
  end if;
  if v_conversation.created_by=v_user_id then
    raise exception 'Only the recipient can respond to a message request.';
  end if;
  if v_conversation.request_status <> 'PENDING' then
    raise exception 'This message request is no longer pending.';
  end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id=v_user_id and b.blocked_id=v_conversation.created_by)
       or (b.blocker_id=v_conversation.created_by and b.blocked_id=v_user_id)
  ) then raise exception 'This member is blocked.'; end if;

  v_status:=case when p_action='accept' then 'ACCEPTED' else 'IGNORED' end;
  update public.direct_conversations
  set request_status=v_status where id=p_conversation_id;
  return v_status;
end;
$fn$;

revoke execute on function public.moderate_community_member(uuid,uuid,text,text) from public,anon;
revoke execute on function public.respond_direct_message_request(uuid,text) from public,anon;
grant execute on function public.moderate_community_member(uuid,uuid,text,text) to authenticated,service_role;
grant execute on function public.respond_direct_message_request(uuid,text) to authenticated,service_role;
