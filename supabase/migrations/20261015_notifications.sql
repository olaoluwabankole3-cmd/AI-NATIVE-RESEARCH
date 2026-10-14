-- Converge notifications: inbox, unread counts, and event-driven notifications.
-- Apply this migration in the Supabase SQL Editor once.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (
    notification_type in (
      'new_message',
      'post_comment',
      'post_like',
      'connection_request',
      'connection_accepted',
      'topic_reply'
    )
  ),
  title text not null,
  body text not null,
  href text not null default '/notifications'
    check (href like '/%' and href not like '//%'),
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_unread_created_idx
  on public.notifications (recipient_id, is_read, created_at desc);
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

drop policy if exists "Members can read their own notifications" on public.notifications;
create policy "Members can read their own notifications"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "Members can mark their own notifications read" on public.notifications;
create policy "Members can mark their own notifications read"
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

drop policy if exists "Members can delete their own notifications" on public.notifications;
create policy "Members can delete their own notifications"
  on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

-- New direct message -> notify the other person in the conversation.
create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  select case
    when c.user_low_id = new.sender_id then c.user_high_id
    else c.user_low_id
  end into v_recipient_id
  from public.direct_conversations c
  where c.id = new.conversation_id
    and (c.user_low_id = new.sender_id or c.user_high_id = new.sender_id);

  if v_recipient_id is null or v_recipient_id = new.sender_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, title, body, href, metadata
  )
  values (
    v_recipient_id,
    new.sender_id,
    'new_message',
    'New message',
    'Sent you a direct message.',
    '/messages/' || new.conversation_id::text,
    jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists direct_messages_create_notification on public.direct_messages;
create trigger direct_messages_create_notification
  after insert on public.direct_messages
  for each row execute function public.notify_direct_message();

-- Comment on an activity post -> notify the post author.
create or replace function public.notify_activity_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  select p.author_id into v_recipient_id
  from public.activity_posts p
  where p.id = new.post_id;

  if v_recipient_id is null or v_recipient_id = new.author_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, title, body, href, metadata
  )
  values (
    v_recipient_id,
    new.author_id,
    'post_comment',
    'New comment on your post',
    'A member commented on your activity post.',
    '/feed',
    jsonb_build_object('post_id', new.post_id, 'comment_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists activity_comments_create_notification on public.activity_comments;
create trigger activity_comments_create_notification
  after insert on public.activity_comments
  for each row execute function public.notify_activity_comment();

-- Like on an activity post -> notify the post author.
create or replace function public.notify_activity_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  select p.author_id into v_recipient_id
  from public.activity_posts p
  where p.id = new.post_id;

  if v_recipient_id is null or v_recipient_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, title, body, href, metadata
  )
  values (
    v_recipient_id,
    new.user_id,
    'post_like',
    'Someone liked your post',
    'A member liked your activity post.',
    '/feed',
    jsonb_build_object('post_id', new.post_id)
  );

  return new;
end;
$$;

drop trigger if exists activity_likes_create_notification on public.activity_likes;
create trigger activity_likes_create_notification
  after insert on public.activity_likes
  for each row execute function public.notify_activity_like();

-- New connection request and accepted request -> notify the relevant member.
create or replace function public.notify_connection_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_actor_id uuid;
  v_type text;
  v_title text;
  v_body text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDING' then
      return new;
    end if;
    v_recipient_id := new.recipient_id;
    v_actor_id := new.requester_id;
    v_type := 'connection_request';
    v_title := 'New connection request';
    v_body := 'A member wants to connect with you.';
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status and old.status = 'PENDING' and new.status = 'ACCEPTED' then
      v_recipient_id := new.requester_id;
      v_actor_id := new.recipient_id;
      v_type := 'connection_accepted';
      v_title := 'Connection accepted';
      v_body := 'Your connection request was accepted.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if v_recipient_id is null or v_actor_id is null or v_recipient_id = v_actor_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, title, body, href, metadata
  )
  values (
    v_recipient_id,
    v_actor_id,
    v_type,
    v_title,
    v_body,
    '/network',
    jsonb_build_object('connection_request_id', new.id, 'status', new.status)
  );

  return new;
end;
$$;

drop trigger if exists connection_requests_create_notification on public.connection_requests;
create trigger connection_requests_create_notification
  after insert or update on public.connection_requests
  for each row execute function public.notify_connection_request_event();

-- Human or AI reply in a topic -> notify the topic creator (unless they wrote the reply).
create or replace function public.notify_topic_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic_creator_id uuid;
  v_topic_title text;
  v_participant_type text;
  v_actor_id uuid;
  v_agent_id text;
  v_notification_title text;
  v_notification_body text;
begin
  select t.created_by, t.title, tp.participant_type, tp.user_id, tp.agent_id
    into v_topic_creator_id, v_topic_title, v_participant_type, v_actor_id, v_agent_id
  from public.topics t
  join public.topic_participants tp on tp.id = new.participant_id
  where t.id = new.topic_id;

  if not found or v_topic_creator_id is null then
    return new;
  end if;

  if v_participant_type = 'HUMAN' then
    if v_actor_id is null or v_actor_id = v_topic_creator_id then
      return new;
    end if;
    v_notification_title := 'New reply on your topic';
    v_notification_body := 'A member replied to "' || left(v_topic_title, 120) || '".';
  else
    v_actor_id := null;
    v_notification_title := 'AI specialist replied';
    v_notification_body := 'An AI specialist responded to "' || left(v_topic_title, 120) || '".';
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, title, body, href, metadata
  )
  values (
    v_topic_creator_id,
    v_actor_id,
    'topic_reply',
    v_notification_title,
    v_notification_body,
    '/topics/' || new.topic_id::text,
    jsonb_build_object('topic_id', new.topic_id, 'post_id', new.id, 'agent_id', v_agent_id)
  );

  return new;
end;
$$;

drop trigger if exists topic_posts_create_notification on public.posts;
create trigger topic_posts_create_notification
  after insert on public.posts
  for each row execute function public.notify_topic_reply();

-- Add the notifications table to Supabase Realtime when the publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

notify pgrst, 'reload schema';
