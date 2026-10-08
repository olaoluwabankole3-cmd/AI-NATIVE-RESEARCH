create table if not exists public.agent_executions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  execution_type text not null check (execution_type in ('REPLY', 'SYNTHESIS')),
  status text not null check (status in ('SUCCEEDED', 'FAILED')),
  triggered_by uuid references auth.users(id) on delete set null,
  provider text,
  model text,
  context_post_count integer not null default 0 check (context_post_count >= 0),
  context_artifact_ids jsonb not null default '[]'::jsonb,
  output_post_id uuid references public.posts(id) on delete set null,
  output_artifact_id uuid references public.research_artifacts(id) on delete set null,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_execution_output_check check (
    (status = 'SUCCEEDED' and error_message is null) or
    (status = 'FAILED' and error_message is not null)
  )
);

create index if not exists agent_executions_agent_created_idx
  on public.agent_executions(agent_id, created_at desc);

create index if not exists agent_executions_topic_created_idx
  on public.agent_executions(topic_id, created_at desc);

alter table public.agent_executions enable row level security;

drop policy if exists "topic participants can view agent executions" on public.agent_executions;
create policy "topic participants can view agent executions"
  on public.agent_executions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.topic_participants tp
      where tp.topic_id = agent_executions.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );
