-- Converge Stage 2: remove the earlier, duplicate auth.users profile initializer.
--
-- The "on_auth_user_created" trigger runs first in alphabetical trigger-name order
-- and inserts a minimal (email-based) profile, causing the later and more complete
-- "on_auth_user_profile_created" trigger to skip via ON CONFLICT DO NOTHING.
--
-- Keep the latter trigger, which populates full_name/name and avatar_url metadata.
-- Preserve the legacy function for rollback safety; do NOT modify existing profiles
-- or touch existing auth.users data.
do $$
begin
  if not exists (
    select 1
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      join pg_namespace n on n.oid = p.pronamespace
     where t.tgrelid = 'auth.users'::regclass
       and t.tgname = 'on_auth_user_created'
       and t.tgenabled = 'O'
       and n.nspname = 'public'
       and p.proname = 'handle_new_user'
       and p.pronargs = 0
  ) then
    raise exception 'Unexpected auth.users legacy trigger state; no changes applied';
  end if;

  if not exists (
    select 1
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      join pg_namespace n on n.oid = p.pronamespace
     where t.tgrelid = 'auth.users'::regclass
       and t.tgname = 'on_auth_user_profile_created'
       and t.tgenabled = 'O'
       and n.nspname = 'public'
       and p.proname = 'handle_new_user_profile'
       and p.pronargs = 0
  ) then
    raise exception 'Expected full-metadata profile trigger not found; no changes applied';
  end if;
end;
$$;

drop trigger on_auth_user_created on auth.users;
