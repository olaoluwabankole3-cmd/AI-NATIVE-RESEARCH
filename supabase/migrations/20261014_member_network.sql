-- Converge social graph: one-way follows and mutual connection requests.
-- Apply this migration in the existing Supabase SQL Editor before using /network.

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_created_idx
  on public.follows (following_id, created_at desc);

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connection_requests_no_self check (requester_id <> recipient_id),
  constraint connection_requests_one_direction unique (requester_id, recipient_id)
);

create index if not exists connection_requests_recipient_status_idx
  on public.connection_requests (recipient_id, status, created_at desc);
create index if not exists connection_requests_requester_status_idx
  on public.connection_requests (requester_id, status, created_at desc);

alter table public.follows enable row level security;
alter table public.connection_requests enable row level security;

grant select on public.follows to authenticated;
grant select on public.connection_requests to authenticated;

drop policy if exists "Members can see follow edges involving themselves" on public.follows;
create policy "Members can see follow edges involving themselves"
  on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

drop policy if exists "Participants can read their connection requests" on public.connection_requests;
create policy "Participants can read their connection requests"
  on public.connection_requests for select to authenticated
  using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));

-- Follow toggling is atomic and cannot create a self-follow.
create or replace function public.toggle_follow_user(p_following_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_follower_id uuid := auth.uid();
  v_already_following boolean;
begin
  if v_follower_id is null then raise exception 'Sign in to follow members.'; end if;
  if p_following_id is null or p_following_id = v_follower_id then
    raise exception 'You cannot follow your own profile.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_following_id) then
    raise exception 'This member could not be found.';
  end if;

  select exists (
    select 1 from public.follows f
    where f.follower_id = v_follower_id and f.following_id = p_following_id
  ) into v_already_following;

  if v_already_following then
    delete from public.follows
    where follower_id = v_follower_id and following_id = p_following_id;
    return false;
  end if;

  insert into public.follows (follower_id, following_id)
  values (v_follower_id, p_following_id)
  on conflict (follower_id, following_id) do nothing;
  return true;
end;
$$;

create or replace function public.send_connection_request(p_recipient_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_id uuid := auth.uid();
  v_status text;
  v_request_id uuid;
begin
  if v_requester_id is null then raise exception 'Sign in to connect with members.'; end if;
  if p_recipient_id is null or p_recipient_id = v_requester_id then
    raise exception 'You cannot send a connection request to yourself.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_recipient_id) then
    raise exception 'This member could not be found.';
  end if;

  if exists (
    select 1 from public.connection_requests r
    where r.status = 'ACCEPTED'
      and ((r.requester_id = v_requester_id and r.recipient_id = p_recipient_id)
        or (r.requester_id = p_recipient_id and r.recipient_id = v_requester_id))
  ) then
    return 'CONNECTED';
  end if;

  -- A request back to someone who has already asked to connect accepts that request.
  select r.id into v_request_id
  from public.connection_requests r
  where r.requester_id = p_recipient_id
    and r.recipient_id = v_requester_id
    and r.status = 'PENDING'
  for update;

  if found then
    update public.connection_requests
    set status = 'ACCEPTED', updated_at = now(), responded_at = now()
    where id = v_request_id;
    return 'CONNECTED';
  end if;

  insert into public.connection_requests (requester_id, recipient_id, status, updated_at, responded_at)
  values (v_requester_id, p_recipient_id, 'PENDING', now(), null)
  on conflict (requester_id, recipient_id) do update
    set status = 'PENDING', updated_at = now(), responded_at = null
    where public.connection_requests.status in ('DECLINED', 'CANCELLED')
  returning status into v_status;

  if v_status is null then
    select r.status into v_status
    from public.connection_requests r
    where r.requester_id = v_requester_id and r.recipient_id = p_recipient_id;
  end if;
  return case when v_status = 'ACCEPTED' then 'CONNECTED' else v_status end;
end;
$$;

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

  select * into v_request
  from public.connection_requests r
  where r.id = p_request_id
  for update;

  if not found then raise exception 'Connection request not found.'; end if;
  if v_request.status <> 'PENDING' then raise exception 'This connection request is no longer pending.'; end if;

  if p_action in ('accept', 'decline') then
    if v_request.recipient_id <> v_user_id then
      raise exception 'Only the recipient can respond to this request.';
    end if;
    v_next_status := case when p_action = 'accept' then 'ACCEPTED' else 'DECLINED' end;
  else
    if v_request.requester_id <> v_user_id then
      raise exception 'Only the person who sent this request can cancel it.';
    end if;
    v_next_status := 'CANCELLED';
  end if;

  update public.connection_requests
  set status = v_next_status, updated_at = now(), responded_at = now()
  where id = p_request_id;
  return v_next_status;
end;
$$;

create or replace function public.remove_connection(p_other_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then raise exception 'Sign in to manage connections.'; end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception 'Choose another member to disconnect.';
  end if;

  delete from public.connection_requests r
  where r.status = 'ACCEPTED'
    and ((r.requester_id = v_user_id and r.recipient_id = p_other_user_id)
      or (r.requester_id = p_other_user_id and r.recipient_id = v_user_id));

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- Returns only aggregate social information about a profile the caller is allowed to view.
create or replace function public.get_profile_social_summary(p_profile_id uuid)
returns table (
  follower_count bigint,
  following_count bigint,
  connection_count bigint,
  followed_by_me boolean,
  connection_status text,
  connection_request_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_visibility text;
  v_viewer_id uuid := auth.uid();
  v_connection record;
begin
  select p.profile_visibility into v_visibility
  from public.profiles p where p.id = p_profile_id;

  if not found then return; end if;
  if v_visibility = 'private' and v_viewer_id is distinct from p_profile_id then return; end if;
  if v_visibility = 'members' and v_viewer_id is null then return; end if;

  select count(*) into follower_count
  from public.follows f where f.following_id = p_profile_id;
  select count(*) into following_count
  from public.follows f where f.follower_id = p_profile_id;
  select count(distinct case
    when r.requester_id = p_profile_id then r.recipient_id
    else r.requester_id
  end) into connection_count
  from public.connection_requests r
  where r.status = 'ACCEPTED'
    and (r.requester_id = p_profile_id or r.recipient_id = p_profile_id);

  followed_by_me := false;
  if v_viewer_id is not null and v_viewer_id <> p_profile_id then
    select exists (
      select 1 from public.follows f
      where f.follower_id = v_viewer_id and f.following_id = p_profile_id
    ) into followed_by_me;
  end if;

  connection_status := 'NONE';
  connection_request_id := null;
  if v_viewer_id is not null and v_viewer_id <> p_profile_id then
    select r.id, r.status, r.requester_id into v_connection
    from public.connection_requests r
    where (r.requester_id = v_viewer_id and r.recipient_id = p_profile_id)
       or (r.requester_id = p_profile_id and r.recipient_id = v_viewer_id)
    order by case r.status
      when 'ACCEPTED' then 1
      when 'PENDING' then 2
      else 3
    end, r.updated_at desc
    limit 1;

    if found then
      connection_request_id := v_connection.id;
      if v_connection.status = 'ACCEPTED' then
        connection_status := 'CONNECTED';
      elsif v_connection.status = 'PENDING' and v_connection.requester_id = v_viewer_id then
        connection_status := 'OUTGOING';
      elsif v_connection.status = 'PENDING' then
        connection_status := 'INCOMING';
      end if;
    end if;
  elsif v_viewer_id = p_profile_id then
    connection_status := 'SELF';
  end if;

  return next;
end;
$$;

revoke all on function public.toggle_follow_user(uuid) from public;
revoke all on function public.send_connection_request(uuid) from public;
revoke all on function public.respond_connection_request(uuid, text) from public;
revoke all on function public.remove_connection(uuid) from public;
revoke all on function public.get_profile_social_summary(uuid) from public;

grant execute on function public.toggle_follow_user(uuid) to authenticated;
grant execute on function public.send_connection_request(uuid) to authenticated;
grant execute on function public.respond_connection_request(uuid, text) to authenticated;
grant execute on function public.remove_connection(uuid) to authenticated;
grant execute on function public.get_profile_social_summary(uuid) to anon, authenticated;

create or replace function public.set_connection_request_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists connection_requests_set_updated_at on public.connection_requests;
create trigger connection_requests_set_updated_at
  before update on public.connection_requests
  for each row execute function public.set_connection_request_updated_at();

notify pgrst, 'reload schema';
