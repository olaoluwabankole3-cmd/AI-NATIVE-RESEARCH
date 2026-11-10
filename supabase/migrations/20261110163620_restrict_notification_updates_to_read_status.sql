-- Stage 4 least-privilege notification updates.
-- Existing data, owner DELETE policy and service_role privileges are unchanged.
do $guard$
begin
  if not exists (
    select 1 from pg_class c
    where c.oid='public.notifications'::regclass and c.relrowsecurity
  ) then raise exception 'Notifications RLS is not enabled; abort'; end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notifications'
      and cmd='UPDATE' and policyname='Members can mark their own notifications read'
  ) then raise exception 'Expected notification ownership UPDATE policy missing; abort'; end if;
end
$guard$;

revoke insert, update on table public.notifications from anon, authenticated;
grant update (is_read) on public.notifications to authenticated;
