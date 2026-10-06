create extension if not exists pgcrypto;

create table if not exists public.research_artifacts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  created_by_participant_id uuid references public.topic_participants(id) on delete set null,
  artifact_type text not null default 'SYNTHESIS'
    check (artifact_type in ('CLAIM', 'EVIDENCE', 'SOURCE', 'SYNTHESIS', 'DECISION')),
  title text not null,
  content text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_artifacts_topic_id_idx
  on public.research_artifacts(topic_id, created_at desc);

alter table public.research_artifacts enable row level security;

drop policy if exists "research artifacts visible to topic participants" on public.research_artifacts;
create policy "research artifacts visible to topic participants"
  on public.research_artifacts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.topic_participants tp
      where tp.topic_id = research_artifacts.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );

drop policy if exists "humans can create research artifacts" on public.research_artifacts;
create policy "humans can create research artifacts"
  on public.research_artifacts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.topic_id = research_artifacts.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );

drop policy if exists "artifact authors can update research artifacts" on public.research_artifacts;
create policy "artifact authors can update research artifacts"
  on public.research_artifacts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.topic_id = research_artifacts.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );

drop policy if exists "artifact authors can delete research artifacts" on public.research_artifacts;
create policy "artifact authors can delete research artifacts"
  on public.research_artifacts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.topic_participants tp
      where tp.id = research_artifacts.created_by_participant_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );
