-- Converge organisation pages, membership requests, role management, and organisation images.
-- Apply in the existing Supabase project before using /organizations.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organization_type text not null default 'research_group'
    check (organization_type in ('company', 'university', 'research_lab', 'research_group', 'nonprofit', 'other')),
  tagline text,
  description text,
  website_url text,
  location text,
  logo_url text,
  cover_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  constraint organizations_website_format check (website_url is null or website_url ~* '^https?://')
);

create index if not exists organizations_type_created_idx
  on public.organizations (organization_type, created_at desc);
create index if not exists organizations_name_idx
  on public.organizations (lower(name));

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'ADMIN', 'MEMBER')),
  status text not null default 'REQUESTED' check (status in ('ACTIVE', 'REQUESTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_status_idx
  on public.organization_members (user_id, status);
create index if not exists organization_members_org_status_idx
  on public.organization_members (organization_id, status, role);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

grant select on public.organizations to anon, authenticated;
grant update on public.organizations to authenticated;
grant select on public.organization_members to anon, authenticated;

-- These SECURITY DEFINER helpers avoid recursive RLS checks.
create or replace function public.is_organization_admin(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    exists (
      select 1 from public.organizations o
      where o.id = p_organization_id and o.created_by = (select auth.uid())
    )
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'ACTIVE' and m.role in ('OWNER', 'ADMIN')
    );
$$;

create or replace function public.is_organization_owner(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select
    exists (
      select 1 from public.organizations o
      where o.id = p_organization_id and o.created_by = (select auth.uid())
    )
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'ACTIVE' and m.role = 'OWNER'
    );
$$;

revoke all on function public.is_organization_admin(uuid) from public;
revoke all on function public.is_organization_owner(uuid) from public;
grant execute on function public.is_organization_admin(uuid) to anon, authenticated, service_role;
grant execute on function public.is_organization_owner(uuid) to anon, authenticated, service_role;

drop policy if exists "Organisations are publicly readable" on public.organizations;
create policy "Organisations are publicly readable"
  on public.organizations for select to anon, authenticated using (true);

drop policy if exists "Organisation admins can update their page" on public.organizations;
create policy "Organisation admins can update their page"
  on public.organizations for update to authenticated
  using (public.is_organization_admin(id))
  with check (public.is_organization_admin(id));

drop policy if exists "Active memberships and relevant requests are readable" on public.organization_members;
create policy "Active memberships and relevant requests are readable"
  on public.organization_members for select to anon, authenticated
  using (
    status = 'ACTIVE'
    or user_id = (select auth.uid())
    or public.is_organization_admin(organization_id)
  );

-- Create an organisation and its owner membership atomically.
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_organization_type text,
  p_tagline text default null,
  p_description text default null,
  p_website_url text default null,
  p_location text default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if v_user_id is null then raise exception 'Sign in before creating an organisation.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Organisation names must be between 2 and 120 characters.';
  end if;
  if char_length(v_slug) < 3 or char_length(v_slug) > 60
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Use a valid organisation URL slug between 3 and 60 characters.';
  end if;
  if p_organization_type is null or p_organization_type not in ('company', 'university', 'research_lab', 'research_group', 'nonprofit', 'other') then
    raise exception 'Choose a valid organisation type.';
  end if;
  if p_website_url is not null and p_website_url !~* '^https?://' then
    raise exception 'Website URLs must start with http:// or https://.';
  end if;

  insert into public.organizations
    (name, slug, organization_type, tagline, description, website_url, location, created_by)
  values (
    v_name, v_slug, p_organization_type, nullif(btrim(p_tagline), ''),
    nullif(btrim(p_description), ''), nullif(btrim(p_website_url), ''),
    nullif(btrim(p_location), ''), v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_organization_id, v_user_id, 'OWNER', 'ACTIVE');

  return v_organization_id;
end;
$$;

create or replace function public.request_organization_membership(p_organization_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_status text;
begin
  if v_user_id is null then raise exception 'Sign in before requesting membership.'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'Organisation not found.';
  end if;

  select m.status into v_existing_status
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = v_user_id;
  if found then return v_existing_status; end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_organization_id, v_user_id, 'MEMBER', 'REQUESTED');
  return 'REQUESTED';
end;
$$;

-- Membership/role changes are only exposed through this authorised function.
create or replace function public.manage_organization_member(
  p_organization_id uuid, p_user_id uuid, p_action text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_owner boolean;
  v_is_admin boolean;
  v_target_role text;
  v_target_status text;
begin
  if v_actor_id is null then raise exception 'Sign in to manage organisation membership.'; end if;
  v_is_owner := public.is_organization_owner(p_organization_id);
  v_is_admin := public.is_organization_admin(p_organization_id);

  if not v_is_admin then raise exception 'Only organisation owners and administrators can manage membership.'; end if;
  if p_user_id is null or p_action is null or p_action not in ('approve', 'reject', 'remove', 'promote_admin', 'demote_admin') then
    raise exception 'Invalid membership action.';
  end if;

  select m.role, m.status into v_target_role, v_target_status
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = p_user_id
  for update;
  if not found then raise exception 'Membership record not found.'; end if;

  if p_action in ('approve', 'reject') then
    if v_target_status <> 'REQUESTED' or v_target_role <> 'MEMBER' then
      raise exception 'This is no longer a pending membership request.';
    end if;
    if p_action = 'approve' then
      update public.organization_members set status = 'ACTIVE', updated_at = now()
      where organization_id = p_organization_id and user_id = p_user_id;
    else
      delete from public.organization_members
      where organization_id = p_organization_id and user_id = p_user_id;
    end if;
  elsif p_action = 'remove' then
    if v_target_status <> 'ACTIVE' then raise exception 'Only active members can be removed with this action.'; end if;
    if v_target_role = 'OWNER' then raise exception 'An organisation owner cannot be removed.'; end if;
    if v_target_role = 'ADMIN' and not v_is_owner then
      raise exception 'Only the owner can remove another administrator.';
    end if;
    delete from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id;
  elsif p_action = 'promote_admin' then
    if not v_is_owner then raise exception 'Only the organisation owner can appoint administrators.'; end if;
    if v_target_status <> 'ACTIVE' or v_target_role <> 'MEMBER' then
      raise exception 'Only active members can be appointed administrators.';
    end if;
    update public.organization_members set role = 'ADMIN', updated_at = now()
    where organization_id = p_organization_id and user_id = p_user_id;
  elsif p_action = 'demote_admin' then
    if not v_is_owner then raise exception 'Only the organisation owner can change administrator roles.'; end if;
    if v_target_status <> 'ACTIVE' or v_target_role <> 'ADMIN' then
      raise exception 'This member is not an active administrator.';
    end if;
    update public.organization_members set role = 'MEMBER', updated_at = now()
    where organization_id = p_organization_id and user_id = p_user_id;
  end if;
  return true;
end;
$$;

create or replace function public.leave_organization(p_organization_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then raise exception 'Sign in to manage your membership.'; end if;
  if exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.created_by = v_user_id
  ) then raise exception 'The organisation owner cannot leave their own organisation.'; end if;

  select m.role into v_role
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = v_user_id;
  if v_role = 'OWNER' then raise exception 'Transfer ownership before leaving this organisation.'; end if;

  delete from public.organization_members
  where organization_id = p_organization_id and user_id = v_user_id and role <> 'OWNER';
  return true;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text, text) from public;
revoke all on function public.request_organization_membership(uuid) from public;
revoke all on function public.manage_organization_member(uuid, uuid, text) from public;
revoke all on function public.leave_organization(uuid) from public;
grant execute on function public.create_organization(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.request_organization_membership(uuid) to authenticated;
grant execute on function public.manage_organization_member(uuid, uuid, text) to authenticated;
grant execute on function public.leave_organization(uuid) to authenticated;

create or replace function public.set_organization_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_organization_updated_at();

drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_organization_updated_at();

-- Logos and cover images are public; only organisation admins can write to this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-assets', 'organization-assets', true, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_organization_asset(p_object_name text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  v_segment text := (storage.foldername(p_object_name))[1];
begin
  if v_segment is null or v_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_organization_admin(v_segment::uuid);
end;
$$;

revoke all on function public.can_manage_organization_asset(text) from public;
grant execute on function public.can_manage_organization_asset(text) to authenticated, service_role;

drop policy if exists "Organisation images are publicly readable" on storage.objects;
create policy "Organisation images are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'organization-assets');

drop policy if exists "Organisation admins can upload images" on storage.objects;
create policy "Organisation admins can upload images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'organization-assets' and public.can_manage_organization_asset(name));

drop policy if exists "Organisation admins can update images" on storage.objects;
create policy "Organisation admins can update images"
  on storage.objects for update to authenticated
  using (bucket_id = 'organization-assets' and public.can_manage_organization_asset(name))
  with check (bucket_id = 'organization-assets' and public.can_manage_organization_asset(name));

drop policy if exists "Organisation admins can delete images" on storage.objects;
create policy "Organisation admins can delete images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'organization-assets' and public.can_manage_organization_asset(name));

notify pgrst, 'reload schema';
