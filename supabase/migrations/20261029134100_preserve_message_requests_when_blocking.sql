-- Keep pending message requests intact after a user blocks someone, while blocking all messaging.
create or replace function public.users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;
revoke all on function public.users_blocked(uuid, uuid) from public;
grant execute on function public.users_blocked(uuid, uuid) to authenticated;

drop policy if exists "Participants can send direct messages" on public.direct_messages;
create policy "Participants can send direct messages" on public.direct_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and char_length(btrim(body)) between 1 and 5000
    and exists (
      select 1 from public.direct_conversations c
      where c.id = direct_messages.conversation_id
        and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
        and not public.users_blocked(auth.uid(), case when c.user_low_id = auth.uid() then c.user_high_id else c.user_low_id end)
        and (
          c.request_status = 'ACCEPTED'
          or (c.request_status = 'PENDING' and c.created_by = auth.uid()
            and not exists (select 1 from public.direct_messages m where m.conversation_id = c.id))
        )
    )
  );

create or replace function public.block_user(p_blocked_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to block members.'; end if;
  if p_blocked_user_id is null or p_blocked_user_id = v_user_id then raise exception 'Choose another member to block.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_blocked_user_id) then raise exception 'Member not found.'; end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_user_id, p_blocked_user_id) on conflict do nothing;
end;
$$;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.respond_connection_request(p_request_id uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.connection_requests%rowtype;
  v_next_status text;
begin
  if v_user_id is null then raise exception 'Sign in to manage connection requests.'; end if;
  if p_action is null or p_action not in ('accept', 'decline', 'cancel') then
    raise exception 'Invalid connection request action.';
  end if;
  select * into v_request from public.connection_requests r where r.id = p_request_id for update;
  if not found then raise exception 'Connection request not found.'; end if;
  if v_request.status <> 'PENDING' then raise exception 'This connection request is no longer pending.'; end if;
  if p_action in ('accept', 'decline') then
    if v_request.recipient_id <> v_user_id then raise exception 'Only the recipient can respond to this request.'; end if;
    if p_action = 'accept' and public.users_blocked(v_request.requester_id, v_request.recipient_id) then
      raise exception 'You cannot connect with this member because one of you has blocked the other.';
    end if;
    v_next_status := case when p_action = 'accept' then 'ACCEPTED' else 'DECLINED' end;
  else
    if v_request.requester_id <> v_user_id then raise exception 'Only the person who sent this request can cancel it.'; end if;
    v_next_status := 'CANCELLED';
  end if;
  update public.connection_requests set status = v_next_status, updated_at = now(), responded_at = now() where id = p_request_id;
  return v_next_status;
end;
$$;
revoke all on function public.respond_connection_request(uuid, text) from public;
grant execute on function public.respond_connection_request(uuid, text) to authenticated;
