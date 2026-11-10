-- Stage 4: prevent owner-approved private membership from bypassing a community ban.
-- No user records, requests or memberships are altered by this migration.
do $guard$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='review_community_join_request'
      and pg_get_function_identity_arguments(p.oid)='p_request_id uuid, p_decision text'
      and p.prosecdef
      and pg_get_functiondef(p.oid) like '%community_join_requests%'
  ) then
    raise exception 'Expected security definer request reviewer is absent; abort migration';
  end if;
end
$guard$;

create or replace function public.review_community_join_request(p_request_id uuid, p_decision text)
returns public.community_join_requests
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_request public.community_join_requests;
  v_community public.communities;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Decision must be APPROVED or REJECTED';
  end if;

  select * into v_request
  from public.community_join_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Join request not found'; end if;

  select * into v_community from public.communities
  where id = v_request.community_id;

  if not found or v_community.created_by is distinct from auth.uid() then
    raise exception 'Only the community owner can review access requests';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'This request has already been reviewed';
  end if;

  if p_decision = 'APPROVED' then
    -- Explicitly enforce bans. SECURITY DEFINER bypasses the membership
    -- table's normal row-level security INSERT policy.
    if exists (
      select 1 from public.community_bans b
      where b.community_id = v_request.community_id
        and b.user_id = v_request.user_id
    ) then
      raise exception 'Cannot approve a blocked community member';
    end if;

    insert into public.community_members (community_id, user_id, role)
    values (v_request.community_id, v_request.user_id, 'MEMBER')
    on conflict (community_id, user_id) do nothing;
  end if;

  update public.community_join_requests
  set status = p_decision, reviewed_by = auth.uid(),
      reviewed_at = now(), updated_at = now()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$fn$;

revoke execute on function public.review_community_join_request(uuid,text) from public,anon;
grant execute on function public.review_community_join_request(uuid,text) to authenticated,service_role;
