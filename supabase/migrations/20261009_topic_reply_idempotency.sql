-- Idempotent human replies and one AI response per triggering human post.
-- These nullable fields preserve compatibility with posts created before this migration.
alter table public.posts
  add column if not exists client_request_id uuid,
  add column if not exists triggering_post_id uuid references public.posts(id) on delete set null;

create unique index if not exists posts_client_request_unique
  on public.posts (topic_id, participant_id, client_request_id)
  where client_request_id is not null;

create unique index if not exists posts_single_agent_reply_per_trigger_unique
  on public.posts (triggering_post_id, participant_id)
  where triggering_post_id is not null;

comment on column public.posts.client_request_id is
  'Client-generated UUID used to reuse a human post safely when a reply request is retried.';

comment on column public.posts.triggering_post_id is
  'Human post that caused this automatic agent reply, used to prevent duplicate replies on retries.';
