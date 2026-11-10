-- Stage 2: private relationship state must not be queryable for arbitrary pairs.
-- Public client call: current user is one member of the conversation pair.
-- RLS policy for direct_messages also calls with auth.uid() as first argument.
-- Do not modify user_blocks rows or existing conversations.

do $guard$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='users_blocked'
      and pg_get_function_identity_arguments(p.oid) = 'p_user_a uuid, p_user_b uuid'
      and p.prosecdef
  ) then
    raise exception 'Existing users_blocked signature/security semantics unexpected: abort';
  end if;
end
$guard$;

create or replace function public.users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $fn$
  select case
    when auth.uid() is null
      or p_user_a is null
      or p_user_b is null
      or auth.uid() not in (p_user_a,p_user_b)
    then false
    else exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=p_user_a and b.blocked_id=p_user_b)
         or (b.blocker_id=p_user_b and b.blocked_id=p_user_a)
    )
  end;
$fn$;

revoke execute on function public.users_blocked(uuid,uuid) from public,anon;
grant execute on function public.users_blocked(uuid,uuid) to authenticated,service_role;
