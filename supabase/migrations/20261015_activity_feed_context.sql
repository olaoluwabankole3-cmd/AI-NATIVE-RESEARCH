-- Connect activity feed posts to communities and research topics.
-- This migration is additive and safe to run more than once.

alter table public.activity_posts
  add column if not exists community_id uuid references public.communities(id) on delete set null;

alter table public.activity_posts
  add column if not exists topic_id uuid references public.topics(id) on delete set null;

create index if not exists activity_posts_community_created_idx
  on public.activity_posts (community_id, created_at desc)
  where community_id is not null;

create index if not exists activity_posts_topic_created_idx
  on public.activity_posts (topic_id, created_at desc)
  where topic_id is not null;

create or replace function public.validate_activity_post_context()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_topic_community_id uuid;
begin
  if new.topic_id is null then
    return new;
  end if;

  select t.community_id into v_topic_community_id
  from public.topics t
  where t.id = new.topic_id;

  if not found then
    raise exception 'The selected research topic does not exist.';
  end if;

  if new.community_id is null then
    new.community_id := v_topic_community_id;
  elsif new.community_id <> v_topic_community_id then
    raise exception 'The selected topic does not belong to the selected community.';
  end if;

  return new;
end;
$$;

drop trigger if exists activity_posts_validate_context on public.activity_posts;
create trigger activity_posts_validate_context
  before insert or update of community_id, topic_id on public.activity_posts
  for each row execute function public.validate_activity_post_context();

notify pgrst, 'reload schema';
