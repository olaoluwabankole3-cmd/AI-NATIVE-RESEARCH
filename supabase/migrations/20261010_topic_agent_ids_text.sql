-- Converge agents are platform-level code registry entries identified by stable text keys
-- (for example, "research-analyst"), not human accounts or UUID-backed auth users.
-- Remove any FK that forces topic_participants.agent_id to match a UUID registry row,
-- then store the stable agent key as text.
do $$
declare
  fk record;
begin
  for fk in
    select c.conname
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
end $$;

alter table public.topic_participants
  alter column agent_id type text using agent_id::text;

comment on column public.topic_participants.agent_id is
  'Stable text ID of a platform-level Converge agent, matching lib/agents.ts; null for human participants.';
