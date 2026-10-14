-- Converge personal profiles and public avatar storage.
-- Apply this migration in the Supabase SQL Editor before using /profile.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text not null default 'New member',
  headline text,
  bio text,
  avatar_url text,
  location text,
  organization text,
  website_url text,
  interests text[] not null default '{}'::text[],
  profile_visibility text not null default 'public'
    check (profile_visibility in ('public', 'members', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,24}$'
  )
);

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;
create index if not exists profiles_visibility_idx
  on public.profiles (profile_visibility);

alter table public.profiles enable row level security;
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

drop policy if exists "Profiles can be read according to visibility" on public.profiles;
create policy "Profiles can be read according to visibility"
  on public.profiles for select to anon, authenticated
  using (
    profile_visibility = 'public'
    or (profile_visibility = 'members' and auth.uid() is not null)
    or auth.uid() = id
  );

drop policy if exists "Members can create their own profile" on public.profiles;
create policy "Members can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Members can update their own profile" on public.profiles;
create policy "Members can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New member'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

-- Backfill accounts that already existed before the profile feature.
insert into public.profiles (id, display_name, avatar_url, created_at)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'New member'
  ),
  nullif(users.raw_user_meta_data ->> 'avatar_url', ''),
  coalesce(users.created_at, now())
from auth.users as users
on conflict (id) do nothing;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_profile_updated_at();

-- Use a public bucket so profile pictures can be rendered on public profile pages.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "Members can upload their own avatar" on storage.objects;
create policy "Members can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members can update their own avatar" on storage.objects;
create policy "Members can update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members can delete their own avatar" on storage.objects;
create policy "Members can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
