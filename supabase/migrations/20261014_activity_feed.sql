-- Converge platform-wide member activity feed.
-- Apply this migration in the Supabase SQL Editor before using /feed.

create table if not exists public.activity_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  post_type text not null default 'update'
    check (post_type in ('update', 'question', 'idea', 'resource')),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  link_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_posts_link_url_format check (
    link_url is null or link_url ~* '^https?://'
  )
);

create index if not exists activity_posts_created_at_idx
  on public.activity_posts (created_at desc);
create index if not exists activity_posts_author_created_idx
  on public.activity_posts (author_id, created_at desc);

create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.activity_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists activity_comments_post_created_idx
  on public.activity_comments (post_id, created_at asc);

create table if not exists public.activity_likes (
  post_id uuid not null references public.activity_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists activity_likes_user_created_idx
  on public.activity_likes (user_id, created_at desc);

alter table public.activity_posts enable row level security;
alter table public.activity_comments enable row level security;
alter table public.activity_likes enable row level security;

grant select, insert, update, delete on public.activity_posts to authenticated;
grant select, insert, delete on public.activity_comments to authenticated;
grant select, insert, delete on public.activity_likes to authenticated;

drop policy if exists "Members can read activity posts" on public.activity_posts;
create policy "Members can read activity posts"
  on public.activity_posts for select to authenticated using (true);

drop policy if exists "Members can publish their own activity posts" on public.activity_posts;
create policy "Members can publish their own activity posts"
  on public.activity_posts for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "Authors can edit their own activity posts" on public.activity_posts;
create policy "Authors can edit their own activity posts"
  on public.activity_posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "Authors can delete their own activity posts" on public.activity_posts;
create policy "Authors can delete their own activity posts"
  on public.activity_posts for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Members can read activity comments" on public.activity_comments;
create policy "Members can read activity comments"
  on public.activity_comments for select to authenticated using (true);

drop policy if exists "Members can comment as themselves" on public.activity_comments;
create policy "Members can comment as themselves"
  on public.activity_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.activity_posts p where p.id = post_id)
  );

drop policy if exists "Authors can delete their own activity comments" on public.activity_comments;
create policy "Authors can delete their own activity comments"
  on public.activity_comments for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Members can read activity likes" on public.activity_likes;
create policy "Members can read activity likes"
  on public.activity_likes for select to authenticated using (true);

drop policy if exists "Members can like activity as themselves" on public.activity_likes;
create policy "Members can like activity as themselves"
  on public.activity_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.activity_posts p where p.id = post_id)
  );

drop policy if exists "Members can remove their own activity likes" on public.activity_likes;
create policy "Members can remove their own activity likes"
  on public.activity_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.set_activity_post_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists activity_posts_set_updated_at on public.activity_posts;
create trigger activity_posts_set_updated_at
  before update on public.activity_posts
  for each row execute function public.set_activity_post_updated_at();

notify pgrst, 'reload schema';
