-- Converge agents are platform-level code registry entries identified by stable text keys
-- (for example, "research-analyst"), not human accounts or UUID-backed auth users.
-- Remove any FK that forces topic_participants.agent_id to match a UUID registry row,
-- and preserve any RLS policies that reference agent_id while changing its type.

begin;

create temporary table _converge_topic_participant_policies on commit drop as
select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'topic_participants'
  and (
    coalesce(qual, '') ilike '%agent_id%'
    or coalesce(with_check, '') ilike '%agent_id%'
  );

do $$
declare
  p record;
  fk record;
  role_sql text;
  policy_sql text;
begin
  -- Drop only the RLS policies whose expressions mention agent_id, saving their
  -- original roles, command, USING expression, and WITH CHECK expression above.
  for p in
    select policyname
    from _converge_topic_participant_policies
  loop
    execute format('drop policy %I on public.topic_participants', p.policyname);
  end loop;

  -- Agent IDs are stable registry slugs, not auth-user UUIDs.
  for fk in
    select distinct c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.topic_participants'::regclass
      and c.contype = 'f'
      and a.attname = 'agent_id'
  loop
    execute format('alter table public.topic_participants drop constraint %I', fk.conname);
  end loop;

  execute 'alter table public.topic_participants alter column agent_id type text using agent_id::text';

  -- Recreate each affected policy with its original security expressions and roles.
  for p in
    select *
    from _converge_topic_participant_policies
  loop
    select string_agg(
      case when r = 'public' then 'PUBLIC' else quote_ident(r) end,
      ', '
    )
    into role_sql
    from unnest(p.roles) as role_item(r);

    policy_sql := format(
      'create policy %I on public.topic_participants as %s for %s to %s',
      p.policyname,
      lower(p.permissive),
      p.cmd,
      coalesce(role_sql, 'PUBLIC')
    );

    if p.qual is not null then
      policy_sql := policy_sql || format(' using (%s)', p.qual);
    end if;

    if p.with_check is not null then
      policy_sql := policy_sql || format(' with check (%s)', p.with_check);
    end if;

    execute policy_sql;
  end loop;
end $$;

comment on column public.topic_participants.agent_id is
  'Stable text ID of a platform-level Converge agent, matching lib/agents.ts; null for human participants.';

commit;
