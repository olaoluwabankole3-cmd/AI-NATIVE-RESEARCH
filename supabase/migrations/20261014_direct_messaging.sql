-- Converge direct messaging.
-- Apply this migration in Supabase SQL Editor before using /messages.

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint direct_conversations_distinct_users check (user_low_id <> user_high_id),
  constraint direct_conversations_ordered_users check (user_low_id < user_high_id),
  constraint direct_conversations_unique_pair unique (user_low_id, user_high_id)
);

create index if not exists direct_conversations_low_activity_idx
  on public.direct_conversations (user_low_id, last_message_at desc);
create index if not exists direct_conversations_high_activity_idx
  on public.direct_conversations (user_high_id, last_message_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

grant select on table public.direct_conversations to authenticated;
grant select, insert on table public.direct_messages to authenticated;

drop policy if exists "Participants can read direct conversations" on public.direct_conversations;
create policy "Participants can read direct conversations"
  on public.direct_conversations for select to authenticated
  using (user_low_id = (select auth.uid()) or user_high_id = (select auth.uid()));

drop policy if exists "Participants can read direct messages" on public.direct_messages;
create policy "Participants can read direct messages"
  on public.direct_messages for select to authenticated
  using (
    exists (
      select 1
      from public.direct_conversations c
      where c.id = direct_messages.conversation_id
        and (c.user_low_id = (select auth.uid()) or c.user_high_id = (select auth.uid()))
    )
  );

drop policy if exists "Participants can send direct messages" on public.direct_messages;
create policy "Participants can send direct messages"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and char_length(btrim(body)) between 1 and 5000
    and exists (
      select 1
      from public.direct_conversations c
      where c.id = direct_messages.conversation_id
        and (c.user_low_id = (select auth.uid()) or c.user_high_id = (select auth.uid()))
    )
  );

-- A conversation can only be started between existing members who are connected.
-- The sorted pair and unique constraint prevent duplicate threads for the same two people.
create or replace function public.start_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_low_id uuid;
  v_high_id uuid;
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to message members.';
  end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception 'Choose another member to message.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_other_user_id) then
    raise exception 'This member could not be found.';
  end if;
  if not exists (
    select 1
    from public.connection_requests r
    where r.status = 'ACCEPTED'
      and (
        (r.requester_id = v_user_id and r.recipient_id = p_other_user_id)
        or (r.requester_id = p_other_user_id and r.recipient_id = v_user_id)
      )
  ) then
    raise exception 'You can message this member after your connection request is accepted.';
  end if;

  if v_user_id < p_other_user_id then
    v_low_id := v_user_id;
    v_high_id := p_other_user_id;
  else
    v_low_id := p_other_user_id;
    v_high_id := v_user_id;
  end if;

  insert into public.direct_conversations (user_low_id, user_high_id, created_by)
  values (v_low_id, v_high_id, v_user_id)
  on conflict (user_low_id, user_high_id) do nothing
  returning id into v_conversation_id;

  if v_conversation_id is null then
    select c.id into v_conversation_id
    from public.direct_conversations c
    where c.user_low_id = v_low_id and c.user_high_id = v_high_id;
  end if;

  return v_conversation_id;
end;
$$;

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.bump_direct_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.direct_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists direct_messages_update_conversation_activity on public.direct_messages;
create trigger direct_messages_update_conversation_activity
  after insert on public.direct_messages
  for each row execute function public.bump_direct_conversation_activity();

-- Enable live message updates in Supabase Realtime when the standard publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'direct_messages'
     ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end;
$$;

notify pgrst, 'reload schema';
