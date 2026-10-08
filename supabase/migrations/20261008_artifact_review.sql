alter table public.research_artifacts
  add column if not exists review_status text not null default 'DRAFT'
  check (review_status in ('DRAFT', 'APPROVED', 'REJECTED'));

alter table public.research_artifacts
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.research_artifacts
  add column if not exists reviewed_at timestamptz;

alter table public.research_artifacts
  add column if not exists review_note text;

create index if not exists research_artifacts_topic_review_idx
  on public.research_artifacts(topic_id, review_status, created_at desc);

drop policy if exists "artifact authors can update research artifacts" on public.research_artifacts;

create policy "topic participants can review research artifacts"
  on public.research_artifacts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.topic_participants tp
      where tp.topic_id = research_artifacts.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.topic_participants tp
      where tp.topic_id = research_artifacts.topic_id
        and tp.participant_type = 'HUMAN'
        and tp.user_id = auth.uid()
    )
  );
