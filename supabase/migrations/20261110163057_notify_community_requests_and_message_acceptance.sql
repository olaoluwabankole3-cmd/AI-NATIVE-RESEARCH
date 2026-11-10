-- Stage 4: notify owners and requesters of private-community access decisions,
-- and notify senders when direct-message requests are accepted.
-- Existing rows and data grants are not modified.

do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.notifications'::regclass
      and conname='notifications_notification_type_check'
  ) then raise exception 'Unexpected notification type constraint; abort'; end if;

  if exists (
    select 1 from pg_trigger
    where tgrelid='public.community_join_requests'::regclass
      and tgname='community_join_requests_notify'
  ) or exists (
    select 1 from pg_trigger
    where tgrelid='public.direct_conversations'::regclass
      and tgname='direct_conversations_notify_acceptance'
  ) then raise exception 'An expected new notification trigger already exists; abort'; end if;
end
$guard$;

alter table public.notifications
  drop constraint notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check check (
    notification_type = any(array[
      'new_message', 'post_comment', 'post_like',
      'connection_request', 'connection_accepted', 'topic_reply',
      'community_join_request', 'community_join_approved',
      'community_join_rejected', 'message_request_accepted'
    ]::text[])
  ) not valid;

alter table public.notifications
  validate constraint notifications_notification_type_check;

create function public.notify_community_join_request()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_owner uuid;
  v_slug text;
begin
  select c.created_by,c.slug into v_owner,v_slug
  from public.communities c where c.id=new.community_id;

  if v_owner is null or v_slug is null then return new; end if;

  if tg_op='INSERT' then
    if new.status = 'PENDING' and v_owner <> new.user_id then
      insert into public.notifications (
        recipient_id,actor_id,notification_type,title,body,href,metadata
      ) values (
        v_owner,new.user_id,'community_join_request',
        'New community access request',
        'A member requested access to your private community.',
        '/communities/' || v_slug || '/settings',
        jsonb_build_object('community_id',new.community_id,'request_id',new.id)
      );
    end if;
  elsif tg_op='UPDATE' then
    if old.status='PENDING' and new.status in ('APPROVED','REJECTED') then
      insert into public.notifications (
        recipient_id,actor_id,notification_type,title,body,href,metadata
      ) values (
        new.user_id,new.reviewed_by,
        case when new.status='APPROVED' then 'community_join_approved' else 'community_join_rejected' end,
        case when new.status='APPROVED' then 'Community access approved' else 'Community access request declined' end,
        case when new.status='APPROVED' then 'Your community membership request was approved.' else 'Your community membership request was declined.' end,
        '/communities/' || v_slug,
        jsonb_build_object('community_id',new.community_id,'request_id',new.id,'status',new.status)
      );
    end if;
  end if;

  return new;
end;
$fn$;

revoke execute on function public.notify_community_join_request() from public,anon,authenticated;

create trigger community_join_requests_notify
after insert or update of status on public.community_join_requests
for each row execute function public.notify_community_join_request();

create function public.notify_direct_message_request_accepted()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_recipient uuid;
  v_actor uuid;
begin
  if old.request_status <> 'PENDING' or new.request_status <> 'ACCEPTED' then
    return new;
  end if;

  v_recipient := new.created_by;
  v_actor := case when new.user_low_id = v_recipient then new.user_high_id
             else new.user_low_id end;
  if v_recipient is null or v_actor is null or v_recipient=v_actor then return new; end if;

  insert into public.notifications (
    recipient_id,actor_id,notification_type,title,body,href,metadata
  ) values (
    v_recipient,v_actor,'message_request_accepted',
    'Message request accepted',
    'A member accepted your request to start a conversation.',
    '/messages/' || new.id::text,
    jsonb_build_object('conversation_id',new.id)
  );

  return new;
end;
$fn$;

revoke execute on function public.notify_direct_message_request_accepted() from public,anon,authenticated;

create trigger direct_conversations_notify_acceptance
after update of request_status on public.direct_conversations
for each row execute function public.notify_direct_message_request_accepted();
