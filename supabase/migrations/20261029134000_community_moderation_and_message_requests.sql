-- Community member removal/blocking and direct-message requests.
alter table public.direct_conversations
  add column if not exists request_status text not null default 'ACCEPTED';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'direct_conversations_request_status_check'
      and conrelid = 'public.direct_conversations'::regclass
  ) then
    alter table public.direct_conversations
      add constraint direct_conversations_request_status_check
      check (request_status in ('PENDING', 'ACCEPTED', 'IGNORED'));
  end if;
end $$;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
grant select, insert, delete on public.user_blocks to authenticated;
drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "Users can block people" on public.user_blocks;
create policy "Users can block people" on public.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid() and blocked_id <> auth.uid());
drop policy if exists "Users can unblock people" on public.user_blocks;
create policy "Users can unblock people" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

create table if not exists public.community_bans (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid not null references public.profiles(id) on delete cascade,
  reason text null check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id),
  constraint community_bans_no_self_ban check (user_id <> banned_by)
);
alter table public.community_bans enable row level security;
grant select on public.community_bans to authenticated;

create or replace function public.can_manage_community(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.communities c
    where c.id = p_community_id and c.created_by = auth.uid()
  ) or exists (
    select 1 from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = auth.uid()
      and cm.role in ('OWNER'::public.community_member_role, 'MODERATOR'::public.community_member_role)
  );
$$;
revoke all on function public.can_manage_community(uuid) from public;
grant execute on function public.can_manage_community(uuid) to authenticated;

drop policy if exists "Community bans visible to managers or affected member" on public.community_bans;
create policy "Community bans visible to managers or affected member" on public.community_bans
  for select to authenticated using (user_id = auth.uid() or public.can_manage_community(community_id));

create or replace function public.moderate_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_action text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_community_owner uuid;
  v_actor_role text;
  v_target_role public.community_member_role;
begin
  if v_actor is null then raise exception 'Sign in to manage community members.'; end if;
  if p_community_id is null or p_user_id is null or p_user_id = v_actor then
    raise exception 'Choose another community member.';
  end if;
  if p_action not in ('REMOVE', 'BLOCK', 'UNBLOCK') then
    raise exception 'Invalid community moderation action.';
  end if;
  select c.created_by into v_community_owner
  from public.communities c where c.id = p_community_id;
  if not found then raise exception 'Community not found.'; end if;
  if v_community_owner = v_actor then
    v_actor_role := 'OWNER';
  else
    select cm.role::text into v_actor_role
    from public.community_members cm
    where cm.community_id = p_community_id and cm.user_id = v_actor;
  end if;
  if v_actor_role not in ('OWNER', 'MODERATOR') or v_actor_role is null then
    raise exception 'Only community owners and moderators can manage members.';
  end if;
  if p_user_id = v_community_owner then
    raise exception 'The community owner cannot be removed or blocked.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Member not found.';
  end if;
  select cm.role into v_target_role
  from public.community_members cm
  where cm.community_id = p_community_id and cm.user_id = p_user_id;
  if v_actor_role = 'MODERATOR' and v_target_role is distinct from 'MEMBER'::public.community_member_role then
    raise exception 'Moderators can only remove or block regular members.';
  end if;
  if p_action = 'REMOVE' then
    if v_target_role is null then raise exception 'This person is not a member of the community.'; end if;
    delete from public.community_members
    where community_id = p_community_id and user_id = p_user_id and role <> 'OWNER'::public.community_member_role;
    return 'REMOVED';
  elsif p_action = 'BLOCK' then
    if v_target_role is null then raise exception 'Only current community members can be blocked here.'; end if;
    insert into public.community_bans (community_id, user_id, banned_by, reason)
    values (p_community_id, p_user_id, v_actor, nullif(left(btrim(coalesce(p_reason, '')), 500), ''))
    on conflict (community_id, user_id) do update
      set banned_by = excluded.banned_by, reason = excluded.reason, created_at = now();
    delete from public.community_members
    where community_id = p_community_id and user_id = p_user_id and role <> 'OWNER'::public.community_member_role;
    update public.community_join_requests
    set status = 'REJECTED', reviewed_by = v_actor, reviewed_at = now(), updated_at = now()
    where community_id = p_community_id and user_id = p_user_id and status = 'PENDING';
    return 'BLOCKED';
  else
    if v_actor_role <> 'OWNER' then raise exception 'Only the community owner can lift a community block.'; end if;
    delete from public.community_bans where community_id = p_community_id and user_id = p_user_id;
    return 'UNBLOCKED';
  end if;
end;
$$;
revoke all on function public.moderate_community_member(uuid, uuid, text, text) from public;
grant execute on function public.moderate_community_member(uuid, uuid, text, text) to authenticated;

drop policy if exists "Users can join public communities" on public.community_members;
create policy "Users can join public communities" on public.community_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.communities c where c.id = community_members.community_id and c.visibility = 'PUBLIC')
    and not exists (select 1 from public.community_bans b where b.community_id = community_members.community_id and b.user_id = auth.uid())
  );

drop policy if exists "Members can request private community access" on public.community_join_requests;
create policy "Members can request private community access" on public.community_join_requests
  for insert to authenticated with check (
    user_id = auth.uid() and status = 'PENDING'
    and exists (select 1 from public.communities c where c.id = community_join_requests.community_id and c.visibility = 'PRIVATE' and c.created_by <> auth.uid())
    and not exists (select 1 from public.community_members cm where cm.community_id = community_join_requests.community_id and cm.user_id = auth.uid())
    and not exists (select 1 from public.community_bans b where b.community_id = community_join_requests.community_id and b.user_id = auth.uid())
  );

drop policy if exists "Community members can view relevant memberships" on public.community_members;
create policy "Community members can view relevant memberships" on public.community_members
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.communities c where c.id = community_members.community_id and (c.visibility = 'PUBLIC' or c.created_by = auth.uid()))
    or public.can_manage_community(community_id)
  );

drop policy if exists "Participants can read direct conversations" on public.direct_conversations;
create policy "Participants can read direct conversations" on public.direct_conversations
  for select to authenticated using (
    (user_low_id = auth.uid() or user_high_id = auth.uid())
    and (request_status <> 'IGNORED' or created_by = auth.uid())
  );

drop policy if exists "Participants can read direct messages" on public.direct_messages;
create policy "Participants can read direct messages" on public.direct_messages
  for select to authenticated using (
    exists (
      select 1 from public.direct_conversations c
      where c.id = direct_messages.conversation_id
        and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
        and (c.request_status <> 'IGNORED' or c.created_by = auth.uid())
    )
  );

drop policy if exists "Participants can send direct messages" on public.direct_messages;
create policy "Participants can send direct messages" on public.direct_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and char_length(btrim(body)) between 1 and 5000
    and exists (
      select 1 from public.direct_conversations c
      where c.id = direct_messages.conversation_id
        and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = case when c.user_low_id = auth.uid() then c.user_high_id else c.user_low_id end)
             or (b.blocker_id = case when c.user_low_id = auth.uid() then c.user_high_id else c.user_low_id end and b.blocked_id = auth.uid())
        )
        and (
          c.request_status = 'ACCEPTED'
          or (c.request_status = 'PENDING' and c.created_by = auth.uid()
            and not exists (select 1 from public.direct_messages m where m.conversation_id = c.id))
        )
    )
  );

create or replace function public.start_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_low_id uuid;
  v_high_id uuid;
  v_conversation_id uuid;
  v_connected boolean;
  v_status text;
begin
  if v_user_id is null then raise exception 'Sign in to message members.'; end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then raise exception 'Choose another member to message.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_other_user_id) then raise exception 'This member could not be found.'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = v_user_id and b.blocked_id = p_other_user_id) or (b.blocker_id = p_other_user_id and b.blocked_id = v_user_id)) then
    raise exception 'You cannot message this member because one of you has blocked the other.';
  end if;
  select exists (select 1 from public.connection_requests r where r.status = 'ACCEPTED'
    and ((r.requester_id = v_user_id and r.recipient_id = p_other_user_id) or (r.requester_id = p_other_user_id and r.recipient_id = v_user_id)))
    into v_connected;
  if v_user_id < p_other_user_id then v_low_id := v_user_id; v_high_id := p_other_user_id;
  else v_low_id := p_other_user_id; v_high_id := v_user_id; end if;
  select c.id, c.request_status into v_conversation_id, v_status from public.direct_conversations c
  where c.user_low_id = v_low_id and c.user_high_id = v_high_id for update;
  if found then
    if v_status = 'IGNORED' then raise exception 'This message request was ignored and cannot be reopened.'; end if;
    return v_conversation_id;
  end if;
  insert into public.direct_conversations (user_low_id, user_high_id, created_by, request_status)
  values (v_low_id, v_high_id, v_user_id, case when v_connected then 'ACCEPTED' else 'PENDING' end)
  returning id into v_conversation_id;
  return v_conversation_id;
end;
$$;
revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.respond_direct_message_request(p_conversation_id uuid, p_action text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation public.direct_conversations%rowtype;
  v_status text;
begin
  if v_user_id is null then raise exception 'Sign in to respond to message requests.'; end if;
  if p_action not in ('accept', 'ignore') then raise exception 'Invalid message request action.'; end if;
  select * into v_conversation from public.direct_conversations c where c.id = p_conversation_id for update;
  if not found then raise exception 'Message request not found.'; end if;
  if v_user_id not in (v_conversation.user_low_id, v_conversation.user_high_id) then raise exception 'You cannot access this message request.'; end if;
  if v_conversation.created_by = v_user_id then raise exception 'Only the recipient can respond to a message request.'; end if;
  if v_conversation.request_status <> 'PENDING' then raise exception 'This message request is no longer pending.'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = v_user_id and b.blocked_id = v_conversation.created_by) or (b.blocker_id = v_conversation.created_by and b.blocked_id = v_user_id)) then
    raise exception 'This member is blocked.';
  end if;
  v_status := case when p_action = 'accept' then 'ACCEPTED' else 'IGNORED' end;
  update public.direct_conversations set request_status = v_status where id = p_conversation_id;
  return v_status;
end;
$$;
revoke all on function public.respond_direct_message_request(uuid, text) from public;
grant execute on function public.respond_direct_message_request(uuid, text) to authenticated;

create or replace function public.block_user(p_blocked_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to block members.'; end if;
  if p_blocked_user_id is null or p_blocked_user_id = v_user_id then raise exception 'Choose another member to block.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_blocked_user_id) then raise exception 'Member not found.'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_user_id, p_blocked_user_id) on conflict do nothing;
  update public.direct_conversations set request_status = 'IGNORED'
  where request_status = 'PENDING'
    and ((user_low_id = v_user_id and user_high_id = p_blocked_user_id) or (user_low_id = p_blocked_user_id and user_high_id = v_user_id));
end;
$$;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_blocked_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to unblock members.'; end if;
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_blocked_user_id;
end;
$$;
revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.send_connection_request(p_recipient_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_requester_id uuid := auth.uid();
  v_status text;
  v_request_id uuid;
begin
  if v_requester_id is null then raise exception 'Sign in to connect with members.'; end if;
  if p_recipient_id is null or p_recipient_id = v_requester_id then raise exception 'You cannot send a connection request to yourself.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_recipient_id) then raise exception 'This member could not be found.'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id = v_requester_id and b.blocked_id = p_recipient_id) or (b.blocker_id = p_recipient_id and b.blocked_id = v_requester_id)) then
    raise exception 'You cannot connect with this member because one of you has blocked the other.';
  end if;
  if exists (select 1 from public.connection_requests r where r.status = 'ACCEPTED'
    and ((r.requester_id = v_requester_id and r.recipient_id = p_recipient_id) or (r.requester_id = p_recipient_id and r.recipient_id = v_requester_id))) then return 'CONNECTED'; end if;
  select r.id into v_request_id from public.connection_requests r
  where r.requester_id = p_recipient_id and r.recipient_id = v_requester_id and r.status = 'PENDING' for update;
  if found then
    update public.connection_requests set status = 'ACCEPTED', updated_at = now(), responded_at = now() where id = v_request_id;
    return 'CONNECTED';
  end if;
  insert into public.connection_requests (requester_id, recipient_id, status, updated_at, responded_at)
  values (v_requester_id, p_recipient_id, 'PENDING', now(), null)
  on conflict (requester_id, recipient_id) do update
    set status = 'PENDING', updated_at = now(), responded_at = null
    where public.connection_requests.status in ('DECLINED', 'CANCELLED')
  returning status into v_status;
  if v_status is null then
    select r.status into v_status from public.connection_requests r where r.requester_id = v_requester_id and r.recipient_id = p_recipient_id;
  end if;
  return case when v_status = 'ACCEPTED' then 'CONNECTED' else v_status end;
end;
$$;
revoke all on function public.send_connection_request(uuid) from public;
grant execute on function public.send_connection_request(uuid) to authenticated;
